// @vitest-environment jsdom

import { createElement, type ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  createAdminClientMock,
  createClientMock,
  requireOwnerSalonMock,
  saveSalonMonthlyTargetsActionPath,
  saveStaffCommissionSettingsActionPath,
  updateCustomerProductOrderStatusActionPath,
} = vi.hoisted(() => ({
  createAdminClientMock: vi.fn(),
  createClientMock: vi.fn(),
  requireOwnerSalonMock: vi.fn(),
  saveSalonMonthlyTargetsActionPath: "/__test/save-salon-monthly-targets",
  saveStaffCommissionSettingsActionPath: "/__test/save-staff-commission",
  updateCustomerProductOrderStatusActionPath: "/__test/update-store-order-status",
}));

vi.mock("next/link", () => ({
  default: (props: {
    children?: ReactNode;
    href: string;
    className?: string;
  }) =>
    createElement(
      "a",
      { href: props.href, className: props.className },
      props.children,
    ),
}));

vi.mock("@/app/actions", () => ({
  saveSalonMonthlyTargetsAction: saveSalonMonthlyTargetsActionPath,
  saveStaffCommissionSettingsAction: saveStaffCommissionSettingsActionPath,
  updateCustomerProductOrderStatusAction:
    updateCustomerProductOrderStatusActionPath,
}));

vi.mock("@/lib/auth", () => ({
  requireOwnerSalon: requireOwnerSalonMock,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: createClientMock,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: createAdminClientMock,
}));

import OperationsPage from "@/app/dashboard/operations/page";

describe("operations page UI", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireOwnerSalonMock.mockResolvedValue({
      salon: {
        id: "salon-1",
        booking_policy_auto_cancel_lead_minutes: 10,
        booking_policy_auto_cancel_pending_deposit: true,
        booking_policy_auto_cancel_unconfirmed: true,
        booking_policy_auto_confirm_new_appointments: true,
        booking_policy_confirmation_required: true,
        booking_policy_enabled: true,
        booking_policy_requires_deposit: true,
        client_app_config: {
          autoPilotEnabled: true,
        },
      },
    });
    createAdminClientMock.mockReturnValue({
      schema: vi.fn(() => ({
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            in: vi.fn().mockResolvedValue({
              data: [
                {
                  key: "operations_autopilot_job_url",
                  value:
                    "https://panel.example.com/api/internal/operations/autopilot",
                },
                {
                  key: "operations_autopilot_job_secret",
                  value: "secret",
                },
              ],
              error: null,
            }),
          })),
        })),
      })),
    });
  });

  it("renders the redesigned operations workspace with real store order actions", async () => {
    const storageFrom = vi.fn(() => ({
      getPublicUrl: vi.fn((path: string) => ({
        data: { publicUrl: `https://cdn.example.com/${path}` },
      })),
    }));

    createClientMock.mockReturnValue({
      rpc: vi.fn((name: string) => {
        if (name !== "get_owner_operations_dashboard") {
          throw new Error(`Unexpected rpc ${name}`);
        }

        return Promise.resolve({
          data: {
            overview: {
              active_inventory_products: 3,
              active_staff_members: 2,
              average_ticket: 95,
              estimated_commissions: 180,
              low_stock_products: 1,
              top_staff_name: "Ana",
              top_staff_revenue: 780,
              total_revenue: 1520,
            },
            daily_revenue: [
              {
                day: "2026-03-21",
                completed_appointments: 4,
                total_revenue: 420,
              },
            ],
            top_staff: [
              {
                id: "staff-1",
                name: "Ana",
                role: "Cabelo",
                is_active: true,
                completed_appointments: 8,
                total_revenue: 780,
                estimated_commission: 234,
                commission_rate_percent: 30,
                commission_flat_fee: 0,
                upcoming_appointments: 3,
                pending_appointments: 1,
                next_appointment_at: "2026-03-23T14:00:00.000Z",
                assigned_services: 5,
              },
            ],
            staff_agenda: [
              {
                id: "staff-1",
                name: "Ana",
                role: "Cabelo",
                is_active: true,
                assigned_services: 5,
                upcoming_appointments: 3,
                pending_appointments: 1,
                next_appointment_at: "2026-03-23T14:00:00.000Z",
                commission_rate_percent: 30,
                commission_flat_fee: 0,
              },
            ],
          },
          error: null,
        });
      }),
      from: vi.fn((table: string) => {
        if (table === "inventory_products") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                order: vi.fn().mockResolvedValue({
                  data: [
                    {
                      id: "product-1",
                      name: "Shampoo reconstrutor",
                      image_paths: ["salon-1/product-1.webp"],
                      unit: "un",
                      current_stock: 1,
                      minimum_stock: 2,
                      retail_price: 44.9,
                    },
                  ],
                  error: null,
                }),
              })),
            })),
          };
        }

        if (table === "inventory_movements") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                order: vi.fn(() => ({
                  limit: vi.fn().mockResolvedValue({
                    data: [
                      {
                        id: "movement-1",
                        movement_type: "out",
                        quantity: 1,
                        previous_stock: 2,
                        resulting_stock: 1,
                        reason: "Uso no atendimento",
                        created_at: "2026-03-22T13:00:00.000Z",
                        inventory_products: { name: "Shampoo reconstrutor" },
                        staff_members: { name: "Ana" },
                      },
                    ],
                    error: null,
                  }),
                })),
              })),
            })),
          };
        }

        if (table === "customer_product_orders") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                order: vi.fn(() => ({
                  limit: vi.fn().mockResolvedValue({
                    data: [
                      {
                        id: "order-1",
                        order_number: 204,
                        status: "pending",
                        total_items: 3,
                        subtotal_amount: 134.7,
                        notes: "Separar para retirada na recepcao.",
                        cancellation_reason: null,
                        created_at: "2026-04-04T10:00:00.000Z",
                        confirmed_at: null,
                        ready_at: null,
                        completed_at: null,
                        cancelled_at: null,
                        customers: { name: "Ana", phone: "11988887777" },
                        customer_product_order_items: [
                          {
                            id: "order-item-1",
                            product_name_snapshot: "Shampoo reconstrutor",
                          },
                        ],
                      },
                    ],
                    error: null,
                  }),
                })),
              })),
            })),
          };
        }

        if (table === "appointments") {
          return {
            select: vi.fn((columns: string) => ({
              eq: vi.fn(() => ({
                eq:
                  columns === "customer_id, date"
                    ? vi.fn(() => ({
                        gte: vi.fn(() => ({
                          order: vi.fn(() => ({
                            limit: vi.fn().mockResolvedValue({
                              data: [
                                {
                                  customer_id: "customer-1",
                                  date: "2026-04-04T10:00:00.000Z",
                                },
                                {
                                  customer_id: "customer-1",
                                  date: "2026-03-05T10:00:00.000Z",
                                },
                              ],
                              error: null,
                            }),
                          })),
                        })),
                      }))
                    : undefined,
                in: columns.includes("customer_confirmation_requested_at")
                  ? vi.fn(() => ({
                      gte: vi.fn(() => ({
                        lt: vi.fn(() => ({
                          order: vi.fn(() => ({
                            limit: vi.fn().mockResolvedValue({
                              data: [
                                {
                                  id: "autopilot-1",
                                  date: "2026-04-04T10:00:00.000Z",
                                  ends_at: "2026-04-04T10:45:00.000Z",
                                  status: "confirmed",
                                  customer_confirmation_requested_at:
                                    "2026-04-04T08:00:00.000Z",
                                  customer_presence_confirmed_at:
                                    "2026-04-04T09:10:00.000Z",
                                  deposit_paid_at: null,
                                  deposit_customer_reported_paid_at: null,
                                  deposit_status: "not_required",
                                  protection_confirmation_required: true,
                                  customers: { id: "customer-1", name: "Ana" },
                                  services: {
                                    id: "service-1",
                                    name: "Escova",
                                  },
                                  staff_members: {
                                    id: "staff-1",
                                    name: "Ana",
                                  },
                                },
                                {
                                  id: "autopilot-2",
                                  date: "2026-04-04T11:00:00.000Z",
                                  ends_at: "2026-04-04T11:45:00.000Z",
                                  status: "pending",
                                  customer_confirmation_requested_at:
                                    "2026-04-04T08:20:00.000Z",
                                  customer_presence_confirmed_at: null,
                                  deposit_paid_at: null,
                                  deposit_customer_reported_paid_at: null,
                                  deposit_status: "pending",
                                  protection_confirmation_required: true,
                                  customers: { id: "customer-2", name: "Bianca" },
                                  services: {
                                    id: "service-2",
                                    name: "Coloracao",
                                  },
                                  staff_members: {
                                    id: "staff-2",
                                    name: "Bruna",
                                  },
                                },
                              ],
                              error: null,
                            }),
                          })),
                        })),
                      })),
                    }))
                  : undefined,
                gte: vi.fn(() => ({
                  lt: vi.fn(() => ({
                    order: vi.fn(() => ({
                      limit: vi.fn().mockResolvedValue({
                        data: [
                          {
                            id: "appointment-1",
                            date: "2026-04-04T10:00:00.000Z",
                            status: "completed",
                            customers: { id: "customer-1", name: "Ana" },
                            services: {
                              id: "service-1",
                              name: "Escova",
                              price: 95,
                            },
                          },
                          {
                            id: "appointment-2",
                            date: "2026-04-01T10:00:00.000Z",
                            status: "confirmed",
                            customers: { id: "customer-2", name: "Bianca" },
                            services: {
                              id: "service-2",
                              name: "Coloracao",
                              price: 180,
                            },
                          },
                          {
                            id: "appointment-3",
                            date: "2026-03-01T10:00:00.000Z",
                            status: "cancelled",
                            customers: { id: "customer-1", name: "Ana" },
                            services: {
                              id: "service-1",
                              name: "Escova",
                              price: 95,
                            },
                          },
                        ],
                        error: null,
                      }),
                    })),
                  })),
                })),
              })),
            })),
          };
        }

        if (table === "customers") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                order: vi.fn(() => ({
                  limit: vi.fn().mockResolvedValue({
                    data: [
                      {
                        id: "customer-1",
                        name: "Ana",
                        created_at: "2026-01-02T10:00:00.000Z",
                        phone: "11988887777",
                        whatsapp_phone: "5511988887777",
                      },
                      {
                        id: "customer-2",
                        name: "Bianca",
                        created_at: "2026-03-20T10:00:00.000Z",
                        phone: "11977776666",
                        whatsapp_phone: "5511977776666",
                      },
                    ],
                    error: null,
                  }),
                })),
              })),
            })),
          };
        }

        if (table === "salon_monthly_targets") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: null,
                    error: null,
                  }),
                })),
              })),
            })),
          };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
      storage: {
        from: storageFrom,
      },
    });

    const ui = await OperationsPage({
      searchParams: Promise.resolve({ message: "Operacao atualizada.", tone: "success" }),
    });

    const { container } = render(ui);

    expect(screen.getByText("Operacao atualizada.")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Agenda automática" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Agendador pronto")).toBeInTheDocument();
    expect(screen.getAllByText("Concluir sozinho").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Virar falta").length).toBeGreaterThan(0);
    expect(
      screen.getByText(/Horários do app entram aceitos automaticamente/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "Pedidos, equipe e rotina do salão",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Fila comercial do app" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Profissionais em foco" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Ritmo operacional" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Sinais executivos" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Base e reativação" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Estoque sob vigia" })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Entrada, saida e ajuste" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Loja e estoque" })).toHaveAttribute(
      "href",
      "/dashboard/inventory",
    );
    expect(screen.getAllByText(/Ticket médio/).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("heading", { name: "Ana" }).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/R\$\s*234,00/).length).toBeGreaterThan(0);
    expect(
      screen.getAllByRole("button", { name: "Salvar comissão" }).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText("Shampoo reconstrutor").length,
    ).toBeGreaterThan(0);
    expect(screen.getByText("#204")).toBeInTheDocument();
    expect(
      screen.getByText(/Separar para retirada na recepcao/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirmar" })).toBeInTheDocument();
    expect(container.textContent).toContain("Uso no atendimento");
    expect(screen.getByRole("button", { name: "Salvar metas do mês" })).toBeInTheDocument();
    expect(
      container.querySelectorAll(
        'form[action="/__test/update-store-order-status"] input[name="returnPath"][value="/dashboard/operations#store-orders"]',
      ).length,
    ).toBeGreaterThan(0);
    expect(
      container.querySelector('a[href="/dashboard/operations#store-orders"]'),
    ).not.toBeNull();
    expect(
      container.querySelector(
        'a[href="/dashboard/operations?orderState=pending#store-orders"]',
      ),
    ).not.toBeNull();
  });
});
