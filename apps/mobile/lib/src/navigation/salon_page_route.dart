import 'package:flutter/material.dart';

class SalonPageRoute<T> extends PageRouteBuilder<T> {
  SalonPageRoute({
    required WidgetBuilder builder,
    super.settings,
    super.fullscreenDialog,
  }) : super(
         transitionDuration: const Duration(milliseconds: 420),
         reverseTransitionDuration: const Duration(milliseconds: 300),
         pageBuilder: (context, animation, secondaryAnimation) =>
             builder(context),
         transitionsBuilder: (context, animation, secondaryAnimation, child) {
           final primaryCurve = CurvedAnimation(
             parent: animation,
             curve: Curves.easeOutCubic,
             reverseCurve: Curves.easeInCubic,
           );
           final fade = Tween<double>(
             begin: 0.78,
             end: 1,
           ).animate(primaryCurve);
           final slide = Tween<Offset>(
             begin: const Offset(0.055, 0.028),
             end: Offset.zero,
           ).animate(primaryCurve);
           final scale = Tween<double>(
             begin: 0.985,
             end: 1,
           ).animate(primaryCurve);

           return FadeTransition(
             opacity: fade,
             child: SlideTransition(
               position: slide,
               child: ScaleTransition(scale: scale, child: child),
             ),
           );
         },
       );
}
