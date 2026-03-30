// @vitest-environment jsdom

import { createElement, type ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  createClientMock,
  requireOwnerSalonMock,
  updateAppointmentStatusActionMock,
} = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  requireOwnerSalonMock: vi.fn(),
  updateAppointmentStatusActionMock: vi.fn(),
}));

vi.mock("next/link", () => ({
  default: (props: { children?: ReactNode; href: string; className?: string }) =>
    createElement("a", { href: props.href, className: props.className }, props.children),
}));

vi.mock("@/app/actions", () => ({
  updateAppointmentStatusAction: updateAppointmentStatusActionMock,
}));

vi.mock("@/lib/auth", () => ({
  requireOwnerSalon: requireOwnerSalonMock,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: createClientMock,
}));

import AppointmentsPage from "@/app/dashboard/appointments/page";

describe("appointments page UI", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireOwnerSalonMock.mockResolvedValue({
      salon: { id: "salon-1", slot_step_minutes: 30 },
    });
  });

  it("renders smart suggestions, board sections and actions for the current agenda", async () => {
    const staffOrder = vi.fn(() => Promise.resolve({ data: [{ id: "staff-1", name: "Ana" }], error: null }));
    const rpc = vi.fn((name: string) => {
      if (name === "get_owner_appointment_board") {
        return Promise.resolve({
          data: {
            overview: {
              pending: 1,
              confirmed: 1,
              awaiting_completion: 1,
              completed: 0,
              cancelled: 0,
            },
            total_count: 3,
            total_pages: 1,
            page: 1,
            page_size: 18,
            items: [
              {
                id: "appointment-1",
                customer_name: "Maria",
                service_category: "Cabelo",
                service_name: "Escova modelada",
                service_duration: 60,
                staff_member_name: "Ana",
                date: "2026-03-22T12:00:00.000Z",
                ends_at: "2026-03-22T13:00:00.000Z",
                board_status: "pending",
                status: "pending",
                cancellation_reason: null,
                cancelled_at: null,
                cancelled_by: null,
                completed_at: null,
                customer_confirmation_requested_at: null,
                customer_presence_confirmed_at: null,
              },
              {
                id: "appointment-2",
                customer_name: "Joana",
                service_category: "Cabelo",
                service_name: "Coloração",
                service_duration: 120,
                staff_member_name: "Ana",
                date: "2026-03-22T15:00:00.000Z",
                ends_at: "2026-03-22T17:00:00.000Z",
                board_status: "confirmed",
                status: "confirmed",
                cancellation_reason: null,
                cancelled_at: null,
                cancelled_by: null,
                completed_at: null,
                customer_confirmation_requested_at: "2026-03-21T15:00:00.000Z",
                customer_presence_confirmed_at: null,
              },
              {
                id: "appointment-3",
                customer_name: "Paula",
                service_category: "Unhas",
                service_name: "Alongamento",
                service_duration: 90,
                staff_member_name: "Ana",
                date: "2026-03-22T09:00:00.000Z",
                ends_at: "2026-03-22T10:30:00.000Z",
                board_status: "awaiting-completion",
                status: "confirmed",
                cancellation_reason: null,
                cancelled_at: null,
                cancelled_by: null,
                completed_at: null,
                customer_confirmation_requested_at: null,
                customer_presence_confirmed_at: "2026-03-22T08:00:00.000Z",
              },
            ],
          },
          error: null,
        });
      }

      if (name === "get_smart_schedule_opportunities") {
        return Promise.resolve({
          data: {
            target_day: "2026-03-22",
            timezone: "America/Sao_Paulo",
            slot_step_minutes: 30,
            suggestions: [
              {
                staff_member_id: "staff-1",
                staff_member_name: "Ana",
                gap_kind: "between_appointments",
                gap_start: "2026-03-22T14:00:00.000Z",
                gap_end: "2026-03-22T15:30:00.000Z",
                gap_minutes: 90,
                suggested_start: "2026-03-22T14:00:00.000Z",
                suggested_end: "2026-03-22T15:00:00.000Z",
                headline: "Encaixe premium",
                detail: "Janela boa para vender um serviço de maior ticket.",
                compatible_service_count: 2,
                compatible_services: [
                  {
                    id: "service-1",
                    name: "Escova modelada",
                    category: "Cabelo",
                    duration: 60,
                    price: 120,
                  },
                ],
                suggested_service: {
                  id: "service-1",
                  name: "Escova modelada",
                  category: "Cabelo",
                  duration: 60,
                  price: 120,
                },
              },
            ],
          },
          error: null,
        });
      }

      throw new Error(`Unexpected rpc ${name}`);
    });

    createClientMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table !== "staff_members") {
          throw new Error(`Unexpected table ${table}`);
        }

        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: staffOrder,
            })),
          })),
        };
      }),
      rpc,
    });

    const ui = await AppointmentsPage({
      searchParams: {
        message: "Agenda atualizada com sucesso.",
        tone: "success",
      },
    });

    render(ui);

    expect(screen.getByRole("heading", { name: "Encaixes inteligentes de hoje" })).toBeInTheDocument();
    expect(screen.getByText("Encaixe premium")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Agendamentos" })).toBeInTheDocument();
    expect(screen.getByText("Agenda atualizada com sucesso.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Operação que merece atenção agora" })).toBeInTheDocument();
    expect(screen.getByText("Pendências do salão que pedem resposta imediata")).toBeInTheDocument();
    expect(screen.getByText("1 em aberto")).toBeInTheDocument();
    expect(screen.getByText("R$ 120,00")).toBeInTheDocument();
    expect(screen.getByLabelText("Buscar agenda")).toBeInTheDocument();
    expect(screen.getByText("3 agendamentos encontrados")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Confirmados" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Aguardando conclusão" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirmar" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Marcar como atendido" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Liberado após o horário" })).toBeDisabled();
    expect(screen.getAllByRole("button", { name: "Cancelar" }).length).toBeGreaterThan(0);
  });
});
