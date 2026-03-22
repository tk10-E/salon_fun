import 'package:flutter/material.dart';

class ServiceCategoryVisual {
  const ServiceCategoryVisual({
    required this.icon,
    required this.fallbackDescription,
  });

  final IconData icon;
  final String fallbackDescription;
}

ServiceCategoryVisual resolveServiceCategoryVisual({
  String? category,
  String? name,
}) {
  final normalized = _normalizeCategoryText('$category $name');

  if (_containsAny(normalized, const [
    'manicure',
    'pedicure',
    'unha',
    'nail',
    'gel',
    'fibra',
    'cuticula',
    'cuticula',
  ])) {
    return const ServiceCategoryVisual(
      icon: Icons.back_hand_rounded,
      fallbackDescription:
          'Sessão dedicada para unhas e acabamento, com tempo reservado para você.',
    );
  }

  if (_containsAny(normalized, const [
    'sobrancel',
    'brow',
    'cilio',
    'cilios',
    'lash',
    'maqui',
    'make',
  ])) {
    return const ServiceCategoryVisual(
      icon: Icons.visibility_rounded,
      fallbackDescription:
          'Atendimento focado em olhar, maquiagem e acabamento com mais cuidado.',
    );
  }

  if (_containsAny(normalized, const [
    'limpeza de pele',
    'pele',
    'facial',
    'peeling',
    'skin',
    'spa',
  ])) {
    return const ServiceCategoryVisual(
      icon: Icons.spa_rounded,
      fallbackDescription:
          'Momento dedicado ao cuidado facial e ao bem-estar, com atendimento tranquilo.',
    );
  }

  if (_containsAny(normalized, const [
    'massag',
    'drenagem',
    'depila',
    'corporal',
    'relax',
    'podolog',
    'modeladora',
  ])) {
    return const ServiceCategoryVisual(
      icon: Icons.self_improvement_rounded,
      fallbackDescription:
          'Sessão reservada para autocuidado corporal, relaxamento e conforto.',
    );
  }

  if (_containsAny(normalized, const [
    'cabelo',
    'corte',
    'escova',
    'penteado',
    'progressiva',
    'mecha',
    'luzes',
    'colora',
    'barba',
    'fade',
    'degrade',
  ])) {
    return const ServiceCategoryVisual(
      icon: Icons.content_cut_rounded,
      fallbackDescription:
          'Atendimento com tempo reservado para cabelo, barba e finalização, sem correria.',
    );
  }

  return const ServiceCategoryVisual(
    icon: Icons.auto_awesome_rounded,
    fallbackDescription:
        'Atendimento reservado com horário dedicado e experiência mais tranquila para você.',
  );
}

bool _containsAny(String source, List<String> terms) {
  for (final term in terms) {
    if (source.contains(term)) {
      return true;
    }
  }

  return false;
}

String _normalizeCategoryText(String value) {
  return value
      .toLowerCase()
      .replaceAll('á', 'a')
      .replaceAll('à', 'a')
      .replaceAll('ã', 'a')
      .replaceAll('â', 'a')
      .replaceAll('ä', 'a')
      .replaceAll('é', 'e')
      .replaceAll('è', 'e')
      .replaceAll('ê', 'e')
      .replaceAll('ë', 'e')
      .replaceAll('í', 'i')
      .replaceAll('ì', 'i')
      .replaceAll('î', 'i')
      .replaceAll('ï', 'i')
      .replaceAll('ó', 'o')
      .replaceAll('ò', 'o')
      .replaceAll('õ', 'o')
      .replaceAll('ô', 'o')
      .replaceAll('ö', 'o')
      .replaceAll('ú', 'u')
      .replaceAll('ù', 'u')
      .replaceAll('û', 'u')
      .replaceAll('ü', 'u')
      .replaceAll('ç', 'c');
}
