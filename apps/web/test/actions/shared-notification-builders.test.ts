import { describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

import {
  buildAppointmentNoShowNotification,
  buildAppointmentRescheduledNotification,
  buildClientAppRefreshNotification,
  buildServiceCatalogNotification,
  buildStoreOrderStatusNotification,
  buildStoreProductNotification,
  prepareCustomerNotificationPayload,
  resolveCustomerNotificationDeliveryPolicy,
  resolveCustomerNotificationNavigationDefaults,
} from "@/app/_actions/shared";

describe("shared customer notification builders", () => {
  it("points service catalog notifications to the agenda area", () => {
    const notification = buildServiceCatalogNotification({
      action: "published",
      serviceId: "service-1",
      serviceName: "Corte masculino",
      category: "Barbearia",
    });

    expect(notification.payload).toEqual(
      expect.objectContaining({
        ctaTarget: "appointments",
        serviceId: "service-1",
      }),
    );
  });

  it("points store product notifications to the store area", () => {
    const notification = buildStoreProductNotification({
      action: "updated",
      productName: "Pomada modeladora",
      brand: "Salon Fun",
    });

    expect(notification.payload).toEqual(
      expect.objectContaining({
        ctaTarget: "store",
        productName: "Pomada modeladora",
      }),
    );
  });

  it("builds store order notifications that lead back to the store tab", () => {
    const notification = buildStoreOrderStatusNotification({
      status: "confirmed",
      orderId: "order-1",
      orderNumber: 204,
      firstItemName: "Pomada modeladora",
      totalItems: 2,
    });

    expect(notification).toEqual(
      expect.objectContaining({
        type: "store_order_confirmed",
        title: "Seu pedido da loja foi confirmado",
        payload: expect.objectContaining({
          ctaTarget: "store",
          orderId: "order-1",
          orderNumber: 204,
          totalItems: 2,
          targetTabIndex: 2,
        }),
      }),
    );
    expect(notification.body).toContain("Pedido #204");
    expect(notification.body).toContain("Pomada modeladora");
  });

  it("routes app refresh notices by the changed area", () => {
    expect(
      buildClientAppRefreshNotification({
        changedAreas: ["vitrine"],
      }).payload.ctaTarget,
    ).toBe("store");

    expect(
      buildClientAppRefreshNotification({
        changedAreas: ["campanhas", "identidade"],
      }).payload.ctaTarget,
    ).toBe("home");
  });

  it("builds reschedule notifications that keep the customer in agenda", () => {
    const notification = buildAppointmentRescheduledNotification({
      appointmentId: "appointment-1",
      nextServiceName: "Trança",
      nextStaffMemberName: "Maria",
      nextStartsAt: "2099-04-12T16:00:00.000Z",
      previousStartsAt: "2099-04-12T15:00:00.000Z",
      previousStaffMemberName: "Tania",
      previousServiceName: "Trança boxeadora",
    });

    expect(notification).toEqual(
      expect.objectContaining({
        type: "appointment_rescheduled",
        title: "Seu horário mudou no salão",
        payload: expect.objectContaining({
          appointmentId: "appointment-1",
          ctaTarget: "appointments",
          openInbox: true,
          targetTabIndex: 1,
        }),
      }),
    );
    expect(notification.body).toContain("Antes:");
    expect(notification.body).toContain("Agora:");
  });

  it("builds no-show notifications that keep the customer in agenda", () => {
    const notification = buildAppointmentNoShowNotification({
      appointmentId: "appointment-2",
      serviceName: "Corte",
      startsAt: "2099-04-12T16:00:00.000Z",
      staffMemberName: "Rafa",
    });

    expect(notification).toEqual(
      expect.objectContaining({
        type: "appointment_no_show",
        title: "Seu horário foi marcado como falta",
        payload: expect.objectContaining({
          appointmentId: "appointment-2",
          ctaTarget: "appointments",
          openInbox: true,
          targetTabIndex: 1,
        }),
      }),
    );
  });

  it("sends every customer notification as push and inbox", () => {
    expect(resolveCustomerNotificationDeliveryPolicy("service_updated")).toEqual({
      deliveryChannel: "push_and_inbox",
      pushPriority: "high",
    });

    expect(
      prepareCustomerNotificationPayload("manual_whatsapp_message", {
        type: "manual_whatsapp_message",
      }),
    ).toEqual(
      expect.objectContaining({
        deliveryChannel: "push_and_inbox",
        pushPriority: "high",
      }),
    );
  });

  it("keeps newly published services as push notifications", () => {
    expect(resolveCustomerNotificationDeliveryPolicy("service_published")).toEqual({
      deliveryChannel: "push_and_inbox",
      pushPriority: "high",
    });

    expect(
      prepareCustomerNotificationPayload("service_published", {
        type: "service_published",
      }),
    ).toEqual(
      expect.objectContaining({
        deliveryChannel: "push_and_inbox",
        pushPriority: "high",
      }),
    );
  });

  it("keeps transactional alerts as push with high priority", () => {
    expect(
      prepareCustomerNotificationPayload("appointment_confirmed", {
        type: "appointment_confirmed",
      }),
    ).toEqual(
      expect.objectContaining({
        deliveryChannel: "push_and_inbox",
        pushPriority: "high",
      }),
    );
  });

  it("applies stable navigation defaults for every major notification family", () => {
    expect(resolveCustomerNotificationNavigationDefaults("appointment_confirmed")).toEqual({
      ctaTarget: "appointments",
      targetTabIndex: 1,
    });
    expect(resolveCustomerNotificationNavigationDefaults("store_product_updated")).toEqual({
      ctaTarget: "store",
      targetTabIndex: 2,
    });
    expect(resolveCustomerNotificationNavigationDefaults("feed_post_published")).toEqual({
      ctaTarget: "feed",
      targetTabIndex: 3,
    });
    expect(resolveCustomerNotificationNavigationDefaults("membership_request_approved")).toEqual({
      ctaTarget: "profile",
      targetTabIndex: 4,
    });
    expect(resolveCustomerNotificationNavigationDefaults("membership_request_paid")).toEqual({
      ctaTarget: "profile",
      targetTabIndex: 4,
    });
  });

  it("fills navigation metadata when a payload omits it", () => {
    expect(
      prepareCustomerNotificationPayload("appointment_confirmation_required", {
        type: "appointment_confirmation_required",
      }),
    ).toEqual(
      expect.objectContaining({
        ctaTarget: "appointments",
        targetTabIndex: 1,
      }),
    );
    expect(
      prepareCustomerNotificationPayload("membership_request_approved", {
        type: "membership_request_approved",
      }),
    ).toEqual(
      expect.objectContaining({
        ctaTarget: "profile",
        targetTabIndex: 4,
      }),
    );
    expect(
      prepareCustomerNotificationPayload("membership_request_paid", {
        type: "membership_request_paid",
      }),
    ).toEqual(
      expect.objectContaining({
        ctaTarget: "profile",
        targetTabIndex: 4,
      }),
    );
  });
});
