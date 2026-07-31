import { describe, expect, it } from "vitest";

import { getDashboardLiveSyncSubscriptions } from "@/lib/dashboard-live-sync";

describe("dashboard live sync subscriptions", () => {
  it("scopes the main dashboard to the tables used by the home view", () => {
    const subscriptions = getDashboardLiveSyncSubscriptions("/dashboard");
    const tables = subscriptions.map((subscription) => subscription.table);

    expect(tables).toContain("salons");
    expect(tables).toContain("appointments");
    expect(tables).toContain("customers");
    expect(tables).toContain("services");
    expect(tables).toContain("staff_members");
    expect(tables).toContain("customer_tabs");
    expect(tables).toContain("customer_product_orders");
    expect(tables).toContain("salon_offers");
    expect(tables).toContain("customer_membership_requests");
    expect(tables).not.toContain("inventory_movements");
    expect(tables).not.toContain("salon_posts");
    expect(tables).not.toContain("customer_memberships");
    expect(tables).not.toContain("salon_referral_events");
    expect(tables).not.toContain("whatsapp_inbound_messages");
  });

  it("adds inbound WhatsApp sync only on the WhatsApp workspace", () => {
    const subscriptions = getDashboardLiveSyncSubscriptions(
      "/dashboard/whatsapp",
    );

    expect(
      subscriptions.some(
        (subscription) => subscription.table === "whatsapp_inbound_messages",
      ),
    ).toBe(true);
  });

  it("adds finance subscriptions only on finance workspaces", () => {
    const subscriptions =
      getDashboardLiveSyncSubscriptions("/dashboard/finance");

    expect(
      subscriptions.some(
        (subscription) => subscription.table === "appointment_payments",
      ),
    ).toBe(true);
    expect(
      subscriptions.some(
        (subscription) => subscription.table === "customer_tab_payments",
      ),
    ).toBe(true);
    expect(
      subscriptions.some(
        (subscription) => subscription.table === "salon_financial_transactions",
      ),
    ).toBe(true);
    expect(
      subscriptions.some(
        (subscription) => subscription.table === "salon_payables",
      ),
    ).toBe(true);
    expect(
      subscriptions.some(
        (subscription) => subscription.table === "salon_recurring_expenses",
      ),
    ).toBe(true);
    expect(
      subscriptions.some(
        (subscription) => subscription.table === "inventory_movements",
      ),
    ).toBe(false);
  });

  it("keeps the receipts workspace synced with finance tables", () => {
    const subscriptions = getDashboardLiveSyncSubscriptions(
      "/dashboard/gestao/pagamentos",
    );

    expect(
      subscriptions.some(
        (subscription) => subscription.table === "appointment_payments",
      ),
    ).toBe(true);
    expect(
      subscriptions.some(
        (subscription) => subscription.table === "customer_product_orders",
      ),
    ).toBe(true);
    expect(
      subscriptions.some(
        (subscription) => subscription.table === "customer_tab_payments",
      ),
    ).toBe(true);
    expect(
      subscriptions.some(
        (subscription) => subscription.table === "salon_cash_sessions",
      ),
    ).toBe(true);
  });

  it("keeps the agenda workspace focused on operational schedule changes", () => {
    const subscriptions = getDashboardLiveSyncSubscriptions(
      "/dashboard/gestao/agendamentos",
    );
    const tables = subscriptions.map((subscription) => subscription.table);

    expect(tables).toContain("salons");
    expect(tables).toContain("appointments");
    expect(tables).toContain("appointment_payments");
    expect(tables).toContain("services");
    expect(tables).toContain("staff_members");
    expect(tables).toContain("staff_blocks");
    expect(tables).not.toContain("customers");
    expect(tables).not.toContain("service_categories");
  });

  it("listens to inventory updates only on operations workspaces", () => {
    const subscriptions = getDashboardLiveSyncSubscriptions(
      "/dashboard/operations",
    );

    expect(
      subscriptions.some(
        (subscription) => subscription.table === "inventory_movements",
      ),
    ).toBe(true);
    expect(
      subscriptions.some(
        (subscription) => subscription.table === "customer_product_order_items",
      ),
    ).toBe(true);
    expect(
      subscriptions.some(
        (subscription) => subscription.table === "customer_tab_payments",
      ),
    ).toBe(false);
  });

  it("keeps client app sync focused on brand and engagement data", () => {
    const subscriptions = getDashboardLiveSyncSubscriptions(
      "/dashboard/client-app",
    );

    expect(
      subscriptions.some(
        (subscription) => subscription.table === "customer_push_tokens",
      ),
    ).toBe(true);
    expect(
      subscriptions.some(
        (subscription) => subscription.table === "salon_posts",
      ),
    ).toBe(true);
    expect(
      subscriptions.some(
        (subscription) => subscription.table === "appointment_payments",
      ),
    ).toBe(false);
  });
});
