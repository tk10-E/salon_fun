import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

class PressFeedback extends StatefulWidget {
  const PressFeedback({
    super.key,
    required this.child,
    this.enabled = true,
    this.haptic = false,
    this.pressedScale = 0.97,
    this.duration = const Duration(milliseconds: 110),
  });

  final Widget child;
  final bool enabled;
  final bool haptic;
  final double pressedScale;
  final Duration duration;

  @override
  State<PressFeedback> createState() => _PressFeedbackState();
}

class _PressFeedbackState extends State<PressFeedback> {
  bool _pressed = false;

  void _setPressed(bool value) {
    if (!widget.enabled || _pressed == value) {
      return;
    }

    setState(() {
      _pressed = value;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Listener(
      behavior: HitTestBehavior.deferToChild,
      onPointerDown: (_) {
        if (widget.haptic) {
          HapticFeedback.selectionClick();
        }
        _setPressed(true);
      },
      onPointerUp: (_) => _setPressed(false),
      onPointerCancel: (_) => _setPressed(false),
      child: AnimatedScale(
        scale: _pressed ? widget.pressedScale : 1,
        duration: widget.duration,
        curve: Curves.easeOutCubic,
        child: AnimatedSlide(
          offset: _pressed ? const Offset(0, 0.012) : Offset.zero,
          duration: widget.duration,
          curve: Curves.easeOutCubic,
          child: widget.child,
        ),
      ),
    );
  }
}
