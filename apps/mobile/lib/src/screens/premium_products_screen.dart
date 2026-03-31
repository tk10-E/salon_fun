import 'package:flutter/material.dart';

import '../theme/design_tokens.dart';
import '../theme/salon_brand_config.dart';
import '../theme/salon_branding.dart';
import '../widgets/app_backdrop.dart';
import '../widgets/premium_banner.dart';
import '../widgets/premium_empty_state.dart';
import '../widgets/premium_product_card.dart';
import '../widgets/premium_section_header.dart';
import '../widgets/salon_brand_mark.dart';

class PremiumProductsScreen extends StatelessWidget {
  const PremiumProductsScreen({
    super.key,
    required this.salonName,
    required this.branding,
    this.heroImageUrl,
    this.heroTabletImageUrl,
    this.products = const <PremiumProductItem>[],
  });

  final String salonName;
  final SalonBranding branding;
  final String? heroImageUrl;
  final String? heroTabletImageUrl;
  final List<PremiumProductItem> products;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Produtos')),
      body: AppBackdrop(
        branding: branding,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
          children: [
            PremiumBanner(
              eyebrow: salonName,
              title: 'Vitrine premium de produtos',
              subtitle:
                  'Kits, combos e recomendacoes com acabamento comercial forte para marcas white-label.',
              imageUrl: heroImageUrl,
              tabletImageUrl: heroTabletImageUrl,
              leading: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  SalonBrandMark(
                    salonName: salonName,
                    branding: branding,
                    size: 56,
                    borderRadius: 18,
                    showBorder: false,
                  ),
                  const SizedBox(width: PremiumSpacing.sm),
                  Text(
                    '${products.length} itens',
                    style: Theme.of(context).textTheme.labelLarge?.copyWith(
                      color: Colors.white,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: PremiumSpacing.xl),
            if (products.isEmpty)
              const PremiumEmptyState(
                eyebrow: 'Catalogo em breve',
                title: 'A vitrine de produtos entra aqui',
                message:
                    'Use `featuredProducts` no tenant para ativar kits, combos e recomendacoes sem mudar o layout base.',
                icon: Icons.shopping_bag_outlined,
              )
            else ...[
              const PremiumSectionHeader(
                eyebrow: 'Curadoria',
                title: 'Produtos recomendados',
                subtitle: 'Retail bonito, comercial e coerente com a marca.',
              ),
              const SizedBox(height: PremiumSpacing.md),
              GridView.builder(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: 2,
                  mainAxisSpacing: PremiumSpacing.md,
                  crossAxisSpacing: PremiumSpacing.md,
                  childAspectRatio: 0.64,
                ),
                itemCount: products.length,
                itemBuilder: (context, index) {
                  final product = products[index];
                  return PremiumProductCard(
                    title: product.name,
                    subtitle: product.subtitle,
                    priceLabel: product.priceLabel,
                    imageUrl: product.imageUrl,
                    badge: product.badge,
                  );
                },
              ),
            ],
          ],
        ),
      ),
    );
  }
}
