import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/intl.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:url_launcher/url_launcher.dart';

import '../features/home/home_data.dart';
import '../features/home/home_data_loader.dart';
import '../navigation/salon_page_route.dart';
import '../models/app_models.dart';
import '../repositories/salon_repository.dart';
import '../services/push_notification_service.dart';
import '../theme/salon_brand_config.dart';
import '../theme/salon_branding.dart';
import '../theme/service_category_visual.dart';
import '../widgets/app_backdrop.dart';
import '../widgets/cancel_appointment_sheet.dart';
import '../widgets/cinematic_reveal.dart';
import '../widgets/feed_comments_sheet.dart';
import '../widgets/premium_section_header.dart';
import '../widgets/premium_surface_card.dart';
import 'benefits_wallet_screen.dart';
import 'book_appointment_screen.dart';
import 'premium_campaigns_screen.dart';
import 'premium_gallery_screen.dart';
import 'premium_service_detail_screen.dart';

class NotificationAlertScreen extends StatefulWidget {
  const NotificationAlertScreen({
    super.key,
    required this.notification,
    this.repository,
  });

  final NotificationTapPayload notification;
  final SalonRepository? repository;

  @override
  State<NotificationAlertScreen> createState() =>
      _NotificationAlertScreenState();
}

class _NotificationAlertScreenState extends State<NotificationAlertScreen> {
  SalonRepository? _repository;
  bool _isConfirmingPresence = false;
  bool _isCancellingAppointment = false;
  bool _isOpeningDestination = false;
  _AppointmentAlertResolution? _resolution;

  NotificationTapPayload get notification => widget.notification;

  String? get _appointmentId => notification.data['appointmentId']?.toString();
  String? get _serviceId {
    final raw = notification.data['serviceId']?.toString().trim();
    return raw == null || raw.isEmpty ? null : raw;
  }

  String get _serviceName {
    final raw = notification.data['serviceName']?.toString().trim();
    return raw == null || raw.isEmpty ? 'esse atendimento' : raw;
  }

  String? get _rewardServiceId {
    final raw = notification.data['rewardServiceId']?.toString().trim();
    return raw == null || raw.isEmpty ? null : raw;
  }

  String? get _rewardServiceName {
    final raw = notification.data['rewardServiceName']?.toString().trim();
    return raw == null || raw.isEmpty ? null : raw;
  }

  String? get _staffMemberName {
    final raw = notification.data['staffMemberName']?.toString().trim();
    return raw == null || raw.isEmpty ? null : raw;
  }

  String? get _staffMemberId {
    final raw = notification.data['staffMemberId']?.toString().trim();
    return raw == null || raw.isEmpty ? null : raw;
  }

  bool get _isFeedPostNotification =>
      notification.type == 'feed_post_published';

  String? get _postId {
    final raw = notification.data['postId']?.toString().trim();
    return raw == null || raw.isEmpty ? null : raw;
  }

  String? get _postTitle {
    final raw = notification.data['postTitle']?.toString().trim();
    return raw == null || raw.isEmpty ? null : raw;
  }

  String? get _postCaption {
    final raw = notification.data['postCaption']?.toString().trim();
    return raw == null || raw.isEmpty ? null : raw;
  }

  String? get _postImageUrl {
    final raw = notification.data['postImageUrl']?.toString().trim();
    return raw == null || raw.isEmpty ? null : raw;
  }

  String? get _postVideoUrl {
    final raw = notification.data['postVideoUrl']?.toString().trim();
    return raw == null || raw.isEmpty ? null : raw;
  }

  String? get _postServiceName {
    final raw = notification.data['serviceName']?.toString().trim();
    return raw == null || raw.isEmpty ? null : raw;
  }

  String? get _postStaffMemberName {
    final raw = notification.data['staffMemberName']?.toString().trim();
    return raw == null || raw.isEmpty ? null : raw;
  }

  String? get _postType {
    final raw = notification.data['postType']?.toString().trim();
    return raw == null || raw.isEmpty ? null : raw;
  }

  DateTime? get _postPublishedAt {
    final raw = notification.data['postPublishedAt']?.toString();
    if (raw == null || raw.isEmpty) {
      return null;
    }

    return DateTime.tryParse(raw)?.toLocal();
  }

  DateTime? get _appointmentAt {
    final raw = notification.data['appointmentAt']?.toString();
    if (raw == null || raw.isEmpty) {
      return null;
    }

    return DateTime.tryParse(raw)?.toLocal();
  }

  DateTime? get _vacancyStartsAt {
    final raw = notification.data['startsAt']?.toString();
    if (raw == null || raw.isEmpty) {
      return null;
    }

    return DateTime.tryParse(raw)?.toLocal();
  }

  bool get _requiresAttendanceConfirmation =>
      notification.type == 'appointment_confirmation_required' &&
      _appointmentId != null &&
      _resolution == null;

  SalonRepository get _repositoryInstance =>
      _repository ??= SalonRepository(Supabase.instance.client);

  String? get _destinationActionLabel {
    final destination = _destinationFor(notification);
    if (destination == null) {
      return null;
    }

    return switch (destination) {
      _NotificationDestination.wallet => 'Abrir carteira',
      _NotificationDestination.campaigns =>
        notification.type.startsWith('membership_')
            ? 'Ver plano'
            : notification.type == 'smart_rebook_prompt'
            ? 'Ver vitrine'
            : 'Ver campanha',
      _NotificationDestination.gallery => 'Abrir feed',
      _NotificationDestination.serviceDetail => 'Ver serviço',
      _NotificationDestination.booking => 'Abrir encaixe',
    };
  }

  IconData get _destinationActionIcon {
    final destination = _destinationFor(notification);
    return switch (destination) {
      _NotificationDestination.wallet => Icons.wallet_rounded,
      _NotificationDestination.campaigns => Icons.auto_awesome_rounded,
      _NotificationDestination.gallery => Icons.photo_library_rounded,
      _NotificationDestination.serviceDetail => Icons.spa_rounded,
      _NotificationDestination.booking => Icons.calendar_month_rounded,
      null => Icons.open_in_new_rounded,
    };
  }

  @override
  void initState() {
    super.initState();
    _repository = widget.repository;
  }

  Future<_NotificationDestinationContext?> _loadDestinationContext() async {
    final profile = await _repositoryInstance.getCustomerProfile();
    if (profile == null) {
      return null;
    }

    final data = await HomeDataLoader(
      repository: _repositoryInstance,
    ).load(customerId: profile.id);

    final branding = SalonBranding.fromName(
      profile.salonName,
      overrideHexColor: profile.salonBrandColor,
      businessSegment: profile.salonBusinessSegment,
      clientAppConfig: profile.salonClientAppConfig,
    );
    final brandConfig = SalonBrandConfig.fromProfile(
      profile,
      services: data.services,
      posts: data.posts,
      offers: data.offers,
    );

    return _NotificationDestinationContext(
      profile: profile,
      data: data,
      branding: branding,
      brandConfig: brandConfig,
    );
  }

  ServiceItem? _resolveNotificationService(List<ServiceItem> services) {
    final preferredIds = [_serviceId, _rewardServiceId]
        .whereType<String>()
        .map((value) => value.trim())
        .where((value) => value.isNotEmpty)
        .toList();

    for (final serviceId in preferredIds) {
      for (final service in services) {
        if (service.id == serviceId) {
          return service;
        }
      }
    }

    final candidateNames =
        [
              notification.data['serviceName']?.toString().trim(),
              _rewardServiceName,
              notification.data['offerTitle']?.toString().trim(),
            ]
            .whereType<String>()
            .map((value) => value.trim().toLowerCase())
            .where((value) => value.isNotEmpty)
            .toList();

    for (final candidate in candidateNames) {
      for (final service in services) {
        if (service.name.trim().toLowerCase() == candidate) {
          return service;
        }
      }
    }

    return null;
  }

  Future<void> _copyReferralCode(String code) async {
    final normalizedCode = code.trim();
    if (normalizedCode.isEmpty) {
      return;
    }

    await Clipboard.setData(ClipboardData(text: normalizedCode));
    if (!mounted) {
      return;
    }

    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Código de indicação copiado.')),
    );
  }

  Future<void> _openDestination() async {
    final destination = _destinationFor(notification);
    if (destination == null || _isOpeningDestination) {
      return;
    }

    setState(() => _isOpeningDestination = true);

    try {
      final contextData = await _loadDestinationContext();
      if (!mounted) {
        return;
      }

      if (contextData == null) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Não foi possível carregar esse destino agora.'),
          ),
        );
        return;
      }

      switch (destination) {
        case _NotificationDestination.wallet:
          await Navigator.of(context).push(
            SalonPageRoute<void>(
              builder: (_) => BenefitsWalletScreen(
                repository: _repositoryInstance,
                profile: contextData.profile,
                initialLoyaltySummary: contextData.data.loyaltySummary,
                initialReferralSummary: contextData.data.referralSummary,
              ),
            ),
          );
          return;
        case _NotificationDestination.campaigns:
          await Navigator.of(context).push(
            SalonPageRoute<void>(
              builder: (_) => PremiumCampaignsScreen(
                salonName: contextData.profile.salonName,
                logoUrl: contextData.profile.salonLogoUrl,
                branding: contextData.branding,
                heroImageUrl:
                    contextData.brandConfig.profileCoverImageUrl ??
                    contextData.brandConfig.heroImageUrl,
                heroTabletImageUrl:
                    contextData.brandConfig.profileCoverImageTabletUrl ??
                    contextData.brandConfig.heroImageTabletUrl,
                offers: contextData.data.offers,
                services: contextData.data.services,
                loyaltySummary: contextData.data.loyaltySummary,
                referralSummary: contextData.data.referralSummary,
                nextAvailableAt: contextData.data.nextAvailableAt,
                onBookLeadService: contextData.data.services.firstOrNull == null
                    ? null
                    : () {
                        Navigator.of(context).push(
                          SalonPageRoute<void>(
                            builder: (_) => BookAppointmentScreen(
                              repository: _repositoryInstance,
                              service: contextData.data.services.first,
                              profile: contextData.profile,
                              initialLoyaltySummary:
                                  contextData.data.loyaltySummary,
                              activeOffers: contextData.data.offers,
                            ),
                          ),
                        );
                      },
                onOpenWallet: () {
                  Navigator.of(context).push(
                    SalonPageRoute<void>(
                      builder: (_) => BenefitsWalletScreen(
                        repository: _repositoryInstance,
                        profile: contextData.profile,
                        initialLoyaltySummary: contextData.data.loyaltySummary,
                        initialReferralSummary:
                            contextData.data.referralSummary,
                      ),
                    ),
                  );
                },
                onCopyReferral:
                    contextData.data.referralSummary?.referralCode
                            .trim()
                            .isNotEmpty ==
                        true
                    ? () {
                        _copyReferralCode(
                          contextData.data.referralSummary!.referralCode,
                        );
                      }
                    : null,
              ),
            ),
          );
          return;
        case _NotificationDestination.gallery:
          await Navigator.of(context).push(
            SalonPageRoute<void>(
              builder: (_) => _NotificationGalleryDestinationScreen(
                repository: _repositoryInstance,
                profile: contextData.profile,
                initialData: contextData.data,
                branding: contextData.branding,
                initialPostId: _postId,
              ),
            ),
          );
          return;
        case _NotificationDestination.serviceDetail:
          final service = _resolveNotificationService(
            contextData.data.services,
          );
          if (service == null) {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(
                content: Text('Esse serviço não está disponível agora.'),
              ),
            );
            return;
          }

          final professionals = contextData.brandConfig
              .resolveProfessionalHighlights(
                teamProfiles: contextData.data.teamProfiles,
                posts: contextData.data.posts,
                appointments: contextData.data.appointments,
              );
          final relatedPosts = contextData.data.posts
              .where((post) => post.linkedService?.id == service.id)
              .toList();

          await Navigator.of(context).push(
            SalonPageRoute<void>(
              builder: (_) => PremiumServiceDetailScreen(
                profile: contextData.profile,
                branding: contextData.branding,
                service: service,
                professionals: professionals,
                relatedPosts: relatedPosts,
                onBook: () {
                  Navigator.of(context).push(
                    SalonPageRoute<void>(
                      builder: (_) => BookAppointmentScreen(
                        repository: _repositoryInstance,
                        service: service,
                        profile: contextData.profile,
                        initialLoyaltySummary: contextData.data.loyaltySummary,
                        activeOffers: contextData.data.offers,
                      ),
                    ),
                  );
                },
              ),
            ),
          );
          return;
        case _NotificationDestination.booking:
          final service = _resolveNotificationService(
            contextData.data.services,
          );
          if (service == null) {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(
                content: Text('Essa vaga não está mais disponível no app.'),
              ),
            );
            return;
          }

          final bookingResult = await Navigator.of(context)
              .push<BookAppointmentResult>(
                SalonPageRoute(
                  builder: (_) => BookAppointmentScreen(
                    repository: _repositoryInstance,
                    service: service,
                    profile: contextData.profile,
                    initialLoyaltySummary: contextData.data.loyaltySummary,
                    activeOffers: contextData.data.offers,
                    initialDay: _vacancyStartsAt,
                    initialSlot: _vacancyStartsAt,
                    initialStaffMemberId: _staffMemberId,
                    entryMessage: notification.body,
                  ),
                ),
              );

          if (bookingResult != null && mounted) {
            ScaffoldMessenger.of(
              context,
            ).showSnackBar(SnackBar(content: Text(bookingResult.message)));
          }
          return;
      }
    } catch (_) {
      if (!mounted) {
        return;
      }

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Não foi possível abrir esse destino agora.'),
        ),
      );
    } finally {
      if (mounted) {
        setState(() => _isOpeningDestination = false);
      }
    }
  }

  Future<void> _confirmPresence() async {
    final appointmentId = _appointmentId;
    if (appointmentId == null ||
        _isConfirmingPresence ||
        _isCancellingAppointment) {
      return;
    }

    setState(() => _isConfirmingPresence = true);

    try {
      await _repositoryInstance.confirmUpcomingAppointmentPresence(
        appointmentId: appointmentId,
      );
      if (!mounted) {
        return;
      }

      setState(() {
        _resolution = const _AppointmentAlertResolution(
          tone: _AppointmentAlertResolutionTone.success,
          title: 'Presença confirmada',
          message:
              'Perfeito. O salão já recebeu sua confirmação e esse horário continua reservado para você. Isso ajuda a manter sua vaga protegida até o atendimento.',
        );
      });
    } on PostgrestException catch (error) {
      if (!mounted) {
        return;
      }

      setState(() {
        _resolution = _AppointmentAlertResolution(
          tone: _AppointmentAlertResolutionTone.error,
          title: 'Não foi possível confirmar agora',
          message: _mapPresenceConfirmationError(error.message),
        );
      });
    } catch (_) {
      if (!mounted) {
        return;
      }

      setState(() {
        _resolution = const _AppointmentAlertResolution(
          tone: _AppointmentAlertResolutionTone.error,
          title: 'Não foi possível confirmar agora',
          message:
              'Tente novamente em alguns instantes. Se preferir, confirme direto no histórico do app.',
        );
      });
    } finally {
      if (mounted) {
        setState(() => _isConfirmingPresence = false);
      }
    }
  }

  Future<void> _cancelAppointment() async {
    final appointmentId = _appointmentId;
    if (appointmentId == null ||
        _isCancellingAppointment ||
        _isConfirmingPresence) {
      return;
    }

    final reason = await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => CancelAppointmentSheet(serviceName: _serviceName),
    );

    if (reason == null || reason.trim().isEmpty || !mounted) {
      return;
    }

    setState(() => _isCancellingAppointment = true);

    try {
      await _repositoryInstance.cancelAppointment(
        appointmentId: appointmentId,
        reason: reason,
      );
      if (!mounted) {
        return;
      }

      setState(() {
        _resolution = const _AppointmentAlertResolution(
          tone: _AppointmentAlertResolutionTone.info,
          title: 'Horário cancelado',
          message:
              'Seu cancelamento foi enviado ao salão e o horário foi liberado para a agenda. Isso ajuda o salão a reaproveitar esse encaixe a tempo.',
        );
      });
    } on PostgrestException catch (error) {
      if (!mounted) {
        return;
      }

      setState(() {
        _resolution = _AppointmentAlertResolution(
          tone: _AppointmentAlertResolutionTone.error,
          title: 'Não foi possível cancelar agora',
          message: _mapCancellationError(error.message),
        );
      });
    } catch (_) {
      if (!mounted) {
        return;
      }

      setState(() {
        _resolution = const _AppointmentAlertResolution(
          tone: _AppointmentAlertResolutionTone.error,
          title: 'Não foi possível cancelar agora',
          message:
              'Tente novamente em alguns instantes. Se preferir, cancele pelo histórico do app.',
        );
      });
    } finally {
      if (mounted) {
        setState(() => _isCancellingAppointment = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final tone = _toneFor(notification.type);
    final theme = Theme.of(context);
    final appointmentAt = _appointmentAt;
    final postPublishedAt = _postPublishedAt;

    return Scaffold(
      backgroundColor: Colors.transparent,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Aviso do salão'),
            Text(
              'Alerta em destaque',
              style: theme.textTheme.bodySmall?.copyWith(
                color: tone.deep.withValues(alpha: 0.72),
                fontWeight: FontWeight.w700,
              ),
            ),
          ],
        ),
      ),
      body: AppBackdrop(
        child: SafeArea(
          child: ListView(
            padding: const EdgeInsets.fromLTRB(20, 16, 20, 20),
            children: [
              CinematicReveal(
                delay: const Duration(milliseconds: 20),
                child: Container(
                  padding: const EdgeInsets.all(20),
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      colors: [
                        tone.deep,
                        tone.primary,
                        Color.lerp(tone.primary, Colors.white, 0.08)!,
                      ],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                    borderRadius: BorderRadius.circular(32),
                    boxShadow: const [
                      BoxShadow(
                        color: Color(0x1A27170F),
                        blurRadius: 26,
                        offset: Offset(0, 12),
                      ),
                    ],
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Container(
                            width: 52,
                            height: 52,
                            decoration: BoxDecoration(
                              color: Colors.white.withValues(alpha: 0.16),
                              borderRadius: BorderRadius.circular(16),
                            ),
                            child: Icon(
                              tone.icon,
                              color: Colors.white,
                              size: 26,
                            ),
                          ),
                          const SizedBox(width: 14),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  tone.label,
                                  style: theme.textTheme.labelLarge?.copyWith(
                                    color: Colors.white.withValues(alpha: 0.92),
                                    fontWeight: FontWeight.w800,
                                  ),
                                ),
                                const SizedBox(height: 6),
                                Text(
                                  notification.title,
                                  style: theme.textTheme.headlineSmall
                                      ?.copyWith(
                                        color: Colors.white,
                                        fontWeight: FontWeight.w900,
                                        height: 1.05,
                                      ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 14),
                      Text(
                        notification.body,
                        style: theme.textTheme.bodyLarge?.copyWith(
                          color: Colors.white.withValues(alpha: 0.94),
                        ),
                      ),
                      const SizedBox(height: 14),
                      Wrap(
                        spacing: 10,
                        runSpacing: 10,
                        children: [
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 12,
                              vertical: 8,
                            ),
                            decoration: BoxDecoration(
                              color: Colors.white.withValues(alpha: 0.14),
                              borderRadius: BorderRadius.circular(999),
                            ),
                            child: Text(
                              'Recebida em ${DateFormat('dd/MM • HH:mm').format(notification.receivedAt)}',
                              style: theme.textTheme.labelMedium?.copyWith(
                                color: Colors.white,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ),
                          if (appointmentAt != null)
                            Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 12,
                                vertical: 8,
                              ),
                              decoration: BoxDecoration(
                                color: Colors.white.withValues(alpha: 0.14),
                                borderRadius: BorderRadius.circular(999),
                              ),
                              child: Text(
                                'Horário: ${DateFormat('dd/MM • HH:mm').format(appointmentAt)}',
                                style: theme.textTheme.labelMedium?.copyWith(
                                  color: Colors.white,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                            ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 20),
              CinematicReveal(
                delay: const Duration(milliseconds: 90),
                child: _AlertContextStrip(
                  tone: tone,
                  notificationType: notification.type,
                ),
              ),
              const SizedBox(height: 18),
              CinematicReveal(
                delay: const Duration(milliseconds: 140),
                child: PremiumSurfaceCard(
                  padding: const EdgeInsets.all(20),
                  tone: PremiumSurfaceTone.secondary,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const PremiumSectionHeader(
                        eyebrow: 'Central do salão',
                        title: 'Resumo do aviso',
                        subtitle:
                            'Entenda rápido o impacto desse alerta no seu próximo passo.',
                      ),
                      const SizedBox(height: 14),
                      Text(
                        _descriptionFor(notification.type),
                        style: theme.textTheme.bodyMedium?.copyWith(
                          color: const Color(0xFF765E4E),
                          height: 1.55,
                        ),
                      ),
                      if (_nextStepFor(notification) case final nextStep?) ...[
                        const SizedBox(height: 18),
                        _NextStepCard(message: nextStep),
                      ],
                      if (_isFeedPostNotification) ...[
                        const SizedBox(height: 18),
                        _FeedPostPreviewCard(
                          title: _postTitle ?? notification.title,
                          caption: _postCaption ?? notification.body,
                          imageUrl: _postImageUrl,
                          videoUrl: _postVideoUrl,
                          postType: _postType,
                          serviceName: _postServiceName,
                          staffMemberName: _postStaffMemberName,
                          publishedAt: postPublishedAt,
                        ),
                      ],
                      if (_staffMemberName != null) ...[
                        const SizedBox(height: 12),
                        Text(
                          'Profissional: $_staffMemberName',
                          style: theme.textTheme.bodyMedium?.copyWith(
                            color: const Color(0xFF5F4B3E),
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ],
                      if (_requiresAttendanceConfirmation) ...[
                        const SizedBox(height: 20),
                        Container(
                          width: double.infinity,
                          padding: const EdgeInsets.all(16),
                          decoration: BoxDecoration(
                            color: const Color(0xFFF8F1E8),
                            borderRadius: BorderRadius.circular(18),
                            border: Border.all(color: const Color(0xFFE7D6C4)),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'Confirme agora para manter seu horário',
                                style: theme.textTheme.titleSmall?.copyWith(
                                  color: const Color(0xFF2F231C),
                                  fontWeight: FontWeight.w900,
                                ),
                              ),
                              const SizedBox(height: 8),
                              Text(
                                'Se você não puder comparecer, cancele por aqui para liberar a agenda do salão a tempo.',
                                style: theme.textTheme.bodyMedium?.copyWith(
                                  color: const Color(0xFF765E4E),
                                ),
                              ),
                              const SizedBox(height: 16),
                              SizedBox(
                                width: double.infinity,
                                child: FilledButton.icon(
                                  onPressed:
                                      _isConfirmingPresence ||
                                          _isCancellingAppointment
                                      ? null
                                      : _confirmPresence,
                                  icon: const Icon(Icons.verified_user_rounded),
                                  label: Text(
                                    _isConfirmingPresence
                                        ? 'Confirmando presença...'
                                        : 'Confirmar presença',
                                  ),
                                ),
                              ),
                              const SizedBox(height: 10),
                              SizedBox(
                                width: double.infinity,
                                child: OutlinedButton.icon(
                                  onPressed:
                                      _isConfirmingPresence ||
                                          _isCancellingAppointment
                                      ? null
                                      : _cancelAppointment,
                                  icon: const Icon(Icons.event_busy_rounded),
                                  label: Text(
                                    _isCancellingAppointment
                                        ? 'Cancelando horário...'
                                        : 'Cancelar horário',
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                      if (_resolution != null) ...[
                        const SizedBox(height: 20),
                        _ResolutionCard(resolution: _resolution!),
                      ],
                      if (_destinationActionLabel != null) ...[
                        const SizedBox(height: 20),
                        SizedBox(
                          width: double.infinity,
                          child: FilledButton.icon(
                            onPressed: _isOpeningDestination
                                ? null
                                : _openDestination,
                            icon: Icon(_destinationActionIcon),
                            label: Text(
                              _isOpeningDestination
                                  ? 'Abrindo destino...'
                                  : _destinationActionLabel!,
                            ),
                          ),
                        ),
                      ],
                      const SizedBox(height: 20),
                      if (_destinationActionLabel == null)
                        FilledButton.icon(
                          onPressed: () => Navigator.of(context).pop(),
                          icon: const Icon(Icons.check_circle_outline_rounded),
                          label: const Text('Entendi'),
                        )
                      else
                        OutlinedButton.icon(
                          onPressed: () => Navigator.of(context).pop(),
                          icon: const Icon(Icons.check_circle_outline_rounded),
                          label: const Text('Entendi'),
                        ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _AlertContextStrip extends StatelessWidget {
  const _AlertContextStrip({
    required this.tone,
    required this.notificationType,
  });

  final _NotificationTone tone;
  final String notificationType;

  @override
  Widget build(BuildContext context) {
    final title = switch (notificationType) {
      'appointment_confirmation_required' => 'Esse aviso pede ação rápida',
      'feed_post_published' => 'Esse aviso mostra uma referência',
      'vacancy_alert' => 'Esse encaixe pode sumir rápido',
      _ => 'Esse alerta muda seu próximo passo',
    };
    final message = switch (notificationType) {
      'appointment_confirmation_required' =>
        'Confirmação, cancelamento e próximos passos aparecem na mesma tela.',
      'feed_post_published' =>
        'A publicação já vira referência antes mesmo de você abrir o feed.',
      'vacancy_alert' =>
        'O valor desse alerta está em chegar cedo e agir antes de todo mundo.',
      _ => 'Aqui você vê rápido o que esse aviso muda no seu uso do app.',
    };

    return PremiumSurfaceCard(
      padding: const EdgeInsets.all(18),
      gradient: LinearGradient(
        colors: [
          Colors.white.withValues(alpha: 0.98),
          tone.primary.withValues(alpha: 0.08),
        ],
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
      ),
      tone: PremiumSurfaceTone.accent,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: tone.primary.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(14),
            ),
            child: Icon(tone.icon, color: tone.deep, size: 20),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    color: const Color(0xFF2F231C),
                    fontWeight: FontWeight.w900,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  message,
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: const Color(0xFF765E4E),
                    height: 1.45,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _ResolutionCard extends StatelessWidget {
  const _ResolutionCard({required this.resolution});

  final _AppointmentAlertResolution resolution;

  @override
  Widget build(BuildContext context) {
    final colors = switch (resolution.tone) {
      _AppointmentAlertResolutionTone.success => (
        background: const Color(0xFFEAF6EE),
        border: const Color(0xFFCFE2D7),
        foreground: const Color(0xFF2E6B4B),
        icon: Icons.verified_rounded,
      ),
      _AppointmentAlertResolutionTone.info => (
        background: const Color(0xFFF4F0FF),
        border: const Color(0xFFDCD3F4),
        foreground: const Color(0xFF5D4AA0),
        icon: Icons.info_outline_rounded,
      ),
      _AppointmentAlertResolutionTone.error => (
        background: const Color(0xFFFFEFEE),
        border: const Color(0xFFF0D0CC),
        foreground: const Color(0xFFA63B30),
        icon: Icons.error_outline_rounded,
      ),
    };

    return PremiumSurfaceCard(
      padding: const EdgeInsets.all(16),
      gradient: LinearGradient(
        colors: [
          colors.background,
          Color.lerp(colors.background, Colors.white, 0.16)!,
        ],
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
      ),
      tone: PremiumSurfaceTone.secondary,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(colors.icon, color: colors.foreground),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  resolution.title,
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(
                    color: colors.foreground,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  resolution.message,
                  style: Theme.of(
                    context,
                  ).textTheme.bodyMedium?.copyWith(color: colors.foreground),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _NextStepCard extends StatelessWidget {
  const _NextStepCard({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    return PremiumSurfaceCard(
      padding: const EdgeInsets.all(16),
      tone: PremiumSurfaceTone.accent,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 34,
            height: 34,
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.72),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: const Color(0xFFE7D6C4)),
            ),
            child: const Icon(
              Icons.bolt_rounded,
              size: 18,
              color: Color(0xFF8D5B28),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Próximo passo',
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(
                    color: const Color(0xFF2F231C),
                    fontWeight: FontWeight.w900,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  message,
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: const Color(0xFF765E4E),
                    height: 1.45,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _AppointmentAlertResolution {
  const _AppointmentAlertResolution({
    required this.tone,
    required this.title,
    required this.message,
  });

  final _AppointmentAlertResolutionTone tone;
  final String title;
  final String message;
}

enum _AppointmentAlertResolutionTone { success, info, error }

class _NotificationTone {
  const _NotificationTone({
    required this.label,
    required this.icon,
    required this.primary,
    required this.deep,
  });

  final String label;
  final IconData icon;
  final Color primary;
  final Color deep;
}

_NotificationTone _toneFor(String type) {
  if (type.startsWith('promotion_') ||
      type.startsWith('membership_') ||
      type.startsWith('loyalty_') ||
      type == 'winback_offer' ||
      type == 'smart_rebook_prompt' ||
      type.startsWith('service_') ||
      type == 'feed_post_published') {
    return const _NotificationTone(
      label: 'Novidade do salão',
      icon: Icons.local_offer_rounded,
      primary: Color(0xFFC56B43),
      deep: Color(0xFF7B3F26),
    );
  }

  if (type.startsWith('appointment_') || type == 'vacancy_alert') {
    return const _NotificationTone(
      label: 'Atualização da agenda',
      icon: Icons.calendar_month_rounded,
      primary: Color(0xFF4E8E94),
      deep: Color(0xFF27525A),
    );
  }

  if (type.startsWith('referral_')) {
    return const _NotificationTone(
      label: 'Indicação',
      icon: Icons.card_giftcard_rounded,
      primary: Color(0xFF6D8B74),
      deep: Color(0xFF385042),
    );
  }

  return const _NotificationTone(
    label: 'Aviso do salão',
    icon: Icons.notifications_active_rounded,
    primary: Color(0xFF8D6CCF),
    deep: Color(0xFF4D3E7E),
  );
}

String _descriptionFor(String type) {
  switch (type) {
    case 'promotion_published':
    case 'promotion_updated':
      return 'O salão publicou ou atualizou uma promoção.';
    case 'winback_offer':
      return 'O salão ativou uma oferta de retorno.';
    case 'smart_rebook_prompt':
      return 'Já é um bom momento para reservar o próximo horário.';
    case 'membership_published':
    case 'membership_updated':
      return 'Um plano mensal foi publicado ou atualizado.';
    case 'loyalty_program_updated':
      return 'O salão atualizou a fidelidade.';
    case 'loyalty_tier_unlocked':
    case 'loyalty_vip_unlocked':
      return 'Seu histórico liberou um novo nível de fidelidade.';
    case 'referral_program_updated':
      return 'O salão atualizou o programa de indicação.';
    case 'service_published':
    case 'service_updated':
      return 'O catálogo do salão mudou.';
    case 'feed_post_published':
      return 'O salão publicou um novo resultado no feed.';
    case 'appointment_confirmed':
      return 'Seu horário foi confirmado pelo salão.';
    case 'appointment_reminder_1h':
      return 'Falta uma hora para o seu atendimento.';
    case 'appointment_confirmation_required':
      return 'O salão pediu sua confirmação de presença.';
    case 'appointment_auto_cancelled_unconfirmed':
      return 'A presença não foi confirmada a tempo e o horário foi liberado.';
    case 'appointment_staff_reassigned':
      return 'O salão trocou o profissional do seu horário.';
    case 'appointment_cancelled':
      return 'O salão cancelou o horário.';
    case 'appointment_completed':
      return 'Seu atendimento foi marcado como concluído pelo salão.';
    case 'vacancy_alert':
      return 'Um horário foi liberado no salão.';
    case 'referral_qualified':
      return 'Uma indicação sua concluiu a primeira visita.';
    case 'referral_reward_unlocked':
      return 'Sua recompensa por indicação já foi liberada.';
    default:
      return 'O salão enviou uma atualização importante.';
  }
}

String? _nextStepFor(NotificationTapPayload notification) {
  final type = notification.type;
  final serviceName = notification.data['serviceName']?.toString().trim();
  final staffMemberName = notification.data['staffMemberName']
      ?.toString()
      .trim();

  switch (type) {
    case 'feed_post_published':
      return 'Use essa referência para decidir e abra o feed se quiser ver mais.';
    case 'vacancy_alert':
      return 'Se esse horário fizer sentido, vale reservar logo.';
    case 'winback_offer':
      return 'Se a oferta combinar com você, aproveite para voltar ao salão.';
    case 'smart_rebook_prompt':
      return 'Seu momento de voltar chegou.';
    case 'appointment_confirmation_required':
      final target = serviceName == null || serviceName.isEmpty
          ? 'o seu horário'
          : serviceName;
      if (staffMemberName != null && staffMemberName.isNotEmpty) {
        return 'Confirme agora para manter $target com $staffMemberName.';
      }
      return 'Confirme agora para manter $target reservado.';
    case 'appointment_confirmed':
      return 'Seu horário está confirmado.';
    case 'appointment_reminder_1h':
      return 'Saia com antecedência ou avise o salão.';
    case 'appointment_staff_reassigned':
      return 'Confira o profissional responsável e siga com o horário.';
    case 'appointment_auto_cancelled_unconfirmed':
      return 'Abra a agenda assim que puder para tentar recuperar outro encaixe.';
    case 'appointment_cancelled':
      return 'Se ainda quiser manter a visita, procure um novo horário no app.';
    case 'appointment_completed':
      return 'Depois da visita, vale abrir a carteira.';
    case 'loyalty_program_updated':
    case 'loyalty_tier_unlocked':
    case 'loyalty_vip_unlocked':
      return 'Abra sua carteira no app para conferir saldo, cashback e o nível de fidelidade que pode puxar a próxima visita.';
    case 'membership_published':
    case 'membership_updated':
      return 'Compare o plano com sua frequência no salão para ver se faz sentido.';
    case 'promotion_published':
    case 'promotion_updated':
      return 'Se a campanha combinar com o que você costuma fazer, vale aproveitar enquanto ela está ativa.';
    case 'service_published':
    case 'service_updated':
      return 'Veja se esse serviço combina com sua rotina.';
    case 'referral_program_updated':
      return 'Se você gosta do salão, esse é um bom momento para compartilhar seu código.';
    case 'referral_qualified':
      return 'Sua meta andou. Veja quantas indicações faltam.';
    case 'referral_reward_unlocked':
      return 'Guarde essa recompensa para usar na próxima visita.';
    default:
      return null;
  }
}

class _NotificationGalleryDestinationScreen extends StatefulWidget {
  const _NotificationGalleryDestinationScreen({
    required this.repository,
    required this.profile,
    required this.initialData,
    required this.branding,
    this.initialPostId,
  });

  final SalonRepository repository;
  final CustomerProfile profile;
  final HomeData initialData;
  final SalonBranding branding;
  final String? initialPostId;

  @override
  State<_NotificationGalleryDestinationScreen> createState() =>
      _NotificationGalleryDestinationScreenState();
}

class _NotificationGalleryDestinationScreenState
    extends State<_NotificationGalleryDestinationScreen> {
  final Set<String> _busyPostIds = <String>{};
  late HomeData _data;

  @override
  void initState() {
    super.initState();
    _data = widget.initialData;
  }

  void _showMessage(String message) {
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(message)));
  }

  Future<void> _refresh() async {
    final data = await HomeDataLoader(
      repository: widget.repository,
    ).load(customerId: widget.profile.id);

    if (!mounted) {
      return;
    }

    setState(() => _data = data);
  }

  Future<void> _runPostAction(
    String postId,
    Future<void> Function() action, {
    SalonPost Function(SalonPost current)? localTransform,
  }) async {
    if (_busyPostIds.contains(postId)) {
      return;
    }

    setState(() => _busyPostIds.add(postId));

    try {
      await action();

      if (localTransform != null) {
        setState(() {
          _data = _data.copyWith(
            posts: _data.posts
                .map((post) => post.id == postId ? localTransform(post) : post)
                .toList(growable: false),
          );
        });
      }

      await _refresh();
    } on PostgrestException catch (error) {
      if (mounted) {
        final raw = error.message.toLowerCase();
        _showMessage(
          raw.contains('comment')
              ? 'Não foi possível atualizar os comentários agora.'
              : 'Não foi possível atualizar o feed agora.',
        );
      }
    } catch (_) {
      if (mounted) {
        _showMessage('Não foi possível concluir sua interação agora.');
      }
    } finally {
      if (mounted) {
        setState(() => _busyPostIds.remove(postId));
      }
    }
  }

  Future<void> _toggleLike(SalonPost post) async {
    final liking = !post.likedByMe;
    await _runPostAction(
      post.id,
      () async {
        if (post.likedByMe) {
          await widget.repository.unlikePost(
            postId: post.id,
            customerId: widget.profile.id,
          );
        } else {
          await widget.repository.likePost(postId: post.id);
        }
      },
      localTransform: (current) => current.copyWith(
        likedByMe: liking,
        likeCount: liking
            ? current.likeCount + 1
            : (current.likeCount > 0 ? current.likeCount - 1 : 0),
      ),
    );
  }

  Future<void> _openComments(SalonPost post) async {
    final created = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      backgroundColor: const Color(0xFFFFFBF7),
      builder: (context) => FeedCommentsSheet(
        post: post,
        branding: widget.branding,
        onSubmitComment: (body) =>
            widget.repository.addPostComment(postId: post.id, body: body),
      ),
    );

    if (created == true) {
      if (mounted) {
        _showMessage('Comentário enviado com sucesso.');
      }
      await _refresh();
    }
  }

  Future<void> _openBooking(ServiceItem service) async {
    final result = await Navigator.of(context).push<BookAppointmentResult>(
      SalonPageRoute(
        builder: (_) => BookAppointmentScreen(
          repository: widget.repository,
          service: service,
          profile: widget.profile,
          initialLoyaltySummary: _data.loyaltySummary,
          activeOffers: _data.offers,
        ),
      ),
    );

    if (result != null && mounted) {
      _showMessage(result.message);
    }
  }

  @override
  Widget build(BuildContext context) {
    return PremiumGalleryScreen(
      profile: widget.profile,
      branding: widget.branding,
      posts: _data.posts,
      onRefresh: _refresh,
      onWhatsApp: () {},
      onToggleLike: _toggleLike,
      onOpenComments: _openComments,
      onBookService: _openBooking,
      busyPostIds: _busyPostIds,
      initialPostId: widget.initialPostId,
    );
  }
}

enum _NotificationDestination {
  campaigns,
  wallet,
  gallery,
  serviceDetail,
  booking,
}

_NotificationDestination? _destinationFor(NotificationTapPayload notification) {
  final type = notification.type;
  final serviceId = notification.data['serviceId']?.toString().trim();
  final rewardServiceId = notification.data['rewardServiceId']
      ?.toString()
      .trim();
  final serviceName = notification.data['serviceName']?.toString().trim();
  final rewardServiceName = notification.data['rewardServiceName']
      ?.toString()
      .trim();
  final hasServiceContext =
      (serviceId != null && serviceId.isNotEmpty) ||
      (rewardServiceId != null && rewardServiceId.isNotEmpty) ||
      (serviceName != null && serviceName.isNotEmpty) ||
      (rewardServiceName != null && rewardServiceName.isNotEmpty);

  if (type.startsWith('promotion_') ||
      type.startsWith('membership_') ||
      type == 'winback_offer' ||
      type == 'smart_rebook_prompt') {
    return _NotificationDestination.campaigns;
  }

  if (type.startsWith('loyalty_') ||
      type.startsWith('referral_') ||
      type == 'appointment_completed') {
    return _NotificationDestination.wallet;
  }

  if (type == 'vacancy_alert') {
    return _NotificationDestination.booking;
  }

  if (type == 'feed_post_published') {
    return _NotificationDestination.gallery;
  }

  if ((type == 'service_published' || type == 'service_updated') &&
      hasServiceContext) {
    return _NotificationDestination.serviceDetail;
  }

  return null;
}

class _NotificationDestinationContext {
  const _NotificationDestinationContext({
    required this.profile,
    required this.data,
    required this.branding,
    required this.brandConfig,
  });

  final CustomerProfile profile;
  final HomeData data;
  final SalonBranding branding;
  final SalonBrandConfig brandConfig;
}

class _FeedPostPreviewCard extends StatelessWidget {
  const _FeedPostPreviewCard({
    required this.title,
    required this.caption,
    this.imageUrl,
    this.videoUrl,
    this.postType,
    this.serviceName,
    this.staffMemberName,
    this.publishedAt,
  });

  final String title;
  final String caption;
  final String? imageUrl;
  final String? videoUrl;
  final String? postType;
  final String? serviceName;
  final String? staffMemberName;
  final DateTime? publishedAt;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final serviceVisual = resolveServiceCategoryVisual(
      category: serviceName,
      name: title,
    );
    final formatLabel = switch (postType) {
      'before_after' => 'Antes e depois',
      'reel' => 'Vídeo curto',
      _ => 'Foto',
    };

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFFF8F1E8),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFFE7D6C4)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (imageUrl != null) ...[
            ClipRRect(
              borderRadius: BorderRadius.circular(20),
              child: AspectRatio(
                aspectRatio: 4 / 3,
                child: Image.network(
                  imageUrl!,
                  fit: BoxFit.cover,
                  errorBuilder: (context, error, stackTrace) {
                    return Container(
                      color: const Color(0xFFF1E4D7),
                      alignment: Alignment.center,
                      child: const Icon(
                        Icons.photo_camera_back_rounded,
                        size: 34,
                        color: Color(0xFF9A7B67),
                      ),
                    );
                  },
                ),
              ),
            ),
            const SizedBox(height: 14),
          ],
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              _FeedMetaChip(
                icon: postType == 'reel'
                    ? Icons.play_circle_outline_rounded
                    : postType == 'before_after'
                    ? Icons.compare_rounded
                    : Icons.photo_library_outlined,
                label: formatLabel,
              ),
              if (serviceName != null)
                _FeedMetaChip(icon: serviceVisual.icon, label: serviceName!),
              if (staffMemberName != null)
                _FeedMetaChip(
                  icon: Icons.person_outline_rounded,
                  label: staffMemberName!,
                ),
              if (videoUrl != null)
                const _FeedMetaChip(
                  icon: Icons.ondemand_video_rounded,
                  label: 'Com vídeo',
                ),
              if (publishedAt != null)
                _FeedMetaChip(
                  icon: Icons.schedule_rounded,
                  label: DateFormat('dd/MM • HH:mm').format(publishedAt!),
                ),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            'Preview do feed',
            style: theme.textTheme.labelMedium?.copyWith(
              color: const Color(0xFF8D6B59),
              fontWeight: FontWeight.w800,
              letterSpacing: 0.2,
            ),
          ),
          const SizedBox(height: 10),
          Text(
            title,
            style: theme.textTheme.titleSmall?.copyWith(
              color: const Color(0xFF2F231C),
              fontWeight: FontWeight.w900,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            caption,
            style: theme.textTheme.bodyMedium?.copyWith(
              color: const Color(0xFF765E4E),
              height: 1.5,
            ),
          ),
          const SizedBox(height: 10),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.76),
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: const Color(0xFFE7D6C4)),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Icon(
                  Icons.touch_app_rounded,
                  size: 16,
                  color: Color(0xFF8D6B59),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'Abra a aba Feed do salão para ver a publicação completa, curtir, comentar ou usar esse resultado para decidir seu próximo agendamento.',
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: const Color(0xFF8D6B59),
                      fontWeight: FontWeight.w700,
                      height: 1.45,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _FeedMetaChip extends StatelessWidget {
  const _FeedMetaChip({required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.9),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: const Color(0xFFE5D2BF)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 16, color: const Color(0xFF8E441F)),
          const SizedBox(width: 6),
          Text(
            label,
            style: Theme.of(context).textTheme.labelMedium?.copyWith(
              color: const Color(0xFF5F4B3E),
              fontWeight: FontWeight.w800,
            ),
          ),
        ],
      ),
    );
  }
}

String _mapPresenceConfirmationError(String raw) {
  final message = raw.toLowerCase();

  if (message.contains('appointment_not_found')) {
    return 'Esse horário não foi encontrado no sistema do salão.';
  }

  if (message.contains('appointment_not_confirmed')) {
    return 'Esse horário ainda não foi confirmado pelo salão ou já mudou de status.';
  }

  if (message.contains('appointment_already_started')) {
    return 'O horário já começou. Se você precisar, fale com o salão pelo app.';
  }

  if (message.contains('confirmation_not_requested')) {
    return 'Esse horário ainda não está na janela de confirmação pelo cliente.';
  }

  if (message.contains('unauthorized') ||
      message.contains('customer_not_linked')) {
    return 'Sua conta não tem permissão para confirmar esse horário.';
  }

  return 'Tente novamente em alguns instantes. Se o problema continuar, fale com o salão.';
}

String _mapCancellationError(String raw) {
  final message = raw.toLowerCase();

  if (message.contains('appointment_not_found')) {
    return 'Esse horário não foi encontrado no sistema do salão.';
  }

  if (message.contains('past_appointment_cannot_be_cancelled')) {
    return 'Esse atendimento já passou e não pode mais ser cancelado.';
  }

  if (message.contains('appointment_already_completed')) {
    return 'Esse atendimento já foi concluído pelo salão.';
  }

  if (message.contains('appointment_already_cancelled')) {
    return 'Esse atendimento já foi cancelado.';
  }

  return 'Tente novamente em alguns instantes. Se o problema continuar, fale com o salão.';
}
