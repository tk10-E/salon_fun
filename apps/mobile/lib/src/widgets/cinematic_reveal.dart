import 'dart:async';
import 'dart:ui';

import 'package:flutter/material.dart';

class CinematicReveal extends StatefulWidget {
  const CinematicReveal({
    super.key,
    required this.child,
    this.delay = Duration.zero,
    this.duration = const Duration(milliseconds: 560),
    this.beginOffset = const Offset(0, 20),
    this.beginScale = 0.985,
    this.curve = Curves.easeOutCubic,
  });

  final Widget child;
  final Duration delay;
  final Duration duration;
  final Offset beginOffset;
  final double beginScale;
  final Curve curve;

  @override
  State<CinematicReveal> createState() => _CinematicRevealState();
}

class _CinematicRevealState extends State<CinematicReveal>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;
  Timer? _timer;
  bool _started = false;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: widget.duration,
      value: 0,
    );
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _configureMotion();
  }

  @override
  void didUpdateWidget(covariant CinematicReveal oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.duration != widget.duration) {
      _controller.duration = widget.duration;
    }
    if (oldWidget.delay != widget.delay && !_started) {
      _configureMotion();
    }
  }

  void _configureMotion() {
    final disableAnimations = MediaQuery.maybeOf(context)?.disableAnimations;
    if (disableAnimations == true) {
      _timer?.cancel();
      _started = true;
      _controller.value = 1;
      return;
    }

    if (_started) {
      return;
    }

    _timer?.cancel();
    if (widget.delay == Duration.zero) {
      _started = true;
      _controller.forward();
      return;
    }

    _timer = Timer(widget.delay, () {
      if (!mounted) {
        return;
      }
      _started = true;
      _controller.forward();
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _controller,
      child: widget.child,
      builder: (context, child) {
        final value = widget.curve.transform(_controller.value);
        final offset = Offset.lerp(widget.beginOffset, Offset.zero, value)!;
        final scale = lerpDouble(widget.beginScale, 1, value)!;

        return Opacity(
          opacity: value,
          child: Transform.translate(
            offset: offset,
            child: Transform.scale(
              scale: scale,
              alignment: Alignment.topCenter,
              child: child,
            ),
          ),
        );
      },
    );
  }
}
