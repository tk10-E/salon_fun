import 'package:flutter/material.dart';

import '../../core/theme/app_theme.dart';

enum AuthMode { login, signup }

class AuthModeSwitch extends StatelessWidget {
  const AuthModeSwitch({
    super.key,
    required this.activeMode,
    required this.onSelectLogin,
    required this.onSelectSignup,
  });

  final AuthMode activeMode;
  final VoidCallback? onSelectLogin;
  final VoidCallback? onSelectSignup;

  @override
  Widget build(BuildContext context) {
    final spec = AppTheme.spec(context);
    return Container(
      padding: const EdgeInsets.all(8),
      decoration: BoxDecoration(
        color: spec.panelColor.withValues(alpha: 0.84),
        borderRadius: BorderRadius.circular(30),
        border: Border.all(color: spec.lineColor),
      ),
      child: Row(
        children: [
          Expanded(
            child: _AuthModeChip(
              label: 'Entrar',
              isActive: activeMode == AuthMode.login,
              onTap: activeMode == AuthMode.login ? null : onSelectLogin,
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: _AuthModeChip(
              label: 'Criar conta',
              isActive: activeMode == AuthMode.signup,
              onTap: activeMode == AuthMode.signup ? null : onSelectSignup,
            ),
          ),
        ],
      ),
    );
  }
}

class _AuthModeChip extends StatelessWidget {
  const _AuthModeChip({
    required this.label,
    required this.isActive,
    required this.onTap,
  });

  final String label;
  final bool isActive;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final spec = AppTheme.spec(context);
    final activeBackground = spec.primaryColor;
    final activeForeground = Colors.white;
    final inactiveBackground = Colors.white.withValues(alpha: 0.9);
    final inactiveForeground = spec.inkColor;

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(24),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 180),
          curve: Curves.easeOut,
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 18),
          decoration: BoxDecoration(
            color: isActive ? activeBackground : inactiveBackground,
            borderRadius: BorderRadius.circular(24),
            boxShadow: isActive
                ? [
                    BoxShadow(
                      color: activeBackground.withValues(alpha: 0.18),
                      blurRadius: 18,
                      offset: const Offset(0, 10),
                    ),
                  ]
                : const [],
          ),
          alignment: Alignment.center,
          child: Text(
            label,
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
              color: isActive ? activeForeground : inactiveForeground,
              fontWeight: FontWeight.w800,
            ),
          ),
        ),
      ),
    );
  }
}
