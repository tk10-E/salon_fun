// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  createClientMock,
  createStaffBlockActionPath,
  createStaffMemberActionPath,
  deleteStaffBlockActionPath,
  deleteStaffMemberActionPath,
  offboardStaffMemberActionPath,
  requireOwnerSalonMock,
  toggleStaffMemberStatusActionPath,
  updateStaffBusinessHoursActionPath,
  updateStaffMemberAssignmentsActionPath,
} = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  createStaffBlockActionPath: "/__test/create-staff-block",
  createStaffMemberActionPath: "/__test/create-staff-member",
  deleteStaffBlockActionPath: "/__test/delete-staff-block",
  deleteStaffMemberActionPath: "/__test/delete-staff-member",
  offboardStaffMemberActionPath: "/__test/offboard-staff-member",
  requireOwnerSalonMock: vi.fn(),
  toggleStaffMemberStatusActionPath: "/__test/toggle-staff-status",
  updateStaffBusinessHoursActionPath: "/__test/update-staff-business-hours",
  updateStaffMemberAssignmentsActionPath: "/__test/update-staff-assignments",
}));

vi.mock("@/app/actions", () => ({
  createStaffBlockAction: createStaffBlockActionPath,
  createStaffMemberAction: createStaffMemberActionPath,
  deleteStaffMemberAction: deleteStaffMemberActionPath,
  deleteStaffBlockAction: deleteStaffBlockActionPath,
  offboardStaffMemberAction: offboardStaffMemberActionPath,
  toggleStaffMemberStatusAction: toggleStaffMemberStatusActionPath,
  updateStaffBusinessHoursAction: updateStaffBusinessHoursActionPath,
  updateStaffMemberAssignmentsAction: updateStaffMemberAssignmentsActionPath,
}));

vi.mock("@/lib/auth", () => ({
  requireOwnerSalon: requireOwnerSalonMock,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: createClientMock,
}));

import TeamPage from "@/app/dashboard/team/page";

describe("team page UI", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireOwnerSalonMock.mockResolvedValue({
      salon: { id: "salon-1" },
    });
  });

  it("renders staff management, new member form and manual blocks", async () => {
    createClientMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "services") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                order: vi.fn().mockResolvedValue({
                  data: [{ id: "service-1", name: "Escova modelada" }],
                  error: null,
                }),
              })),
            })),
          };
        }

        if (table === "staff_members") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                order: vi.fn().mockResolvedValue({
                  data: [
                    {
                      id: "staff-1",
                      name: "Ana",
                      role: "Cabelo",
                      is_active: true,
                      is_default: true,
                      staff_service_assignments: [
                        {
                          service_id: "service-1",
                          services: { id: "service-1", name: "Escova modelada" },
                        },
                      ],
                    },
                    {
                      id: "staff-2",
                      name: "Camila",
                      role: "Unhas",
                      is_active: false,
                      is_default: false,
                      staff_service_assignments: [],
                    },
                  ],
                  error: null,
                }),
              })),
            })),
          };
        }

        if (table === "staff_blocks") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                gte: vi.fn(() => ({
                  order: vi.fn().mockResolvedValue({
                    data: [
                      {
                        id: "block-1",
                        starts_at: "2026-03-23T12:00:00.000Z",
                        ends_at: "2026-03-23T13:00:00.000Z",
                        reason: "Almoço",
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

        if (table === "salon_business_hours") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                order: vi.fn().mockResolvedValue({
                  data: [
                    { weekday: 1, is_open: true, opens_at: "09:00:00", closes_at: "18:00:00" },
                  ],
                  error: null,
                }),
              })),
            })),
          };
        }

        if (table === "staff_business_hours") {
          return {
            select: vi.fn(() => ({
              in: vi.fn(() => ({
                order: vi.fn().mockResolvedValue({
                  data: [
                    {
                      staff_member_id: "staff-1",
                      weekday: 1,
                      is_open: true,
                      opens_at: "10:00:00",
                      closes_at: "19:00:00",
                    },
                  ],
                  error: null,
                }),
              })),
            })),
          };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
    });

    const ui = await TeamPage({
      searchParams: { message: "Equipe atualizada.", tone: "success" },
    });

    render(ui);

    expect(screen.getByText("Equipe atualizada.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Equipe do salão" })).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { name: "Ana" }).length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: "Camila" })).toBeInTheDocument();
    expect(screen.getByText("Profissional inicial do sistema")).toBeInTheDocument();
    expect(screen.getByText("Profissional adicional")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pausar" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reativar" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Salvar serviços" }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: "Salvar agenda do profissional" }).length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: "Novo profissional" })).toBeInTheDocument();
    expect(screen.getByLabelText("Nome")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Adicionar profissional" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Bloqueios manuais" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Criar bloqueio" })).toBeInTheDocument();
    expect(screen.getByText("Almoço")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Remover" }).length).toBeGreaterThan(0);
  });
});
