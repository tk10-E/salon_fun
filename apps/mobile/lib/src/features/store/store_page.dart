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
    final results = await Future.wait<dynamic>([
      widget.storeRepository.fetchCatalog(),
      widget.storeRepository.fetchOrders(),
    ]);

    if (!mounted) {
      return;
    }

    setState(() {
      _catalog = results[0] as List<StoreProduct>;
      _orders = results[1] as List<StoreOrder>;
      _loading = false;
    });
  }

  void _changeQuantity(StoreProduct product, int nextQuantity) {
    if (nextQuantity <= 0) {
      setState(() => _cart.remove(product.id));
      return;
    }

    final safeQuantity = nextQuantity.clamp(1, product.maxPurchaseQuantity);
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
                20 + MediaQuery.of(context).viewInsets.bottom,
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
                        GridView.builder(
                          shrinkWrap: true,
                          physics: const NeverScrollableScrollPhysics(),
                          itemCount: _filteredCatalog.length,
                          gridDelegate:
                              const SliverGridDelegateWithMaxCrossAxisExtent(
                                maxCrossAxisExtent: 240,
                                mainAxisSpacing: 12,
                                crossAxisSpacing: 12,
                                mainAxisExtent: 334,
                              ),
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
          const SizedBox(height: 14),
          Text(
            '${order.totalItems} itens • ${formatCurrency(order.subtotalAmount)}',
            style: Theme.of(context).textTheme.titleLarge,
          ),
          const SizedBox(height: 6),
          Text(
            formatCompactDateTime(order.createdAt),
            style: Theme.of(context).textTheme.bodySmall,
          ),
          const SizedBox(height: 12),
          Text(
            order.items.isEmpty
                ? 'Pedido enviado pelo app.'
                : order.items
                      .take(3)
                      .map((item) => item.productName)
                      .join(' • '),
            maxLines: 3,
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
    return SalonPanel(
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Stack(
            children: [
              NetworkCardImage(
                imageUrl: product.imageUrl,
                height: 124,
                borderRadius: 18,
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
            'Estoque: ${product.stock.toStringAsFixed(0)} ${product.unit}',
            style: theme.textTheme.bodySmall,
          ),
          const Spacer(),
          if (quantity == 0)
            SizedBox(
              width: double.infinity,
              child: FilledButton.icon(
                onPressed: product.stock <= 0
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
                    onPressed:
                        quantity >= product.maxPurchaseQuantity ||
                            quantity >= product.stock
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

String _stockLabel(double stock) {
  if (stock <= 0) {
    return 'Indisponível';
  }
  if (stock <= 3) {
    return 'Últimas unidades';
  }
  return 'Pronta entrega';
}

Color _stockTone(double stock) {
  if (stock <= 0) {
    return AppTheme.mutedInk;
  }
  if (stock <= 3) {
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
