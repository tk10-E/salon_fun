import 'package:supabase_flutter/supabase_flutter.dart';

import '../../core/network/network_guard.dart';
import '../../core/network/snapshot_read_cache.dart';
import '../shared/app_models.dart';
import '../shared/storage_asset_urls.dart';

class StoreRepository {
  StoreRepository({required this.client});

  final SupabaseClient? client;

  static const TransformOptions _catalogImageTransform = TransformOptions(
    width: 1440,
    height: 1440,
    quality: 100,
  );
  static const TransformOptions _orderImageTransform = TransformOptions(
    width: 320,
    height: 320,
    quality: 100,
  );
  static const _catalogCacheTtl = Duration(seconds: 75);
  static const _ordersCacheTtl = Duration(seconds: 20);
  static const _catalogCacheKey = 'store:catalog';
  static const _ordersCacheKey = 'store:orders';
  final SnapshotReadCache _cache = SnapshotReadCache();

  Future<List<StoreProduct>> fetchCatalog() async {
    final safeClient = client;
    if (safeClient == null) {
      return const [];
    }

    return _cache.read<List<StoreProduct>>(
      key: _catalogCacheKey,
      ttl: _catalogCacheTtl,
      loader: () async {
        final response = await runGuardedRead<dynamic>(
          () => safeClient.rpc(
            'get_customer_product_catalog',
            params: <String, dynamic>{'limit_count': 30},
          ),
        );

        return (response as List<dynamic>).map((entry) => jsonMap(entry)).map((
          map,
        ) {
          final imagePath = stringList(map['image_paths']).firstOrNull;
          return StoreProduct(
            id: stringValue(map['id']),
            name: stringValue(map['name']),
            brand: stringOrNull(map['brand']),
            description: stringOrNull(map['description']),
            price: doubleValue(map['retail_price']),
            stock: doubleValue(map['current_stock']),
            unit: stringOrNull(map['unit']) ?? 'un',
            maxPurchaseQuantity: intValue(map['max_purchase_quantity']),
            imageUrl: resolvePublicStorageAssetUrl(
              safeClient,
              bucket: 'inventory-products',
              assetPath: imagePath,
              transform: _catalogImageTransform,
            ),
            updatedAt: dateTimeOrNull(map['updated_at']),
          );
        }).toList(growable: false);
      },
    );
  }

  Future<List<StoreOrder>> fetchOrders() async {
    final safeClient = client;
    if (safeClient == null) {
      return const [];
    }

    return _cache.read<List<StoreOrder>>(
      key: _ordersCacheKey,
      ttl: _ordersCacheTtl,
      loader: () async {
        final response = await runGuardedRead<dynamic>(
          () => safeClient
              .from('customer_product_orders')
              .select(
                'id, order_number, status, total_items, subtotal_amount, created_at, confirmed_at, ready_at, completed_at, cancelled_at, cancellation_reason, notes, customer_product_order_items(id, product_name_snapshot, product_brand_snapshot, product_image_path, quantity, unit_price_snapshot, line_total_amount)',
              )
              .order('created_at', ascending: false)
              .limit(20),
        );

        return (response as List<dynamic>).map((entry) => jsonMap(entry)).map((
          map,
        ) {
          final items = jsonMapList(map['customer_product_order_items']).map((
            item,
          ) {
            final imagePath = stringOrNull(item['product_image_path']);
            return StoreOrderItem(
              id: stringValue(item['id']),
              productName: stringValue(item['product_name_snapshot']),
              brand: stringOrNull(item['product_brand_snapshot']),
              imageUrl: resolvePublicStorageAssetUrl(
                safeClient,
                bucket: 'inventory-products',
                assetPath: imagePath,
                transform: _orderImageTransform,
              ),
              quantity: intValue(item['quantity']),
              unitPrice: doubleValue(item['unit_price_snapshot']),
              lineTotal: doubleValue(item['line_total_amount']),
            );
          }).toList(growable: false);

          return StoreOrder(
            id: stringValue(map['id']),
            orderNumber: intValue(map['order_number']),
            status: stringOrNull(map['status']) ?? 'pending',
            totalItems: intValue(map['total_items']),
            subtotalAmount: doubleValue(map['subtotal_amount']),
            createdAt: dateTimeValue(map['created_at']) ?? DateTime.now(),
            confirmedAt: dateTimeOrNull(map['confirmed_at']),
            readyAt: dateTimeOrNull(map['ready_at']),
            completedAt: dateTimeOrNull(map['completed_at']),
            cancelledAt: dateTimeOrNull(map['cancelled_at']),
            cancellationReason: stringOrNull(map['cancellation_reason']),
            notes: stringOrNull(map['notes']),
            items: items,
          );
        }).toList(growable: false);
      },
    );
  }

  Future<StoreOrder> createOrder({
    required List<CartLine> items,
    String? notes,
  }) async {
    final safeClient = client;
    if (safeClient == null) {
      throw Exception('Supabase não configurado.');
    }
    if (items.isEmpty) {
      throw Exception('Escolha pelo menos um produto.');
    }

    final payload = items
        .map(
          (item) => <String, dynamic>{
            'product_id': item.product.id,
            'quantity': item.quantity,
          },
        )
        .toList();

    final response = await runGuardedWrite<dynamic>(
      () => safeClient.rpc(
        'create_customer_product_order',
        params: <String, dynamic>{
          'items_input': payload,
          'notes_input': notes?.trim(),
        },
      ),
    );

    final raw = (response as List<dynamic>).cast<dynamic>();
    final created = jsonMap(raw.firstOrNull);
    _cache.invalidate(_ordersCacheKey);
    _cache.invalidate(_catalogCacheKey);
    return StoreOrder(
      id: stringValue(created['order_id']),
      orderNumber: intValue(created['order_number']),
      status: stringOrNull(created['status']) ?? 'pending',
      totalItems: intValue(created['total_items']),
      subtotalAmount: doubleValue(created['subtotal_amount']),
      createdAt: dateTimeValue(created['created_at']) ?? DateTime.now(),
      confirmedAt: null,
      readyAt: null,
      completedAt: null,
      cancelledAt: null,
      cancellationReason: null,
      notes: notes?.trim().isEmpty == true ? null : notes?.trim(),
      items: items
          .map(
            (line) => StoreOrderItem(
              id: line.product.id,
              productName: line.product.name,
              brand: line.product.brand,
              imageUrl: line.product.imageUrl,
              quantity: line.quantity,
              unitPrice: line.product.price,
              lineTotal: line.subtotal,
            ),
          )
          .toList(),
    );
  }
}

extension<T> on List<T> {
  T? get firstOrNull => isEmpty ? null : first;
}
