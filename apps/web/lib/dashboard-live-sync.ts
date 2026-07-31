export type DashboardLiveSyncSubscription = {
  table: string;
  filterColumn?: string;
};

const SALON_FILTER = "salon_id";

const SALON_SCOPED_TABLES = {
  appointmentPayments: {
    table: "appointment_payments",
    filterColumn: SALON_FILTER,
  },
  appointments: { table: "appointments", filterColumn: SALON_FILTER },
  customerMembershipRedemptions: {
    table: "customer_membership_redemptions",
    filterColumn: SALON_FILTER,
  },
  customerMembershipRequests: {
    table: "customer_membership_requests",
    filterColumn: SALON_FILTER,
  },
  customerMemberships: {
    table: "customer_memberships",
    filterColumn: SALON_FILTER,
  },
  customerProductOrderItems: {
    table: "customer_product_order_items",
    filterColumn: SALON_FILTER,
  },
  customerProductOrders: {
    table: "customer_product_orders",
    filterColumn: SALON_FILTER,
  },
  customerPushTokens: {
    table: "customer_push_tokens",
    filterColumn: SALON_FILTER,
  },
  customerReferralEvents: {
    table: "salon_referral_events",
    filterColumn: SALON_FILTER,
  },
  customerReferralRewardUnlocks: {
    table: "salon_referral_reward_unlocks",
    filterColumn: SALON_FILTER,
  },
  customerTabPayments: {
    table: "customer_tab_payments",
    filterColumn: SALON_FILTER,
  },
  customerTabs: { table: "customer_tabs", filterColumn: SALON_FILTER },
  customers: { table: "customers", filterColumn: SALON_FILTER },
  inventoryMovements: {
    table: "inventory_movements",
    filterColumn: SALON_FILTER,
  },
  inventoryProducts: {
    table: "inventory_products",
    filterColumn: SALON_FILTER,
  },
  loyaltyPrograms: {
    table: "salon_loyalty_programs",
    filterColumn: SALON_FILTER,
  },
  loyaltyTransactions: {
    table: "customer_loyalty_transactions",
    filterColumn: SALON_FILTER,
  },
  notifications: {
    table: "salon_customer_notifications",
    filterColumn: SALON_FILTER,
  },
  offers: { table: "salon_offers", filterColumn: SALON_FILTER },
  posts: { table: "salon_posts", filterColumn: SALON_FILTER },
  referralPrograms: {
    table: "salon_referral_programs",
    filterColumn: SALON_FILTER,
  },
  salonCashSessions: {
    table: "salon_cash_sessions",
    filterColumn: SALON_FILTER,
  },
  salonFinancialTransactions: {
    table: "salon_financial_transactions",
    filterColumn: SALON_FILTER,
  },
  salonPayables: {
    table: "salon_payables",
    filterColumn: SALON_FILTER,
  },
  salonRecurringExpenses: {
    table: "salon_recurring_expenses",
    filterColumn: SALON_FILTER,
  },
  serviceCategories: {
    table: "service_categories",
    filterColumn: SALON_FILTER,
  },
  services: { table: "services", filterColumn: SALON_FILTER },
  staffBlocks: { table: "staff_blocks", filterColumn: SALON_FILTER },
  staffMembers: { table: "staff_members", filterColumn: SALON_FILTER },
  whatsappInboundMessages: {
    table: "whatsapp_inbound_messages",
    filterColumn: SALON_FILTER,
  },
} as const satisfies Record<string, DashboardLiveSyncSubscription>;

const ALWAYS_SUBSCRIPTIONS: DashboardLiveSyncSubscription[] = [
  { table: "salons", filterColumn: "id" },
];

const DASHBOARD_HOME_SUBSCRIPTIONS: DashboardLiveSyncSubscription[] = [
  SALON_SCOPED_TABLES.customers,
  SALON_SCOPED_TABLES.appointments,
  SALON_SCOPED_TABLES.services,
  SALON_SCOPED_TABLES.staffMembers,
  SALON_SCOPED_TABLES.customerTabs,
  SALON_SCOPED_TABLES.customerProductOrders,
  SALON_SCOPED_TABLES.offers,
  SALON_SCOPED_TABLES.customerMembershipRequests,
];

const MANAGEMENT_SUBSCRIPTIONS: DashboardLiveSyncSubscription[] = [
  SALON_SCOPED_TABLES.customers,
  SALON_SCOPED_TABLES.appointments,
  SALON_SCOPED_TABLES.services,
  SALON_SCOPED_TABLES.serviceCategories,
  SALON_SCOPED_TABLES.staffMembers,
  SALON_SCOPED_TABLES.staffBlocks,
];

const APPOINTMENTS_WORKSPACE_SUBSCRIPTIONS: DashboardLiveSyncSubscription[] = [
  SALON_SCOPED_TABLES.appointments,
  SALON_SCOPED_TABLES.appointmentPayments,
  SALON_SCOPED_TABLES.services,
  SALON_SCOPED_TABLES.staffMembers,
  SALON_SCOPED_TABLES.staffBlocks,
];

const OPERATIONS_SUBSCRIPTIONS: DashboardLiveSyncSubscription[] = [
  SALON_SCOPED_TABLES.inventoryProducts,
  SALON_SCOPED_TABLES.inventoryMovements,
  SALON_SCOPED_TABLES.customerProductOrders,
  SALON_SCOPED_TABLES.customerProductOrderItems,
  SALON_SCOPED_TABLES.appointments,
  SALON_SCOPED_TABLES.staffMembers,
];

const CLIENT_APP_SUBSCRIPTIONS: DashboardLiveSyncSubscription[] = [
  SALON_SCOPED_TABLES.services,
  SALON_SCOPED_TABLES.posts,
  SALON_SCOPED_TABLES.notifications,
  SALON_SCOPED_TABLES.customerPushTokens,
  SALON_SCOPED_TABLES.offers,
];

const BENEFITS_SUBSCRIPTIONS: DashboardLiveSyncSubscription[] = [
  SALON_SCOPED_TABLES.offers,
  SALON_SCOPED_TABLES.notifications,
  SALON_SCOPED_TABLES.loyaltyPrograms,
  SALON_SCOPED_TABLES.loyaltyTransactions,
  SALON_SCOPED_TABLES.customerMemberships,
  SALON_SCOPED_TABLES.customerMembershipRequests,
  SALON_SCOPED_TABLES.customerMembershipRedemptions,
  SALON_SCOPED_TABLES.referralPrograms,
  SALON_SCOPED_TABLES.customerReferralEvents,
  SALON_SCOPED_TABLES.customerReferralRewardUnlocks,
];

const FINANCE_SUBSCRIPTIONS: DashboardLiveSyncSubscription[] = [
  SALON_SCOPED_TABLES.appointments,
  SALON_SCOPED_TABLES.appointmentPayments,
  SALON_SCOPED_TABLES.customerTabs,
  SALON_SCOPED_TABLES.customerTabPayments,
  SALON_SCOPED_TABLES.customerProductOrders,
  SALON_SCOPED_TABLES.salonCashSessions,
  SALON_SCOPED_TABLES.salonFinancialTransactions,
  SALON_SCOPED_TABLES.salonPayables,
  SALON_SCOPED_TABLES.salonRecurringExpenses,
];

const FEED_SUBSCRIPTIONS: DashboardLiveSyncSubscription[] = [
  SALON_SCOPED_TABLES.posts,
  SALON_SCOPED_TABLES.services,
];

const WHATSAPP_SUBSCRIPTIONS: DashboardLiveSyncSubscription[] = [
  SALON_SCOPED_TABLES.whatsappInboundMessages,
  SALON_SCOPED_TABLES.customers,
  SALON_SCOPED_TABLES.appointments,
];


const NOTIFICATIONS_SUBSCRIPTIONS: DashboardLiveSyncSubscription[] = [
  SALON_SCOPED_TABLES.notifications,
  SALON_SCOPED_TABLES.customers,
];

const ROUTE_SUBSCRIPTIONS: Array<{
  match: (pathname: string) => boolean;
  subscriptions: DashboardLiveSyncSubscription[];
}> = [
  {
    match: (pathname) => pathname === "/dashboard",
    subscriptions: DASHBOARD_HOME_SUBSCRIPTIONS,
  },
  {
    match: (pathname) =>
      pathname.startsWith("/dashboard/gestao/agendamentos") ||
      pathname.startsWith("/dashboard/appointments"),
    subscriptions: APPOINTMENTS_WORKSPACE_SUBSCRIPTIONS,
  },
  {
    match: (pathname) =>
      (pathname.startsWith("/dashboard/gestao") &&
        !pathname.startsWith("/dashboard/gestao/agendamentos") &&
        !pathname.startsWith("/dashboard/gestao/pagamentos")) ||
      pathname.startsWith("/dashboard/customers") ||
      pathname.startsWith("/dashboard/services") ||
      pathname.startsWith("/dashboard/team"),
    subscriptions: MANAGEMENT_SUBSCRIPTIONS,
  },
  {
    match: (pathname) => pathname.startsWith("/dashboard/gestao/pagamentos"),
    subscriptions: FINANCE_SUBSCRIPTIONS,
  },
  {
    match: (pathname) =>
      pathname.startsWith("/dashboard/operations") ||
      pathname.startsWith("/dashboard/inventory"),
    subscriptions: OPERATIONS_SUBSCRIPTIONS,
  },
  {
    match: (pathname) => pathname.startsWith("/dashboard/client-app"),
    subscriptions: CLIENT_APP_SUBSCRIPTIONS,
  },
  {
    match: (pathname) =>
      pathname.startsWith("/dashboard/benefits") ||
      pathname.startsWith("/dashboard/subscriptions"),
    subscriptions: BENEFITS_SUBSCRIPTIONS,
  },
  {
    match: (pathname) => pathname.startsWith("/dashboard/finance"),
    subscriptions: FINANCE_SUBSCRIPTIONS,
  },
  {
    match: (pathname) => pathname.startsWith("/dashboard/feed"),
    subscriptions: FEED_SUBSCRIPTIONS,
  },
  {
    match: (pathname) => pathname.startsWith("/dashboard/whatsapp"),
    subscriptions: WHATSAPP_SUBSCRIPTIONS,
  },
  {
    match: (pathname) => pathname.startsWith("/dashboard/notifications"),
    subscriptions: NOTIFICATIONS_SUBSCRIPTIONS,
  },
];

export function getDashboardLiveSyncSubscriptions(
  pathname: string | null | undefined,
) {
  const normalizedPathname = normalizeDashboardPath(pathname);
  const subscriptions = [...ALWAYS_SUBSCRIPTIONS];

  for (const routeConfig of ROUTE_SUBSCRIPTIONS) {
    if (routeConfig.match(normalizedPathname)) {
      subscriptions.push(...routeConfig.subscriptions);
    }
  }

  const deduped = new Map<string, DashboardLiveSyncSubscription>();
  for (const subscription of subscriptions) {
    const key = `${subscription.table}:${subscription.filterColumn ?? ""}`;
    deduped.set(key, subscription);
  }

  return [...deduped.values()];
}

function normalizeDashboardPath(pathname: string | null | undefined) {
  const normalized = pathname?.trim();
  if (!normalized) {
    return "/dashboard";
  }

  return normalized;
}
