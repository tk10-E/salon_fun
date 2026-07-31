import 'package:flutter/material.dart';

import '../../core/theme/app_theme.dart';
import '../../core/utils/formatters.dart';
import '../../core/widgets/salon_ui.dart';
import '../notifications/customer_notifications_controller.dart';
import '../shared/app_models.dart';
import 'store_repository.dart';

class StorePage extends StatefulWidget {
  const StorePage({
    super.key,
    required this.storeRepository,
    required this.notificationsController,
    required this.session,
  });

  final StoreRepository storeRepository;
  final CustomerNotificationsController notificationsController;
  final AppSession session;

  @override
  State<StorePage> createState() => _StorePageState();
}

class _StorePageState extends State<StorePage> {
  final TextEditingController _searchController = TextEditingController();

  bool _loading = true;
  bool _submitting = false;
  List<StoreProduct> _catalog = const [];
  List<StoreOrder> _orders = const [];
  final Map<String, CartLine> _cart = <String, CartLine>{};
  late int _lastStoreRevision;

  @override
  void initState() {
    super.initState();
    _lastStoreRevision = widget.notificationsController.storeRevision;
    widget.notificationsController.addListener(_handleSyncChange);
    _load();
  }

  @override
  void dispose() {
    widget.notificationsController.removeListener(_handleSyncChange);
    _searchController.dispose();
    super.dispose();
  }

  @override
  void didUpdateWidget(covariant StorePage oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.notificationsController != widget.notificationsController) {
      oldWidget.notificationsController.removeListener(_handleSyncChange);
      _lastStoreRevision = widget.notificationsController.storeRevision;
      widget.notificationsController.addListener(_handleSyncChange);
    }
  }

  void _handleSyncChange() {
    final revision = widget.notificationsController.storeRevision;
    if (_lastStoreRevision == revision || _loading || _submitting) {
      return;
    }

    _lastStoreRevision = revision;
    _load();
  }

  List<StoreProduct> get _filteredCatalog {
    final query = _searchController.text.trim().toLowerCase();
    if (query.isEmpty) {
      return _catalog;
    }

    return _catalog.where((product) {
      return product.name.toLowerCase().contains(query) ||
          (product.brand?.toLowerCase().contains(query) ?? false);
    }).toList();
  }

  List<CartLine> get _cartLines => _cart.values.toList();

  double get _cartTotal =>
      _cart.values.fold<double>(0, (sum, item) => sum + item.subtotal);

  int get _cartItems =>
      _cart.values.fold<int>(0, (sum, item) => sum + item.quantity);

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final results = await Future.wait<dynamic>([
        widget.storeRepository.fetchCatalog(),
        widget.storeRepository.fetchOrders(),
      ]);
      final nextCatalog = results[0] as List<StoreProduct>;
      final nextOrders = results[1] as List<StoreOrder>;
      final nextCart = _reconcileCartWithCatalog(_cart, nextCatalog);

      if (!mounted) {
        return;
      }

      setState(() {
        _catalog = nextCatalog;
        _orders = nextOrders;
        _cart
          ..clear()
          ..addAll(nextCart);
        _loading = false;
      });
    } catch (error) {
      if (!mounted) {
        return;
      }

      setState(() => _loading = false);
      ScaffoldMessenger.of(context)
        ..hideCurrentSnackBar()
        ..showSnackBar(
          SnackBar(content: Text('$error'.replaceFirst('Exception: ', ''))),
        );
    }
  }

  void _changeQuantity(StoreProduct product, int nextQuantity) {
    final maxOrderableQuantity = _maxOrderableQuantity(product);
    if (nextQuantity <= 0 || maxOrderableQuantity <= 0) {
      setState(() => _cart.remove(product.id));
      return;
    }

    final safeQuantity = _clampOrderQuantity(
      nextQuantity,
      maxOrderableQuantity,
    );
    setState(() {
      _cart[product.id] = CartLine(product: product, quantity: safeQuantity);
    });
  }

  Future<void> _checkout() async {
    final noteController = TextEditingController();
    final confirmed = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setModalState) {
            return Padding(
              padding: EdgeInsets.fromLTRB(
                20,
                8,
                20,
                salonBottomActionInset(context),
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const SectionTitle(
                    title: 'Fechar pedido',
                    subtitle: 'Revise os itens e envie para a equipe do salão.',
                  ),
                  const SizedBox(height: 16),
                  ..._cartLines.map(
                    (line) => Padding(
                      padding: const EdgeInsets.only(bottom: 10),
                      child: _OrderLine(line: line),
                    ),
                  ),
                  const SizedBox(height: 8),
                  TextField(
                    controller: noteController,
                    minLines: 2,
                    maxLines: 3,
                    decoration: const InputDecoration(
                      labelText: 'Observações do pedido',
                      hintText: 'Ex.: separar para retirada amanhã',
                    ),
                  ),
                  const SizedBox(height: 16),
                  AsyncButton(
                    label: 'Enviar pedido',
                    isBusy: _submitting,
                    icon: Icons.shopping_bag_rounded,
                    onPressed: () async {
                      setState(() => _submitting = true);
                      setModalState(() {});
                      try {
                        await widget.storeRepository.createOrder(
                          items: _cartLines,
                          notes: noteController.text,
                        );
                        if (!context.mounted) {
                          return;
                        }
                        Navigator.of(context).pop(true);
                      } catch (error) {
                        if (!context.mounted) {
                          return;
                        }
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(
                            content: Text(
                              '$error'.replaceFirst('Exception: ', ''),
                            ),
                          ),
                        );
                        setState(() => _submitting = false);
                        setModalState(() {});
                      }
                    },
                  ),
                ],
              ),
            );
          },
        );
      },
    );

    noteController.dispose();

    if (confirmed != true || !mounted) {
      return;
    }

    setState(() {
      _cart.clear();
      _submitting = false;
    });
    await _load();
    if (!mounted) {
      return;
    }
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Pedido enviado para o salão.')),
    );
  }

  @override
  Widget build(BuildContext context) {
    final preview = widget.session.landingData?.preview;
    final accent = parseHexColor(
      preview?.brandColor,
      fallback: AppTheme.accent,
    );
    final activeOrdersCount = _orders
        .where((order) => order.status != 'completed')
        .where((order) => order.status != 'cancelled')
        .length;
    final lowStockCount = _catalog
        .where((product) => product.stock <= 3)
        .length;
    final latestOrder = _orders.isEmpty ? null : _orders.first;
    final featuredCount = _filteredCatalog.where((product) {
      return product.imageUrl?.trim().isNotEmpty == true;
    }).length;

    return Scaffold(
      body: AppGradientBackground(
        accentColor: accent,
        backgroundImageUrl:
            preview?.galleryCoverImageUrl ?? preview?.heroImageUrl,
        bannerStyle: preview?.bannerStyle,
        child: SafeArea(
          child: Column(
            children: [
              Expanded(
                child: RefreshIndicator(
                  onRefresh: _load,
                  child: ListView(
                    padding: const EdgeInsets.fromLTRB(20, 16, 20, 18),
                    children: [
                      SalonPanel(
                        accent: accent,
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Wrap(
                              spacing: 8,
                              runSpacing: 8,
                              children: [
                                Pill(
                                  label: 'Loja premium',
                                  icon: Icons.auto_awesome_rounded,
                                  backgroundColor: accent.withValues(
                                    alpha: 0.12,
                                  ),
                                  foregroundColor: accent,
                                ),
                                Pill(
                                  label: '${_catalog.length} produtos',
                                  icon: Icons.inventory_2_rounded,
                                ),
                                if (latestOrder != null)
                                  Pill(
                                    label: 'Pedido #${latestOrder.orderNumber}',
                                    icon: Icons.receipt_long_rounded,
                                    backgroundColor: AppTheme.secondary
                                        .withValues(alpha: 0.08),
                                    foregroundColor: AppTheme.secondary,
                                  ),
                              ],
                            ),
                            const SizedBox(height: 18),
                            Text(
                              'Loja virtual do salão com cara de vitrine de verdade.',
                              style: Theme.of(context).textTheme.displaySmall,
                            ),
                            const SizedBox(height: 10),
                            Text(
                              'Produtos organizados, compra rápida e histórico claro em uma experiência mais polida e comercial.',
                              style: Theme.of(context).textTheme.bodyLarge,
                            ),
                            const SizedBox(height: 20),
                            _StoreMetricGrid(
                              children: [
                                _StoreMetricCard(
                                  icon: Icons.shopping_bag_rounded,
                                  label: 'Carrinho',
                                  value: '$_cartItems itens',
                                  support: _cartItems == 0
                                      ? 'Monte seu pedido'
                                      : formatCurrency(_cartTotal),
                                  tone: accent,
                                ),
                                _StoreMetricCard(
                                  icon: Icons.receipt_rounded,
                                  label: 'Pedidos ativos',
                                  value: '$activeOrdersCount',
                                  support: _orders.isEmpty
                                      ? 'Sem histórico ainda'
                                      : '${_orders.length} pedidos no histórico',
                                  tone: AppTheme.secondary,
                                ),
                                _StoreMetricCard(
                                  icon: Icons.local_fire_department_rounded,
                                  label: 'Vitrine forte',
                                  value: '$featuredCount',
                                  support: featuredCount == 0
                                      ? 'Produtos sem imagem por enquanto'
                                      : 'Produtos com mais apelo visual',
                                  tone: AppTheme.primary,
                                ),
                                _StoreMetricCard(
                                  icon: Icons.warning_amber_rounded,
                                  label: 'Baixo estoque',
                                  value: '$lowStockCount',
                                  support: lowStockCount == 0
                                      ? 'Reposição saudável'
                                      : 'Itens que merecem atenção',
                                  tone: AppTheme.accent,
                                ),
                              ],
                            ),
                            const SizedBox(height: 18),
                            TextField(
                              controller: _searchController,
                              onChanged: (_) => setState(() {}),
                              decoration: const InputDecoration(
                                labelText: 'Buscar produto',
                                hintText: 'Nome ou marca',
                                prefixIcon: Icon(Icons.search_rounded),
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 20),
                      const SectionTitle(
                        title: 'Pedidos recentes',
                        subtitle: 'O que já passou pela sua vitrine do app.',
                      ),
                      const SizedBox(height: 14),
                      if (_orders.isEmpty)
                        const EmptyStateCard(
                          title: 'Nenhum pedido ainda',
                          message:
                              'Adicione itens ao carrinho e o primeiro pedido aparece aqui.',
                          icon: Icons.shopping_bag_outlined,
                        )
                      else
                        SizedBox(
                          height: 208,
                          child: ListView.separated(
                            scrollDirection: Axis.horizontal,
                            itemCount: _orders.length,
                            separatorBuilder: (context, index) =>
                                const SizedBox(width: 12),
                            itemBuilder: (context, index) {
                              final order = _orders[index];
                              return SizedBox(
                                width: 270,
                                child: _OrderHighlightCard(
                                  order: order,
                                  accent: accent,
                                ),
                              );
                            },
                          ),
                        ),
                      const SizedBox(height: 20),
                      SectionTitle(
                        title: 'Catálogo em movimento',
                        subtitle: _loading
                            ? 'Carregando a vitrine do salão.'
                            : '${_filteredCatalog.length} itens prontos para compra com estoque e preço claros.',
                      ),
                      const SizedBox(height: 14),
                      if (_loading)
                        const Padding(
                          padding: EdgeInsets.symmetric(vertical: 40),
                          child: Center(child: CircularProgressIndicator()),
                        )
                      else if (_filteredCatalog.isEmpty)
                        const EmptyStateCard(
                          title: 'Nenhum produto encontrado',
                          message:
                              'Ajuste a busca ou aguarde a próxima reposição.',
                          icon: Icons.inventory_2_outlined,
                        )
                      else
                        LayoutBuilder(
                          builder: (context, constraints) {
                            final crossAxisCount = constraints.maxWidth >= 900
                                ? 4
                                : constraints.maxWidth >= 680
                                ? 3
                                : constraints.maxWidth >= 420
                                ? 2
                                : 1;
                            final itemWidth =
                                (constraints.maxWidth -
                                    ((crossAxisCount - 1) * 12)) /
                                crossAxisCount;
                            final itemHeight = itemWidth < 170
                                ? 482.0
                                : itemWidth < 320
                                ? 442.0
                                : 394.0;
                            final delegate =
                                SliverGridDelegateWithFixedCrossAxisCount(
                                  crossAxisCount: crossAxisCount,
                                  mainAxisSpacing: 12,
                                  crossAxisSpacing: 12,
                                  mainAxisExtent: itemHeight,
                                );

                            return GridView.builder(
                              shrinkWrap: true,
                              physics: const NeverScrollableScrollPhysics(),
                              itemCount: _filteredCatalog.length,
                              gridDelegate: delegate,
                              itemBuilder: (context, index) {
                                final product = _filteredCatalog[index];
                                final currentQuantity =
                                    _cart[product.id]?.quantity ?? 0;
                                return _StoreProductCard(
                                  product: product,
                                  accent: accent,
                                  quantity: currentQuantity,
                                  onChangeQuantity: (next) =>
                                      _changeQuantity(product, next),
                                );
                              },
                            );
                          },
                        ),
                    ],
                  ),
                ),
              ),
              if (_cart.isNotEmpty)
                Container(
                  padding: const EdgeInsets.fromLTRB(20, 12, 20, 16),
                  decoration: const BoxDecoration(
                    color: Colors.white,
                    border: Border(top: BorderSide(color: AppTheme.line)),
                  ),
                  child: SafeArea(
                    top: false,
                    child: Row(
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                '$_cartItems itens no carrinho',
                                style: Theme.of(context).textTheme.titleMedium,
                              ),
                              const SizedBox(height: 4),
                              Text(
                                formatCurrency(_cartTotal),
                                style: Theme.of(context).textTheme.bodySmall,
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: FilledButton.icon(
                            onPressed: _submitting ? null : _checkout,
                            icon: const Icon(Icons.shopping_bag_rounded),
                            label: const Text('Fechar pedido'),
                          ),
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

class _StoreMetricGrid extends StatelessWidget {
  const _StoreMetricGrid({required this.children});

  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final itemWidth = (constraints.maxWidth - 12) / 2;
        return Wrap(
          spacing: 12,
          runSpacing: 12,
          children: [
            for (final child in children)
              SizedBox(width: itemWidth, child: child),
          ],
        );
      },
    );
  }
}

class _StoreMetricCard extends StatelessWidget {
  const _StoreMetricCard({
    required this.icon,
    required this.label,
    required this.value,
    required this.support,
    required this.tone,
  });

  final IconData icon;
  final String label;
  final String value;
  final String support;
  final Color tone;

  @override
  Widget build(BuildContext context) {
    return SurfaceMetricCard(
      icon: icon,
      label: label,
      value: value,
      support: support,
      tone: tone,
    );
  }
}

class _OrderHighlightCard extends StatelessWidget {
  const _OrderHighlightCard({required this.order, required this.accent});

  final StoreOrder order;
  final Color accent;

  @override
  Widget build(BuildContext context) {
    final imageItem = _firstOrderItemWithImage(order);

    return SalonPanel(
      accent: _orderStatusTone(order.status, accent),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Pill(
                label: '#${order.orderNumber}',
                icon: Icons.receipt_long_rounded,
              ),
              const Spacer(),
              Pill(
                label: orderStatusLabel(order.status),
                backgroundColor: _orderStatusTone(
                  order.status,
                  accent,
                ).withValues(alpha: 0.14),
                foregroundColor:
                    _orderStatusTone(order.status, accent) == AppTheme.accent
                    ? AppTheme.ink
                    : _orderStatusTone(order.status, accent),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (imageItem != null) ...[
                _OrderProductThumbnail(
                  key: ValueKey('store-order-item-image-${imageItem.id}'),
                  item: imageItem,
                ),
                const SizedBox(width: 12),
              ],
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '${order.totalItems} itens • ${formatCurrency(order.subtotalAmount)}',
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.titleLarge,
                    ),
                    const SizedBox(height: 6),
                    Text(
                      formatCompactDateTime(order.createdAt),
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            order.items.isEmpty
                ? 'Pedido enviado pelo app.'
                : order.items
                      .take(3)
                      .map((item) => item.productName)
                      .join(' • '),
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: Theme.of(context).textTheme.bodySmall,
          ),
          if (order.notes?.trim().isNotEmpty == true) ...[
            const SizedBox(height: 12),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppTheme.panel,
                borderRadius: BorderRadius.circular(18),
                border: Border.all(color: AppTheme.line),
              ),
              child: Text(
                order.notes!,
                style: Theme.of(context).textTheme.bodySmall,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ],
        ],
      ),
    );
  }
}

StoreOrderItem? _firstOrderItemWithImage(StoreOrder order) {
  for (final item in order.items) {
    if (item.imageUrl?.trim().isNotEmpty == true) {
      return item;
    }
  }

  return null;
}

class _OrderProductThumbnail extends StatelessWidget {
  const _OrderProductThumbnail({super.key, required this.item});

  final StoreOrderItem item;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      image: true,
      label: 'Produto comprado: ${item.productName}',
      child: SizedBox(
        width: 54,
        child: NetworkCardImage(
          imageUrl: item.imageUrl,
          height: 54,
          borderRadius: 16,
        ),
      ),
    );
  }
}

class _StoreCatalogImage extends StatelessWidget {
  const _StoreCatalogImage({
    required this.imageUrl,
    required this.height,
    required this.borderRadius,
  });

  final String? imageUrl;
  final double height;
  final double borderRadius;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final spec = AppTheme.spec(context);
    final hasImage = imageUrl != null && imageUrl!.trim().isNotEmpty;

    return ClipRRect(
      borderRadius: BorderRadius.circular(borderRadius),
      child: SizedBox(
        height: height,
        width: double.infinity,
        child: !hasImage
            ? DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [
                      spec.primaryColor.withValues(alpha: 0.18),
                      spec.secondaryColor.withValues(alpha: 0.1),
                    ],
                  ),
                ),
                child: Center(
                  child: Icon(
                    Icons.shopping_bag_rounded,
                    size: 30,
                    color: spec.inkColor.withValues(alpha: 0.58),
                  ),
                ),
              )
            : ColoredBox(
                color: Colors.white,
                child: LayoutBuilder(
                  builder: (context, _) {
                    return Padding(
                      padding: const EdgeInsets.fromLTRB(4, 2, 4, 2),
                      child: SalonNetworkImage(
                        imageUrl: imageUrl!,
                        fit: BoxFit.contain,
                        alignment: Alignment.center,
                        backgroundColor: Colors.white,
                        cacheScale: 1.25,
                        error: Center(
                          child: Text(
                            'Imagem indisponível',
                            style: theme.textTheme.bodySmall,
                          ),
                        ),
                        placeholder: const Center(
                          child: CircularProgressIndicator(strokeWidth: 2.4),
                        ),
                      ),
                    );
                  },
                ),
              ),
      ),
    );
  }
}

class _StoreProductCard extends StatelessWidget {
  const _StoreProductCard({
    required this.product,
    required this.accent,
    required this.quantity,
    required this.onChangeQuantity,
  });

  final StoreProduct product;
  final Color accent;
  final int quantity;
  final ValueChanged<int> onChangeQuantity;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final spec = AppTheme.spec(context);
    final availableUnits = _availableStoreUnits(product.stock);
    final maxOrderableQuantity = _maxOrderableQuantity(product);
    final imageStageColor = theme.brightness == Brightness.dark
        ? spec.panelColor.withValues(alpha: 0.94)
        : Colors.white.withValues(alpha: 0.98);
    return SalonPanel(
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Stack(
            children: [
              Container(
                decoration: BoxDecoration(
                  color: imageStageColor,
                  borderRadius: BorderRadius.circular(18),
                  border: Border.all(color: spec.lineColor),
                ),
                padding: const EdgeInsets.all(6),
                child: _StoreCatalogImage(
                  imageUrl: product.imageUrl,
                  height: 176,
                  borderRadius: 14,
                ),
              ),
              Positioned(
                left: 8,
                top: 8,
                child: Pill(
                  label: _stockLabel(product.stock),
                  backgroundColor: _stockTone(
                    product.stock,
                  ).withValues(alpha: 0.88),
                  foregroundColor: _stockTone(product.stock) == AppTheme.accent
                      ? AppTheme.ink
                      : Colors.white,
                ),
              ),
              if (quantity > 0)
                Positioned(
                  right: 8,
                  top: 8,
                  child: Pill(
                    label: '$quantity no carrinho',
                    backgroundColor: accent.withValues(alpha: 0.9),
                    foregroundColor: Colors.white,
                  ),
                ),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            product.name,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: theme.textTheme.titleSmall,
          ),
          const SizedBox(height: 4),
          Text(
            product.brand ?? 'Curadoria do salão',
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: theme.textTheme.bodySmall,
          ),
          if (product.description?.trim().isNotEmpty == true) ...[
            const SizedBox(height: 8),
            Text(
              product.description!,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: theme.textTheme.bodySmall,
            ),
          ],
          const SizedBox(height: 10),
          Text(
            formatCurrency(product.price),
            style: theme.textTheme.titleLarge,
          ),
          const SizedBox(height: 4),
          Text(
            _stockCountLabel(product.stock, product.unit),
            style: theme.textTheme.bodySmall,
          ),
          const Spacer(),
          if (quantity == 0)
            SizedBox(
              width: double.infinity,
              child: FilledButton.icon(
                onPressed: availableUnits <= 0
                    ? null
                    : () => onChangeQuantity(1),
                icon: const Icon(Icons.add_shopping_cart_rounded),
                label: const Text('Adicionar'),
              ),
            )
          else
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
              decoration: BoxDecoration(
                color: AppTheme.panel,
                borderRadius: BorderRadius.circular(18),
                border: Border.all(color: AppTheme.line),
              ),
              child: Row(
                children: [
                  IconButton(
                    visualDensity: VisualDensity.compact,
                    onPressed: () => onChangeQuantity(quantity - 1),
                    icon: const Icon(Icons.remove_rounded),
                  ),
                  Expanded(
                    child: Text(
                      '$quantity',
                      textAlign: TextAlign.center,
                      style: theme.textTheme.titleMedium,
                    ),
                  ),
                  IconButton(
                    visualDensity: VisualDensity.compact,
                    onPressed: quantity >= maxOrderableQuantity
                        ? null
                        : () => onChangeQuantity(quantity + 1),
                    icon: const Icon(Icons.add_rounded),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

class _OrderLine extends StatelessWidget {
  const _OrderLine({required this.line});

  final CartLine line;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppTheme.panel,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: AppTheme.line),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  line.product.name,
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                const SizedBox(height: 4),
                Text(
                  '${line.quantity}x • ${formatCurrency(line.product.price)}',
                  style: Theme.of(context).textTheme.bodySmall,
                ),
              ],
            ),
          ),
          Text(
            formatCurrency(line.subtotal),
            style: Theme.of(context).textTheme.titleMedium,
          ),
        ],
      ),
    );
  }
}

Map<String, CartLine> _reconcileCartWithCatalog(
  Map<String, CartLine> currentCart,
  List<StoreProduct> catalog,
) {
  if (currentCart.isEmpty) {
    return const <String, CartLine>{};
  }

  final catalogById = {for (final product in catalog) product.id: product};
  final nextCart = <String, CartLine>{};

  for (final entry in currentCart.entries) {
    final latestProduct = catalogById[entry.key];
    if (latestProduct == null) {
      continue;
    }

    final maxOrderableQuantity = _maxOrderableQuantity(latestProduct);
    if (maxOrderableQuantity <= 0) {
      continue;
    }

    nextCart[entry.key] = CartLine(
      product: latestProduct,
      quantity: _clampOrderQuantity(entry.value.quantity, maxOrderableQuantity),
    );
  }

  return nextCart;
}

int _availableStoreUnits(double stock) {
  final availableUnits = stock.floor();
  return availableUnits < 0 ? 0 : availableUnits;
}

int _maxOrderableQuantity(StoreProduct product) {
  final availableUnits = _availableStoreUnits(product.stock);
  if (availableUnits <= 0 || product.maxPurchaseQuantity <= 0) {
    return 0;
  }

  return availableUnits < product.maxPurchaseQuantity
      ? availableUnits
      : product.maxPurchaseQuantity;
}

int _clampOrderQuantity(int quantity, int maxOrderableQuantity) {
  if (quantity <= 1) {
    return 1;
  }

  return quantity > maxOrderableQuantity ? maxOrderableQuantity : quantity;
}

String _stockCountLabel(double stock, String unit) {
  final normalizedUnit = unit.trim().isEmpty ? 'un' : unit.trim();
  final availableUnits = _availableStoreUnits(stock);

  if (availableUnits <= 0 && stock > 0) {
    return 'Estoque: menos de 1 $normalizedUnit disponível';
  }

  final availabilityLabel = availableUnits == 1 ? 'disponível' : 'disponíveis';
  return 'Estoque: $availableUnits $normalizedUnit $availabilityLabel';
}

String _stockLabel(double stock) {
  if (_availableStoreUnits(stock) <= 0) {
    return 'Indisponível';
  }
  if (_availableStoreUnits(stock) <= 3) {
    return 'Últimas unidades';
  }
  return 'Pronta entrega';
}

Color _stockTone(double stock) {
  if (_availableStoreUnits(stock) <= 0) {
    return AppTheme.mutedInk;
  }
  if (_availableStoreUnits(stock) <= 3) {
    return AppTheme.accent;
  }
  return AppTheme.secondary;
}

Color _orderStatusTone(String status, Color accent) {
  switch (status.trim().toLowerCase()) {
    case 'confirmed':
    case 'ready':
      return AppTheme.secondary;
    case 'completed':
      return accent;
    case 'cancelled':
      return AppTheme.mutedInk;
    default:
      return AppTheme.accent;
  }
}
