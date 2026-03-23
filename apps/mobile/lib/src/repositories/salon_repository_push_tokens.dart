part of 'salon_repository.dart';

mixin _SalonRepositoryPushTokensMixin on _SalonRepositoryBase {
  Future<void> registerPushToken({
    required String token,
    required String platform,
    String? deviceLabel,
  }) async {
    await client.rpc(
      'register_customer_push_token',
      params: {
        'input_token': token.trim(),
        'device_platform_input': platform.trim().toLowerCase(),
        'device_label_input': deviceLabel?.trim(),
      },
    );
  }

  Future<void> deactivatePushToken({required String token}) async {
    await client.rpc(
      'deactivate_customer_push_token',
      params: {'input_token': token.trim()},
    );
  }
}
