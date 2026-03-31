import 'package:flutter/material.dart';

class PulseDot extends StatefulWidget {
  const PulseDot({
    super.key,
    required this.color,
    this.size = 8,
    this.active = true,
  });

  final Color color;
  final double size;
  final bool active;

  @override
  State<PulseDot> createState() => _PulseDotState();
}

class _PulseDotState extends State<PulseDot>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1800),
    );
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _syncAnimation();
  }

  @override
  void didUpdateWidget(covariant PulseDot oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.active != widget.active) {
      _syncAnimation();
    }
  }

  void _syncAnimation() {
    final disableAnimations = MediaQuery.maybeOf(context)?.disableAnimations;
    if (!widget.active || disableAnimations == true) {
      _controller.stop();
      _controller.value = 0;
      return;
    }

    if (_controller.status == AnimationStatus.dismissed) {
      _controller.forward();
      return;
    }

    if (_controller.status == AnimationStatus.completed) {
      _controller
        ..value = 0
        ..forward();
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (!widget.active) {
      return _PulseCore(size: widget.size, color: widget.color);
    }

    return AnimatedBuilder(
      animation: _controller,
      builder: (context, _) {
        final value = Curves.easeOut.transform(_controller.value);
        final haloOpacity = (1 - value) * 0.34;
        final haloScale = 1 + (value * 1.9);

        return Stack(
          alignment: Alignment.center,
          children: [
            Transform.scale(
              scale: haloScale,
              child: Container(
                width: widget.size,
                height: widget.size,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: widget.color.withValues(alpha: haloOpacity),
                ),
              ),
            ),
            _PulseCore(size: widget.size, color: widget.color),
          ],
        );
      },
    );
  }
}

class _PulseCore extends StatelessWidget {
  const _PulseCore({required this.size, required this.color});

  final double size;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(shape: BoxShape.circle, color: color),
    );
  }
}
