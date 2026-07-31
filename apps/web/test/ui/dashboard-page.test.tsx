// @vitest-environment jsdom

import { createElement, type ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MANAGEMENT_ROUTES } from "@/lib/management-navigation";

const {
  approveCustomerMembershipRequestActionPath,
  computeDayOccupancySnapshotMock,
  createClientMock,
  deleteSalonBirthdayCampaignActionPath,
  getRecoveryCampaignSnapshotMock,
  listPanelAssistantHistoryMock,
  markCustomerMembershipRequestPaidActionPath,
  updateSalonBirthdayCampaignActionPath,
  rejectCustomerMembershipRequestActionPath,
  requireOwnerSalonMock,
  updateCustomerProductOrderStatusActionPath,
  updateManagementAppointmentStatusActionPath,
} = vi.hoisted(() => ({
  approveCustomerMembershipRequestActionPath: "/__test/dashboard-approve",
  computeDayOccupancySnapshotMock: vi.fn(),
  createClientMock: vi.fn(),
  deleteSalonBirthdayCampaignActionPath: "/__test/dashboard-birthday-delete",
  getRecoveryCampaignSnapshotMock: vi.fn(),
  listPanelAssistantHistoryMock: vi.fn(),
  markCustomerMembershipRequestPaidActionPath: "/__test/dashboard-mark-paid",
  updateSalonBirthdayCampaignActionPath: "/__test/dashboard-birthday",
  rejectCustomerMembershipRequestActionPath: "/__test/dashboard-reject",
  requireOwnerSalonMock: vi.fn(),
  updateCustomerProductOrderStatusActionPath: "/__test/dashboard-order-status",
  updateManagementAppointmentStatusActionPath:
    "/__test/dashboard-appointment-status",
}));

vi.mock("next/link", () => ({
  default: (props: {
    children?: ReactNode;
    href: string;
    className?: string;
    [key: string]: unknown;
  }) => createElement("a", props, props.children),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: vi.fn(),
  }),
}));

vi.mock("@/lib/auth", () => ({
  requireOwnerSalon: requireOwnerSalonMock,
}));

vi.mock("@/lib/ai/operationalScores", () => ({
  buildFillChanceLabel: vi.fn((value: number) => `${value}% de chance`),
  buildOperationalRiskLabel: vi.fn((value: number) =>
    value >= 70 ? "Alto" : value >= 40 ? "Medio" : "Baixo",
  ),
  computeDayOccupancySnapshot: computeDayOccupancySnapshotMock,
}));

vi.mock("@/lib/ai/panelAssistant", () => ({
  listPanelAssistantHistory: listPanelAssistantHistoryMock,
}));

vi.mock("@/lib/ai/recoveryCampaign", () => ({
  getRecoveryCampaignSnapshot: getRecoveryCampaignSnapshotMock,
}));

vi.mock("@/app/actions", () => ({
  approveCustomerMembershipRequestAction:
    approveCustomerMembershipRequestActionPath,
  markCustomerMembershipRequestPaidAction:
    markCustomerMembershipRequestPaidActionPath,
  rejectCustomerMembershipRequestAction:
    rejectCustomerMembershipRequestActionPath,
  updateCustomerProductOrderStatusAction:
    updateCustomerProductOrderStatusActionPath,
}));

vi.mock("@/app/_actions/management", () => ({
  updateManagementAppointmentStatusAction:
    updateManagementAppointmentStatusActionPath,
}));

vi.mock("@/app/_actions/dashboard-birthdays", () => ({
  deleteSalonBirthdayCampaignAction: deleteSalonBirthdayCampaignActionPath,
  updateSalonBirthdayCampaignAction: updateSalonBirthdayCampaignActionPath,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: createClientMock,
}));

import DashboardPage from "@/app/dashboard/page";

describe("dashboard page UI", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-30T15:00:00.000Z"));
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_123");
    computeDayOccupancySnapshotMock.mockResolvedValue({
      occupancyPercent: 42,
      openSlots: 3,
    });
    listPanelAssistantHistoryMock.mockResolvedValue([]);
    getRecoveryCampaignSnapshotMock.mockResolvedValue({
      available: true,
      summary: "Campanha pronta para preencher a agenda de amanhã.",
      actions: ["Enviar mensagem", "Abrir clientes"],
    });

    requireOwnerSalonMock.mockResolvedValue({
      salon: {
        id: "salon-1",
        name: "Studio Beleza",
        slot_step_minutes: 30,
        timezone: "America/Sao_Paulo",
      },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it("renders a professional dashboard with customer growth, agenda and finance", async () => {
    createClientMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "services") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn().mockResolvedValue({ count: 12, error: null }),
            })),
          };
        }

        if (table === "salon_offers") {
          return {
            select: vi.fn(
              (
                _columns?: string,
                options?: { count?: string; head?: boolean },
              ) => {
                if (options?.head) {
                  return {
                    eq: vi.fn().mockResolvedValue({ count: 4, error: null }),
                  };
                }

                return {
                  eq: vi.fn(() => ({
                    eq: vi.fn(() => {
                      if (_columns?.includes("membership_validity_days")) {
                        return Promise.resolve({
                          data: [
                            {
                              id: "offer-1",
                              membership_validity_days: 30,
                            },
                          ],
                          error: null,
                        });
                      }

                      return {
                        order: vi.fn(() => ({
                          order: vi.fn(() => ({
                            limit: vi.fn().mockResolvedValue({
                              data: [
                                {
                                  id: "offer-1",
                                  kind: "membership",
                                  title: "Clube Glow Mensal",
                                  highlight_text:
                                    "2 atendimentos por mes com valor fixo",
                                  price: 149.9,
                                  starts_on: "2026-03-25",
                                  ends_on: null,
                                  is_active: true,
                                  sort_order: 0,
                                },
                                {
                                  id: "offer-2",
                                  kind: "promotion",
                                  title: "Escova da Semana",
                                  highlight_text:
                                    "Janela pensada para ocupar horarios ociosos",
                                  price: 89.9,
                                  starts_on: "2026-03-29",
                                  ends_on: "2026-04-05",
                                  is_active: true,
                                  sort_order: 1,
                                },
                              ],
                              error: null,
                            }),
                          })),
                        })),
                      };
                    }),
                  })),
                };
              },
            ),
          };
        }

        if (table === "salon_posts") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn().mockResolvedValue({ count: 9, error: null }),
            })),
          };
        }

        if (table === "salon_customer_notifications") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                gte: vi.fn().mockResolvedValue({ count: 18, error: null }),
              })),
            })),
          };
        }

        if (table === "customer_push_tokens") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn().mockResolvedValue({ count: 9, error: null }),
              })),
            })),
          };
        }

        if (table === "instagram_connections") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn().mockResolvedValue({ count: 1, error: null }),
            })),
          };
        }

        if (table === "instagram_mentions") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn().mockResolvedValue({ count: 6, error: null }),
            })),
          };
        }

        if (table === "customers") {
          return {
            select: vi.fn(
              (
                columns?: string,
                options?: { count?: string; head?: boolean },
              ) => {
                if (options?.head) {
                  return {
                    eq: vi.fn().mockResolvedValue({ count: 52, error: null }),
                  };
                }

                if (columns === "created_at") {
                  return {
                    eq: vi.fn(() => ({
                      gte: vi.fn(() => ({
                        order: vi.fn().mockResolvedValue({
                          data: [
                            { created_at: "2025-10-12T15:00:00.000Z" },
                            { created_at: "2025-11-02T15:00:00.000Z" },
                            { created_at: "2025-11-15T15:00:00.000Z" },
                            { created_at: "2025-12-10T15:00:00.000Z" },
                            { created_at: "2025-12-18T15:00:00.000Z" },
                            { created_at: "2026-01-03T15:00:00.000Z" },
                            { created_at: "2026-01-11T15:00:00.000Z" },
                            { created_at: "2026-01-19T15:00:00.000Z" },
                            { created_at: "2026-01-28T15:00:00.000Z" },
                            { created_at: "2026-02-06T15:00:00.000Z" },
                            { created_at: "2026-02-14T15:00:00.000Z" },
                            { created_at: "2026-02-22T15:00:00.000Z" },
                            { created_at: "2026-03-05T15:00:00.000Z" },
                            { created_at: "2026-03-12T15:00:00.000Z" },
                            { created_at: "2026-03-18T15:00:00.000Z" },
                            { created_at: "2026-03-24T15:00:00.000Z" },
                          ],
                          error: null,
                        }),
                      })),
                    })),
                  };
                }

                if (columns === "id, name, phone, birth_date") {
                  return {
                    eq: vi.fn(() => ({
                      not: vi.fn(() => ({
                        order: vi.fn().mockResolvedValue({
                          data: [
                            {
                              id: "customer-birthday-1",
                              name: "Ana Souza",
                              phone: "16999999999",
                              birth_date: "1994-03-30",
                            },
                          ],
                          error: null,
                        }),
                      })),
                    })),
                  };
                }

                if (columns === "id, name, phone, created_at") {
                  return {
                    eq: vi.fn(() => ({
                      in: vi.fn(() => ({
                        order: vi.fn().mockResolvedValue({
                          data: [
                            {
                              id: "customer-1",
                              name: "Ana Paula",
                              phone: "11999990001",
                              created_at: "2025-10-12T15:00:00.000Z",
                            },
                            {
                              id: "customer-2",
                              name: "Carla Mendes",
                              phone: "11999990002",
                              created_at: "2025-11-02T15:00:00.000Z",
                            },
                            {
                              id: "customer-3",
                              name: "Mariana",
                              phone: "11999990003",
                              created_at: "2026-01-03T15:00:00.000Z",
                            },
                          ],
                          error: null,
                        }),
                      })),
                    })),
                  };
                }

                throw new Error(`Unexpected customers select: ${columns}`);
              },
            ),
          };
        }

        if (table === "salon_birthday_campaigns") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: {
                    id: "birthday-campaign-1",
                    is_active: true,
                    title: "Feliz aniversario!",
                    message: "Hoje o salao preparou uma homenagem especial.",
                    media_kind: null,
                    image_path: null,
                    video_path: null,
                  },
                  error: null,
                }),
              })),
            })),
          };
        }

        if (table === "salon_vacancy_alerts") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                gte: vi.fn(() => ({
                  order: vi.fn(() => ({
                    limit: vi.fn().mockResolvedValue({
                      data: [],
                      error: null,
                    }),
                  })),
                })),
              })),
            })),
          };
        }

        if (table === "inventory_products") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  order: vi.fn(() => ({
                    limit: vi.fn().mockResolvedValue({
                      data: [
                        {
                          id: "product-1",
                          name: "Shampoo reconstrutor",
                          brand: "Wella",
                          current_stock: 2,
                          minimum_stock: 5,
                          unit: "un",
                          is_active: true,
                        },
                        {
                          id: "product-2",
                          name: "Mascara nutritiva",
                          brand: "L'Oreal",
                          current_stock: 1,
                          minimum_stock: 3,
                          unit: "un",
                          is_active: true,
                        },
                      ],
                      error: null,
                    }),
                  })),
                })),
              })),
            })),
          };
        }

        if (table === "customer_tabs") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  limit: vi.fn().mockResolvedValue({
                    data: [
                      {
                        id: "tab-1",
                        total_items: 210,
                        total_paid: 120,
                      },
                      {
                        id: "tab-2",
                        total_items: 80,
                        total_paid: 80,
                      },
                    ],
                    error: null,
                  }),
                })),
              })),
            })),
          };
        }

        if (table === "customer_membership_requests") {
          return {
            select: vi.fn(
              (
                _columns?: string,
                options?: { count?: string; head?: boolean },
              ) => {
                if (options?.head) {
                  return {
                    eq: vi.fn(() => ({
                      eq: vi.fn().mockResolvedValue({ count: 1, error: null }),
                    })),
                  };
                }

                return {
                  eq: vi.fn(() => ({
                    or: vi.fn(() => ({
                      order: vi.fn(() => ({
                        limit: vi.fn().mockResolvedValue({
                          data: [
                            {
                              id: "request-1",
                              offer_id: "offer-1",
                              offer_title_snapshot: "Clube Glow Mensal",
                              approved_starts_on: null,
                              decided_at: null,
                              membership_id: null,
                              requested_at: "2026-03-30T12:00:00.000Z",
                              notes: "Quero ativar ainda hoje.",
                              price_snapshot: 149.9,
                              status: "pending",
                              customers: { name: "Carla Mendes" },
                            },
                            {
                              id: "request-2",
                              offer_id: "offer-1",
                              offer_title_snapshot: "Clube Glow Mensal",
                              approved_starts_on: "2026-04-01",
                              decided_at: "2026-03-30T11:00:00.000Z",
                              membership_id: null,
                              requested_at: "2026-03-30T11:00:00.000Z",
                              notes: "Pago no balcão quando eu chegar.",
                              price_snapshot: 149.9,
                              status: "approved",
                              customers: { name: "Bianca Souza" },
                            },
                          ],
                          count: 2,
                          error: null,
                        }),
                      })),
                    })),
                  })),
                };
              },
            ),
          };
        }

        if (table === "customer_product_orders") {
          return {
            select: vi.fn(
              (
                _columns?: string,
                options?: { count?: string; head?: boolean },
              ) => {
                if (options?.head) {
                  return {
                    eq: vi.fn(() => ({
                      eq: vi.fn().mockResolvedValue({ count: 1, error: null }),
                    })),
                  };
                }

                return {
                  eq: vi.fn(() => ({
                    eq: vi.fn(() => ({
                      order: vi.fn(() => ({
                        limit: vi.fn().mockResolvedValue({
                          data: [
                            {
                              id: "order-1",
                              order_number: 12,
                              status: "pending",
                              total_items: 2,
                              subtotal_amount: 55,
                              notes: "Separar para retirada hoje.",
                              created_at: "2026-03-30T11:30:00.000Z",
                              customers: {
                                name: "Wesley",
                                phone: "11999998888",
                              },
                            },
                          ],
                          count: 1,
                          error: null,
                        }),
                      })),
                    })),
                  })),
                };
              },
            ),
          };
        }

        if (table === "appointments") {
          return {
            select: vi.fn(
              (
                columns: string,
                options?: { count?: string; head?: boolean },
              ) => {
                if (options?.head) {
                  return {
                    eq: vi.fn(() => ({
                      eq: vi.fn().mockResolvedValue({ count: 4, error: null }),
                    })),
                  };
                }

                if (
                  columns ===
                  "id, date, status, customers(name), services(name)"
                ) {
                  return {
                    eq: vi.fn(() => ({
                      eq: vi.fn(() => ({
                        order: vi.fn(() => ({
                          limit: vi.fn().mockResolvedValue({
                            data: [
                              {
                                id: "appointment-pending-1",
                                date: "2026-03-30T14:30:00.000Z",
                                status: "pending",
                                customers: { name: "Carla Mendes" },
                                services: { name: "Escova premium" },
                              },
                            ],
                            count: options?.count === "exact" ? 1 : null,
                            error: null,
                          }),
                        })),
                      })),
                    })),
                  };
                }

                if (
                  columns ===
                  "id, date, status, customers(name), services(name), staff_members(name)"
                ) {
                  return {
                    eq: vi.fn(() => ({
                      neq: vi.fn(() => ({
                        gte: vi.fn(() => ({
                          order: vi.fn(() => ({
                            limit: vi.fn(() => ({
                              maybeSingle: vi.fn().mockResolvedValue({
                                data: {
                                  id: "appointment-pending-1",
                                  date: "2026-03-30T14:30:00.000Z",
                                  status: "pending",
                                  customers: { name: "Carla Mendes" },
                                  services: { name: "Escova premium" },
                                  staff_members: { name: "Ricardo" },
                                },
                                error: null,
                              }),
                            })),
                          })),
                        })),
                      })),
                    })),
                  };
                }

                if (
                  columns ===
                  "id, date, status, service_price_snapshot, customers(name), services(name, price), staff_members(name)"
                ) {
                  return {
                    eq: vi.fn(() => ({
                      neq: vi.fn(() => ({
                        gte: vi.fn(() => ({
                          lt: vi.fn(() => ({
                            order: vi.fn(() => ({
                              limit: vi.fn().mockResolvedValue({
                                data: [
                                  {
                                    id: "appointment-1",
                                    date: "2026-03-30T12:00:00.000Z",
                                    service_price_snapshot: 120,
                                    status: "confirmed",
                                    customer_id: "customer-1",
                                    customers: { name: "Ana Paula" },
                                    services: {
                                      category: "Cabelo",
                                      name: "Corte feminino",
                                      price: 120,
                                    },
                                    staff_members: { name: "Camila" },
                                  },
                                  {
                                    id: "appointment-2",
                                    date: "2026-03-30T14:30:00.000Z",
                                    service_price_snapshot: 90,
                                    status: "pending",
                                    customer_id: "customer-2",
                                    customers: { name: "Carla Mendes" },
                                    services: {
                                      category: "Cabelo",
                                      name: "Escova premium",
                                      price: 90,
                                    },
                                    staff_members: { name: "Ricardo" },
                                  },
                                  {
                                    id: "appointment-3",
                                    date: "2026-03-31T13:00:00.000Z",
                                    service_price_snapshot: 70,
                                    status: "confirmed",
                                    customer_id: "customer-3",
                                    customers: { name: "Mariana" },
                                    services: {
                                      category: "Unhas",
                                      name: "Manicure",
                                      price: 70,
                                    },
                                    staff_members: { name: "Lorena" },
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

                if (
                  columns ===
                  "customer_id, date, completed_at, service_price_snapshot, services(price)"
                ) {
                  return {
                    eq: vi.fn(() => ({
                      eq: vi.fn(() => ({
                        gte: vi.fn(() => ({
                          order: vi.fn(() => ({
                            limit: vi.fn().mockResolvedValue({
                              data: [
                                {
                                  completed_at: "2026-03-29T15:15:00.000Z",
                                  customer_id: "customer-1",
                                  date: "2026-03-29T15:00:00.000Z",
                                  service_price_snapshot: 120,
                                  services: { price: 120 },
                                },
                                {
                                  completed_at: "2026-03-28T16:10:00.000Z",
                                  customer_id: "customer-2",
                                  date: "2026-03-28T16:00:00.000Z",
                                  service_price_snapshot: 200,
                                  services: { price: 200 },
                                },
                                {
                                  completed_at: "2026-03-20T18:20:00.000Z",
                                  customer_id: "customer-1",
                                  date: "2026-03-20T18:00:00.000Z",
                                  service_price_snapshot: 150,
                                  services: { price: 150 },
                                },
                              ],
                              error: null,
                            }),
                          })),
                        })),
                      })),
                    })),
                  };
                }

                if (
                  columns ===
                  "customer_id, date, completed_at, status, service_price_snapshot, services(name, category, price)"
                ) {
                  return {
                    eq: vi.fn(() => ({
                      in: vi.fn(() => ({
                        gte: vi.fn(() => ({
                          order: vi.fn().mockResolvedValue({
                            data: [
                              {
                                completed_at: "2026-03-29T15:15:00.000Z",
                                customer_id: "customer-1",
                                date: "2026-03-29T15:00:00.000Z",
                                service_price_snapshot: 120,
                                status: "completed",
                                services: {
                                  category: "Cabelo",
                                  name: "Corte feminino",
                                  price: 120,
                                },
                              },
                              {
                                completed_at: null,
                                customer_id: "customer-2",
                                date: "2026-03-30T14:30:00.000Z",
                                service_price_snapshot: 90,
                                status: "pending",
                                services: {
                                  category: "Cabelo",
                                  name: "Escova premium",
                                  price: 90,
                                },
                              },
                              {
                                completed_at: null,
                                customer_id: "customer-3",
                                date: "2026-03-31T13:00:00.000Z",
                                service_price_snapshot: 70,
                                status: "confirmed",
                                services: {
                                  category: "Unhas",
                                  name: "Manicure",
                                  price: 70,
                                },
                              },
                            ],
                            error: null,
                          }),
                        })),
                      })),
                    })),
                  };
                }

                if (columns === "date, services(price)") {
                  return {
                    eq: vi.fn(() => ({
                      eq: vi.fn(() => ({
                        order: vi.fn(() => ({
                          limit: vi.fn().mockResolvedValue({
                            data: [
                              {
                                date: "2026-03-30T14:30:00.000Z",
                                services: { price: 250 },
                              },
                              {
                                date: "2026-03-31T16:30:00.000Z",
                                services: { price: 400 },
                              },
                            ],
                            error: null,
                          }),
                        })),
                      })),
                    })),
                  };
                }

                if (columns === "customer_id") {
                  return {
                    eq: vi.fn(() => ({
                      in: vi.fn(() => ({
                        gte: vi.fn(() => ({
                          order: vi.fn().mockResolvedValue({
                            data: [
                              { customer_id: "customer-1" },
                              { customer_id: "customer-3" },
                            ],
                            error: null,
                          }),
                        })),
                      })),
                    })),
                  };
                }

                throw new Error(`Unexpected appointments select: ${columns}`);
              },
            ),
          };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
      rpc: vi.fn((name: string) => {
        if (name === "get_salon_growth_automation_dashboard") {
          return Promise.resolve({
            data: {
              settings: {
                is_active: true,
                smart_rebook_is_active: true,
                updated_at: "2026-03-20T12:00:00.000Z",
              },
              overview: {
                at_risk_customers: 7,
                due_now_customers: 4,
                smart_rebook_due_customers: 5,
                recovered_customers_last_30d: 3,
                smart_rebooks_sent_last_30d: 6,
                winbacks_sent_last_30d: 8,
              },
            },
            error: null,
          });
        }

        if (name === "get_owner_dashboard_intelligence") {
          return Promise.resolve({
            data: {
              overview: {
                tracked_due_now_customers: 2,
                tracked_lapsed_customers: 4,
                tracked_top_customers: 5,
                tracked_top_services: 5,
              },
              lapsed_customers: [
                {
                  id: "customer-lapsed-1",
                  name: "Marina",
                  inactive_days: 41,
                  last_visit_at: "2026-02-09T15:00:00.000Z",
                  last_service_name: "Coloracao",
                  last_service_category: "Cabelo",
                  total_spent: 820,
                  completed_visits: 5,
                  status: "due_now",
                },
              ],
              top_customers: [
                {
                  id: "customer-top-1",
                  name: "Fernanda",
                  total_spent: 1430,
                  completed_visits: 8,
                  last_visit_at: "2026-03-10T17:00:00.000Z",
                  next_appointment_at: null,
                  upcoming_appointments: 0,
                },
              ],
              top_services: [
                {
                  id: "service-1",
                  name: "Corte",
                  category: "Cabelo",
                  completed_appointments: 35,
                  unique_customers: 18,
                  total_revenue: 4200,
                  last_booked_at: "2026-03-28T16:00:00.000Z",
                },
                {
                  id: "service-2",
                  name: "Coloracao",
                  category: "Cabelo",
                  completed_appointments: 28,
                  unique_customers: 12,
                  total_revenue: 3360,
                  last_booked_at: "2026-03-27T17:00:00.000Z",
                },
              ],
            },
            error: null,
          });
        }

        if (name === "get_smart_schedule_opportunities") {
          return Promise.resolve({
            data: {
              suggestions: [
                {
                  staff_member_name: "Camila",
                  suggested_start: "2026-03-30T16:00:00.000Z",
                  headline: "Encaixe premium",
                  detail: "Janela boa para vender um servico de maior ticket.",
                  suggested_service: {
                    name: "Luzes premium",
                    category: "Cabelo",
                    price: 180,
                  },
                },
              ],
            },
            error: null,
          });
        }

        if (name === "get_owner_operations_dashboard") {
          return Promise.resolve({
            data: {
              overview: {
                active_inventory_products: 8,
                active_staff_members: 3,
                average_ticket: 156,
                estimated_commissions: 480,
                low_stock_products: 2,
                top_staff_name: "Camila",
                top_staff_revenue: 2200,
                total_revenue: 3120,
              },
              daily_revenue: [
                {
                  completed_appointments: 2,
                  day: "2026-03-29",
                  total_revenue: 220,
                },
                {
                  completed_appointments: 1,
                  day: "2026-03-30",
                  total_revenue: 180,
                },
              ],
              top_staff: [
                {
                  id: "staff-1",
                  name: "Camila",
                  role: "Cabelo",
                  completed_appointments: 15,
                  estimated_commission: 310,
                  pending_appointments: 1,
                  total_revenue: 2200,
                  upcoming_appointments: 3,
                },
                {
                  id: "staff-2",
                  name: "Ricardo",
                  role: "Barbearia",
                  completed_appointments: 12,
                  estimated_commission: 190,
                  pending_appointments: 1,
                  total_revenue: 1680,
                  upcoming_appointments: 2,
                },
              ],
            },
            error: null,
          });
        }

        throw new Error(`Unexpected rpc ${name}`);
      }),
    });

    const ui = await DashboardPage({
      searchParams: Promise.resolve({ message: "Resumo atualizado.", tone: "success" }),
    });

    render(ui);

    expect(screen.getByText("Resumo atualizado.")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "Tudo do salão em uma tela",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("Studio Beleza")).toBeInTheDocument();
    expect(
      screen.getByText("Pedidos do app aguardando resposta"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Abrir agenda do salão" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Abrir agenda do salão" }),
    ).toHaveAttribute("href", "/dashboard/gestao/agendamentos");
    expect(
      screen.getByRole("link", { name: "Pendências do app: 4" }),
    ).toHaveAttribute("href", "/dashboard#dashboard-client-requests");
    expect(
      screen.getByRole("heading", { name: "Novas clientes no mês" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Comandas em aberto" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Horários do dia" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "O que fazer agora" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Agenda do dia" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Finanças do salão" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Pedidos do aplicativo" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "O que merece atenção hoje" }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Pedidos do app").length).toBeGreaterThan(0);
    expect(screen.getAllByText("09:00").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Corte feminino").length).toBeGreaterThan(0);
    expect(screen.getByText("Faturamento do mês")).toBeInTheDocument();
    expect(screen.getByText("Comandas abertas")).toBeInTheDocument();
    expect(screen.getByText(/R\$\s?90,00 em aberto/)).toBeInTheDocument();
    expect(screen.getByText("Pedido #12")).toBeInTheDocument();
    expect(screen.getByText("2 itens")).toBeInTheDocument();
    expect(
      screen
        .getAllByRole("link", { name: "Abrir promoções" })
        .map((link) => link.getAttribute("href")),
    ).toEqual(["/dashboard/benefits/promotions"]);
    expect(screen.getByRole("link", { name: "Ver carteira" })).toHaveAttribute(
      "href",
      MANAGEMENT_ROUTES.clients,
    );
    expect(
      screen.getByRole("link", { name: "Fechar comandas" }),
    ).toHaveAttribute("href", "/dashboard/finance");
    expect(
      screen.getByRole("button", { name: "Confirmar horário" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Confirmar pedido" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Aprovar e aguardar pagamento" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Marcar como pago e ativar" }),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("Início real da assinatura"),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("link", { name: "Abrir agenda" }).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByRole("link", { name: "Abrir clientes" }).length,
    ).toBeGreaterThan(0);
  });
});
