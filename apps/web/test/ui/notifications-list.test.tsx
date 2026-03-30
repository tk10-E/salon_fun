// @vitest-environment jsdom

import { createElement } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

const { deleteSalonNotificationActionMock } = vi.hoisted(() => ({
  deleteSalonNotificationActionMock: vi.fn(),
}));

vi.mock("@/app/actions", () => ({
  deleteSalonNotificationAction: deleteSalonNotificationActionMock,
}));

import { NotificationsList } from "@/app/dashboard/notifications/NotificationsList";

describe("notifications list UI", () => {
  it("allows selecting all items on the page and updates the bulk action state", async () => {
    const user = userEvent.setup();

    render(
      createElement(NotificationsList, {
        items: [
          {
            notification: {
              id: "n1",
              audience: "salon_customers",
              notification_type: "promotion_published",
              title: "Nova oferta",
              body: "Promoção ativa hoje",
              created_at: "2026-03-20T15:00:00.000Z",
              customer_id: null,
              customers: null,
            },
            category: "promotion",
            customerName: null,
            dispatchSnapshot: {
              notification_id: "n1",
              status: "delivered",
              sent_count: 12,
              failed_count: 0,
              deactivated_count: 0,
              response_status: 200,
              error_detail: null,
              updated_at: "2026-03-20T15:01:00.000Z",
            },
          },
          {
            notification: {
              id: "n2",
              audience: "single_customer",
              notification_type: "appointment_confirmed",
              title: "Horário confirmado",
              body: "Sua reserva foi confirmada",
              created_at: "2026-03-20T16:00:00.000Z",
              customer_id: "customer-1",
              customers: { name: "Maria" },
            },
            category: "appointment",
            customerName: "Maria",
            dispatchSnapshot: null,
          },
        ],
        returnPathCurrent: "/dashboard/notifications?page=2",
        returnPathPrevious: "/dashboard/notifications?page=1",
      }),
    );

    const submitButton = screen.getByRole("button", { name: "Excluir selecionados" });
    expect(submitButton).toBeDisabled();
    expect(screen.getByText("0 avisos selecionados")).toBeInTheDocument();

    await user.click(screen.getByLabelText("Marcar todos desta página"));

    expect(submitButton).toBeEnabled();
    expect(screen.getByText("2 avisos selecionados")).toBeInTheDocument();
    expect(screen.getByDisplayValue("/dashboard/notifications?page=2")).toBeInTheDocument();
    expect(screen.getByDisplayValue("/dashboard/notifications?page=1")).toBeInTheDocument();

    const itemCheckboxes = screen.getAllByRole("checkbox").slice(1);
    await user.click(itemCheckboxes[0]);

    expect(screen.getByText("1 aviso selecionado")).toBeInTheDocument();
  });
});
