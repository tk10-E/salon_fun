import 'package:intl/intl.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../shared/app_models.dart';

class BookingRepository {
  BookingRepository({required this.client});

  final SupabaseClient? client;

  Future<List<ServiceOption>> fetchServices() async {
    final safeClient = client;
    if (safeClient == null) {
      return const [];
    }

    final response = await safeClient
        .from('services')
        .select('id, name, description, duration, price, image_path')
        .eq('is_active', true)
        .order('name');

    return (response as List<dynamic>).map((entry) => jsonMap(entry)).map((
      map,
    ) {
      final imagePath = stringOrNull(map['image_path']);
      return ServiceOption(
        id: stringValue(map['id']),
        name: stringValue(map['name']),
        description: stringOrNull(map['description']),
        durationMinutes: intValue(map['duration']),
        price: doubleValue(map['price']),
        imageUrl: imagePath == null
            ? null
            : safeClient.storage.from('salon-assets').getPublicUrl(imagePath),
      );
    }).toList();
  }

  Future<DayAvailability?> fetchDayAvailability({
    required String serviceId,
    required DateTime day,
  }) async {
    final safeClient = client;
    if (safeClient == null) {
      return null;
    }

    final data = await safeClient.rpc(
      'get_day_availability',
      params: <String, dynamic>{
        'service_uuid': serviceId,
        'target_day': DateFormat('yyyy-MM-dd').format(day),
      },
    );

    return DayAvailability.fromJson(jsonMap(data));
  }

  Future<List<CustomerAppointment>> fetchAppointments() async {
    final safeClient = client;
    if (safeClient == null) {
      return const [];
    }

    final response = await safeClient
        .from('appointments')
        .select(
          'id, date, ends_at, status, deposit_amount, deposit_status, deposit_customer_reported_paid_at, deposit_customer_reported_paid_via, booking_policy_snapshot, customer_presence_confirmed_at, deposit_payment_provider, deposit_payment_provider_charge_id, deposit_payment_provider_status, deposit_payment_provider_invoice_url, deposit_payment_provider_payload, deposit_payment_provider_error, services(name, duration, price, image_path), staff_members(name, role)',
        )
        .order('date');

    return (response as List<dynamic>)
        .map((entry) => jsonMap(entry))
        .map((map) => _mapAppointment(map, safeClient))
        .toList();
  }

  Future<CustomerAppointment> createAppointment({
    required ServiceOption service,
    required AppointmentSlot slot,
  }) async {
    final safeClient = client;
    if (safeClient == null) {
      throw Exception('Supabase não configurado.');
    }

    final data = await safeClient.rpc(
      'create_appointment',
      params: <String, dynamic>{
        'service_uuid': service.id,
        'requested_date': slot.startAt.toUtc().toIso8601String(),
        'preferred_staff_member_uuid': slot.staffMemberId,
      },
    );

    final created = jsonMap(data);
    return CustomerAppointment(
      id: stringValue(created['id']),
      date: dateTimeValue(created['date']) ?? slot.startAt,
      endsAt: dateTimeOrNull(created['ends_at']) ?? slot.endsAt,
      status: stringOrNull(created['status']) ?? 'pending',
      depositAmount: doubleValue(created['deposit_amount']),
      depositStatus: stringOrNull(created['deposit_status']) ?? 'not_required',
      depositReportedPaidAt: dateTimeOrNull(
        created['deposit_customer_reported_paid_at'],
      ),
      depositReportedPaidVia: stringOrNull(
        created['deposit_customer_reported_paid_via'],
      ),
      bookingPolicySnapshot: stringOrNull(created['booking_policy_snapshot']),
      serviceName: service.name,
      serviceDuration: service.durationMinutes,
      servicePrice: service.price,
      serviceImageUrl: service.imageUrl,
      staffName: slot.staffMemberName,
      staffRole: null,
      presenceConfirmedAt: dateTimeOrNull(
        created['customer_presence_confirmed_at'],
      ),
      depositPaymentProvider: stringOrNull(created['deposit_payment_provider']),
      depositPaymentProviderChargeId: stringOrNull(
        created['deposit_payment_provider_charge_id'],
      ),
      depositPaymentProviderStatus: stringOrNull(
        created['deposit_payment_provider_status'],
      ),
      depositPaymentProviderInvoiceUrl: stringOrNull(
        created['deposit_payment_provider_invoice_url'],
      ),
      depositPaymentProviderPayload: stringOrNull(
        created['deposit_payment_provider_payload'],
      ),
      depositPaymentProviderError: stringOrNull(
        created['deposit_payment_provider_error'],
      ),
    );
  }

  Future<void> cancelAppointment({
    required String appointmentId,
    required String reason,
  }) async {
    final safeClient = client;
    if (safeClient == null) {
      throw Exception('Supabase não configurado.');
    }

    await safeClient.rpc(
      'cancel_appointment',
      params: <String, dynamic>{
        'appointment_uuid': appointmentId,
        'cancellation_reason_input': reason.trim(),
      },
    );
  }

  Future<void> reportDepositPaid({
    required String appointmentId,
    required String paymentMethod,
    String? paymentReference,
  }) async {
    final safeClient = client;
    if (safeClient == null) {
      throw Exception('Supabase não configurado.');
    }

    await safeClient.rpc(
      'report_appointment_deposit_paid',
      params: <String, dynamic>{
        'appointment_uuid': appointmentId,
        'payment_method_input': paymentMethod,
        'payment_reference_input': paymentReference?.trim(),
      },
    );
  }

  Future<AppointmentDepositCharge> createManagedDepositCharge({
    required String appointmentId,
    bool forceRefresh = false,
  }) async {
    final safeClient = client;
    if (safeClient == null) {
      throw Exception('Supabase não configurado.');
    }

    final response = await safeClient.functions.invoke(
      'asaas-create-deposit-charge',
      body: <String, dynamic>{
        'appointment_id': appointmentId,
        'force_refresh': forceRefresh,
      },
    );
    final data = jsonMap(response.data);
    if (data['ok'] != true) {
      throw Exception(
        stringOrNull(data['detail']) ??
            stringOrNull(data['error']) ??
            'Não foi possível preparar o Pix do sinal.',
      );
    }

    return AppointmentDepositCharge.fromJson(data);
  }

  CustomerAppointment _mapAppointment(
    Map<String, dynamic> map,
    SupabaseClient safeClient,
  ) {
    final service = jsonMapOrNull(map['services']);
    final staff = jsonMapOrNull(map['staff_members']);
    final imagePath = stringOrNull(service?['image_path']);
    return CustomerAppointment(
      id: stringValue(map['id']),
      date: dateTimeValue(map['date']) ?? DateTime.now(),
      endsAt: dateTimeOrNull(map['ends_at']),
      status: stringOrNull(map['status']) ?? 'pending',
      depositAmount: doubleValue(map['deposit_amount']),
      depositStatus: stringOrNull(map['deposit_status']) ?? 'not_required',
      depositReportedPaidAt: dateTimeOrNull(
        map['deposit_customer_reported_paid_at'],
      ),
      depositReportedPaidVia: stringOrNull(
        map['deposit_customer_reported_paid_via'],
      ),
      bookingPolicySnapshot: stringOrNull(map['booking_policy_snapshot']),
      serviceName: stringOrNull(service?['name']) ?? 'Serviço',
      serviceDuration: intOrNull(service?['duration']),
      servicePrice: doubleOrNull(service?['price']),
      serviceImageUrl: imagePath == null
          ? null
          : safeClient.storage.from('salon-assets').getPublicUrl(imagePath),
      staffName: stringOrNull(staff?['name']),
      staffRole: stringOrNull(staff?['role']),
      presenceConfirmedAt: dateTimeOrNull(
        map['customer_presence_confirmed_at'],
      ),
      depositPaymentProvider: stringOrNull(map['deposit_payment_provider']),
      depositPaymentProviderChargeId: stringOrNull(
        map['deposit_payment_provider_charge_id'],
      ),
      depositPaymentProviderStatus: stringOrNull(
        map['deposit_payment_provider_status'],
      ),
      depositPaymentProviderInvoiceUrl: stringOrNull(
        map['deposit_payment_provider_invoice_url'],
      ),
      depositPaymentProviderPayload: stringOrNull(
        map['deposit_payment_provider_payload'],
      ),
      depositPaymentProviderError: stringOrNull(
        map['deposit_payment_provider_error'],
      ),
    );
  }
}
