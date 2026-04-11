class AppNotificationItem {
  const AppNotificationItem({
    required this.id,
    required this.title,
    required this.body,
    required this.createdAt,
    required this.isRead,
    required this.isLocal,
    required this.sourceLabel,
    required this.targetTabIndex,
    required this.notificationType,
    required this.payload,
  });

  final String id;
  final String title;
  final String body;
  final DateTime createdAt;
  final bool isRead;
  final bool isLocal;
  final String sourceLabel;
  final int targetTabIndex;
  final String notificationType;
  final Map<String, dynamic> payload;

  AppNotificationItem copyWith({
    String? id,
    String? title,
    String? body,
    DateTime? createdAt,
    bool? isRead,
    bool? isLocal,
    String? sourceLabel,
    int? targetTabIndex,
    String? notificationType,
    Map<String, dynamic>? payload,
  }) {
    return AppNotificationItem(
      id: id ?? this.id,
      title: title ?? this.title,
      body: body ?? this.body,
      createdAt: createdAt ?? this.createdAt,
      isRead: isRead ?? this.isRead,
      isLocal: isLocal ?? this.isLocal,
      sourceLabel: sourceLabel ?? this.sourceLabel,
      targetTabIndex: targetTabIndex ?? this.targetTabIndex,
      notificationType: notificationType ?? this.notificationType,
      payload: payload ?? this.payload,
    );
  }
}
