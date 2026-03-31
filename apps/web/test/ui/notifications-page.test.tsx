// @vitest-environment jsdom

import { createElement, type ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  createClientMock,
  deleteSalonNotificationActionMock,
  requireOwnerSalonMock,
} = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  deleteSalonNotificationActionMock: vi.fn(),
  requireOwnerSalonMock: vi.fn(),
}));

vi.mock("next/link", () => ({
  default: (props: { children?: ReactNode; href: string; className?: string }) =>
    createElement("a", { href: props.href, className: props.className }, props.children),
}));

vi.mock("@/app/actions", () => ({
  deleteSalonNotificationAction: deleteSalonNotificationActionMock,
}));

vi.mock("@/lib/auth", () => ({
  requireOwnerSalon: requireOwnerSalonMock,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: createClientMock,
}));

import NotificationsPage from "@/app/dashboard/notifications/page";

function createListQuery(data: unknown) {
  const query = {
    eq: vi.fn(() => query),
    order: vi.fn(() => query),
    range: vi.fn().mockResolvedValue({ data, error: null }),
    or: vi.fn(() => query),
    gte: vi.fn(() => query),
    lte: vi.fn(() => query),
    in: vi.fn(() => query),
    not: vi.fn(() => query),
  };

  return query;
}

describe("notifications page UI", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireOwnerSalonMock.mockResolvedValue({
      salon: {
        id: "salon-1",
        join_code: "ABCD1234",
      },
    });
  });

  it("renders delivery readiness, push reach and the notification history", async () => {
    const listQuery = createListQuery([
      {
        id: "notification-1",
        audience: "salon_customers",
        notification_type: "promotion_published",
        title: "Novidade VIP",
        body: "Cashback dobrado até sexta.",
        created_at: "2026-03-30T12:00:00.000Z",
        customer_id: null,
        customers: null,
      },
    ]);
    const notificationCountQuery = {
      count: 32,
      error: null,
      eq: vi.fn((column: string, value: string) => {
        if (column === "audience" && value === "salon_customers") {
          return { count: 24, error: null };
        }

        if (column === "audience" && value === "single_customer") {
          return { count: 8, error: null };
        }

        return notificationCountQuery;
      }),
      gte: vi.fn().mockResolvedValue({ count: 18, error: null }),
      or: vi.fn(() => notificationCountQuery),
      lte: vi.fn(() => notificationCountQuery),
      in: vi.fn(() => notificationCountQuery),
      not: vi.fn(() => notificationCountQuery),
    };
    const pushTokensQuery = {
      count: 12,
      error: null,
      gte: vi.fn().mockResolvedValue({ count: 9, error: null }),
    };

    createClientMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "salon_customer_notifications") {
          return {
            select: vi.fn((columns: string, options?: { head?: boolean }) => {
              if (options?.head) {
                return {
                  eq: vi.fn(() => notificationCountQuery),
                };
              }

              if (columns.includes("customers(name)")) {
                return {
                  eq: vi.fn(() => listQuery),
                };
              }

              throw new Error(`Unexpected select on ${table}: ${columns}`);
            }),
          };
        }

        if (table === "customer_push_tokens") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => pushTokensQuery),
              })),
            })),
          };
        }

        if (table === "salon_growth_automation_settings") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: {
                    is_active: true,
                    smart_rebook_is_active: true,
                    updated_at: "2026-03-25T15:00:00.000Z",
                  },
                  error: null,
                }),
              })),
            })),
          };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
      rpc: vi.fn((name: string) => {
        if (name !== "get_salon_notification_dispatch_snapshot") {
          throw new Error(`Unexpected rpc ${name}`);
        }

        return Promise.resolve({
          data: [
            {
              notification_id: "notification-1",
              status: "delivered",
              sent_count: 12,
              failed_count: 0,
              deactivated_count: 0,
              response_status: 200,
              error_detail: null,
              updated_at: "2026-03-30T12:01:00.000Z",
            },
          ],
          error: null,
        });
      }),
    });

    const ui = await NotificationsPage({});

    render(ui);

    expect(
      screen.getByRole("heading", { name: "Histórico de push com leitura clara de entrega, público e ruído." }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "O que já sustenta alcance e recorrência" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Dispositivos ativos")).toBeInTheDocument();
    expect(screen.getByText("Automação comercial")).toBeInTheDocument();
    expect(screen.getByText("Novidade VIP")).toBeInTheDocument();
    expect(screen.getByText("Cashback dobrado até sexta.")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Retenção automática" }),
    ).toHaveAttribute("href", "/dashboard/benefits/automations");
    expect(
      screen.getByRole("link", { name: "Ajustar app" }),
    ).toHaveAttribute("href", "/dashboard/settings");
  });
});
