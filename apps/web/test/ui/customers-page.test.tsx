// @vitest-environment jsdom

import { createElement, type ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  assignCustomerMembershipPackageActionPath,
  createClientMock,
  requireOwnerSalonMock,
  saveOwnerCustomerProfileActionPath,
  sendCustomerNudgeActionPath,
} = vi.hoisted(() => ({
  assignCustomerMembershipPackageActionPath: "/__test/assign-membership",
  createClientMock: vi.fn(),
  requireOwnerSalonMock: vi.fn(),
  saveOwnerCustomerProfileActionPath: "/__test/save-customer-profile",
  sendCustomerNudgeActionPath: "/__test/send-customer-nudge",
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

vi.mock("@/lib/auth", () => ({
  requireOwnerSalon: requireOwnerSalonMock,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: createClientMock,
}));

vi.mock("@/app/actions", () => ({
  assignCustomerMembershipPackageAction:
    assignCustomerMembershipPackageActionPath,
  saveOwnerCustomerProfileAction: saveOwnerCustomerProfileActionPath,
  sendCustomerNudgeAction: sendCustomerNudgeActionPath,
}));

import CustomersPage from "@/app/dashboard/customers/page";

describe("customers page UI", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireOwnerSalonMock.mockResolvedValue({
      salon: { id: "salon-1" },
    });
  });

  it("renders CRM filters, customer metrics and pagination", async () => {
    createClientMock.mockReturnValue({
      rpc: vi.fn((name: string) => {
        if (name !== "get_owner_customer_directory") {
          throw new Error(`Unexpected rpc ${name}`);
        }

        return Promise.resolve({
          data: {
            overview: {
              cashback_customers: 4,
              customers_with_upcoming_appointment: 7,
              returning_customers: 9,
              total_customers: 17,
              vip_customers: 3,
            },
            total_count: 17,
            total_pages: 3,
            page: 2,
            page_size: 15,
            items: [
              {
                allergies: "Sensibilidade a amônia.",
                beauty_goals:
                  "Alongar a durabilidade da cor sem perder brilho.",
                beauty_products: "Máscara reconstrutora e finalizador leve.",
                crm_label: "Alta recorrência",
                consent_status: "signed",
                contraindications: "Evitar descoloração total por enquanto.",
                id: "customer-1",
                internal_notes:
                  "Responder com combo premium no próximo contato.",
                cashback_balance: 32.5,
                completed_visits: 8,
                created_at: "2026-02-10T12:00:00.000Z",
                current_tier: {
                  discount_percent: 15,
                  is_vip: true,
                  label: "Rubi",
                  min_visits: 6,
                },
                last_assessment_at: "2026-03-18",
                last_reward_at: "2026-03-01T14:00:00.000Z",
                last_visit_at: "2026-03-12T15:30:00.000Z",
                name: "Maria",
                next_appointment_at: "2026-03-28T16:00:00.000Z",
                pending_appointments: 1,
                phone: "11998887766",
                points_balance: 120,
                preferences:
                  "Prefere acabamento natural e horário no fim da tarde.",
                referral_code: "MARIA10",
                technical_notes:
                  "Matização fria + tratamento nutritivo quinzenal.",
                last_completed_at: "2026-03-12T15:30:00.000Z",
                last_completed_service_name: "Corte premium",
                last_completed_staff_member_name: "Ana",
                total_spent: 860,
                upcoming_appointments: 2,
              },
            ],
          },
          error: null,
        });
      }),
      from: vi.fn((table: string) => {
        if (table === "customers") {
          return {
            select: vi.fn(() => ({
              in: vi.fn(() =>
                Promise.resolve({
                  data: [
                    {
                      beauty_goals:
                        "Alongar a durabilidade da cor sem perder brilho.",
                      id: "customer-1",
                      phone: "11998887766",
                      preferences:
                        "Prefere acabamento natural e horário no fim da tarde.",
                      allergies: "Sensibilidade a amônia.",
                      beauty_products:
                        "Máscara reconstrutora e finalizador leve.",
                      consent_status: "signed",
                      contraindications:
                        "Evitar descoloração total por enquanto.",
                      crm_label: "Alta recorrência",
                      internal_notes:
                        "Responder com combo premium no próximo contato.",
                      last_assessment_at: "2026-03-18",
                      technical_notes:
                        "Matização fria + tratamento nutritivo quinzenal.",
                    },
                  ],
                  error: null,
                }),
              ),
            })),
          };
        }

        if (table === "appointments") {
          return {
            select: vi.fn((columns: string) => {
              if (
                columns ===
                "customer_id, date, completed_at, services(name), staff_members(name)"
              ) {
                return {
                  eq: vi.fn(() => ({
                    eq: vi.fn(() => ({
                      in: vi.fn(() => ({
                        order: vi.fn(() => ({
                          order: vi.fn(() =>
                            Promise.resolve({
                              data: [
                                {
                                  customer_id: "customer-1",
                                  date: "2026-03-12T15:30:00.000Z",
                                  completed_at: "2026-03-12T15:30:00.000Z",
                                  services: { name: "Corte premium" },
                                  staff_members: { name: "Ana" },
                                },
                              ],
                              error: null,
                            }),
                          ),
                        })),
                      })),
                    })),
                  })),
                };
              }

              throw new Error(`Unexpected appointments columns ${columns}`);
            }),
          };
        }

        if (table === "salon_offers") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  eq: vi.fn(() => ({
                    not: vi.fn(() => ({
                      not: vi.fn(() => ({
                        not: vi.fn(() => ({
                          order: vi.fn(() => ({
                            order: vi.fn(() =>
                              Promise.resolve({
                                data: [
                                  {
                                    id: "offer-1",
                                    title: "Glow mensal",
                                    membership_service_id: "service-1",
                                    membership_sessions_included: 4,
                                    membership_validity_days: 30,
                                    price: 199.9,
                                  },
                                ],
                                error: null,
                              }),
                            ),
                          })),
                        })),
                      })),
                    })),
                  })),
                })),
              })),
            })),
          };
        }

        if (table === "services") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                order: vi.fn(() => ({
                  order: vi.fn(() =>
                    Promise.resolve({
                      data: [
                        {
                          id: "service-1",
                          name: "Corte premium",
                          category: "Cabelo",
                        },
                      ],
                      error: null,
                    }),
                  ),
                })),
              })),
            })),
          };
        }

        if (table === "customer_memberships") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                in: vi.fn(() => ({
                  order: vi.fn(() =>
                    Promise.resolve({
                      data: [
                        {
                          id: "membership-1",
                          customer_id: "customer-1",
                          title: "Glow mensal",
                          service_id: "service-1",
                          service_name_snapshot: "Corte premium",
                          price_snapshot: 199.9,
                          sessions_included: 4,
                          sessions_used: 1,
                          started_at: "2026-03-10",
                          expires_at: "2026-04-09",
                          status: "active",
                          notes: "Ativado na recepção",
                          created_at: "2026-03-10T12:00:00.000Z",
                        },
                      ],
                      error: null,
                    }),
                  ),
                })),
              })),
            })),
          };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
    });

    const ui = await CustomersPage({
      searchParams: {
        q: "Maria",
        segment: "vip",
        sort: "spent",
        page: "2",
      },
    });

    render(ui);

    expect(
      screen.getByRole("heading", { name: "Clientes" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Buscar cliente")).toHaveValue("Maria");
    expect(
      screen.getByRole("button", { name: "Filtrar clientes" }),
    ).toBeInTheDocument();
    expect(screen.getByText("17 clientes encontrados")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Limpar filtros" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Maria" })).toBeInTheDocument();
    expect(screen.getByText("Rubi")).toBeInTheDocument();
    expect(screen.getByText("Alta recorrência")).toBeInTheDocument();
    expect(screen.getAllByText("VIP").length).toBeGreaterThan(0);
    expect(screen.getByText("Código MARIA10")).toBeInTheDocument();
    expect(screen.getByText("120")).toBeInTheDocument();
    expect(screen.getByText(/R\$\s*32,50/)).toBeInTheDocument();
    expect(screen.getByText(/R\$\s*860,00/)).toBeInTheDocument();
    expect(screen.getAllByText("Preferências").length).toBeGreaterThan(0);
    expect(
      screen.getAllByText(
        "Prefere acabamento natural e horário no fim da tarde.",
      ).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText("Produtos usados ou preferidos").length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText("Máscara reconstrutora e finalizador leve.").length,
    ).toBeGreaterThan(0);
    expect(screen.getAllByText("Alergias e cuidados").length).toBeGreaterThan(
      0,
    );
    expect(
      screen.getAllByText("Sensibilidade a amônia.").length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText("Objetivo / queixa principal").length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText("Alongar a durabilidade da cor sem perder brilho.")
        .length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText("Contraindicações e restrições").length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText("Evitar descoloração total por enquanto.").length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText("Consentimento assinado").length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText("Fórmula / protocolo atual").length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText("Matização fria + tratamento nutritivo quinzenal.")
        .length,
    ).toBeGreaterThan(0);
    expect(screen.getAllByText("Última avaliação").length).toBeGreaterThan(0);
    expect(
      screen.getAllByText("Anotações internas do salão").length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText("Responder com combo premium no próximo contato.")
        .length,
    ).toBeGreaterThan(0);
    expect(screen.getAllByText(/Corte premium/).length).toBeGreaterThan(0);
    expect(
      screen.getByRole("link", { name: "Abrir WhatsApp" }),
    ).toHaveAttribute("href", "https://wa.me/5511998887766");
    expect(screen.getByLabelText("Consentimento")).toHaveValue("signed");
    expect(screen.getByLabelText("Ultima avaliacao")).toHaveValue("2026-03-18");
    expect(screen.getByLabelText("Objetivo / queixa principal")).toHaveValue(
      "Alongar a durabilidade da cor sem perder brilho.",
    );
    expect(screen.getByLabelText("Contraindicações e restrições")).toHaveValue(
      "Evitar descoloração total por enquanto.",
    );
    expect(screen.getByText("Pacotes ativos e saldo")).toBeInTheDocument();
    expect(screen.getByText("Glow mensal")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Ativar pacote com saldo" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Fórmula / protocolo atual")).toHaveValue(
      "Matização fria + tratamento nutritivo quinzenal.",
    );
    expect(
      screen.getByRole("button", { name: "Salvar CRM" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Exibindo de 16 até 17 de 17. Página 2 de 3."),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Anterior" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Próxima" })).toBeInTheDocument();
  });
});
