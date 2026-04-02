abstract final class SocialAuthConfig {
  static const facebookAppId = String.fromEnvironment('FACEBOOK_APP_ID');
  static const facebookClientToken = String.fromEnvironment(
    'FACEBOOK_CLIENT_TOKEN',
  );
  static const facebookDisplayName = String.fromEnvironment(
    'FACEBOOK_DISPLAY_NAME',
    defaultValue: 'Salon Fun',
  );

  static bool get hasFacebookNativeConfig =>
      facebookAppId.trim().isNotEmpty && facebookClientToken.trim().isNotEmpty;
}
