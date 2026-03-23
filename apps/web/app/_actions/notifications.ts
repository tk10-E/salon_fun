import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireOwnerSalon } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

import { buildRedirectNotice } from "./shared";

function readNotificationDeleteRequest(formData: FormData) {
  const singleDeleteId = String(formData.get("singleDeleteId") ?? "").trim();
  const selectedNotificationIds = formData
    .getAll("notificationIds")
    .map((entry) => String(entry).trim())
    .filter(Boolean);
  const notificationIds = [...new Set(singleDeleteId ? [singleDeleteId] : selectedNotificationIds)];
  const returnPathCurrent =
    String(formData.get("returnPathCurrent") ?? "").trim() || "/dashboard/notifications";
  const returnPathPrevious = String(formData.get("returnPathPrevious") ?? "").trim();
  const pageItemCount = Number.parseInt(String(formData.get("pageItemCount") ?? "0"), 10);
  const shouldGoPrevious = pageItemCount > 0 && notificationIds.length >= pageItemCount && !!returnPathPrevious;
  const returnPath = shouldGoPrevious ? returnPathPrevious : returnPathCurrent;

  return {
    notificationIds,
    returnPath,
    returnPathCurrent,
  };
}

export async function deleteSalonNotificationActionImpl(formData: FormData) {
  const { notificationIds, returnPath, returnPathCurrent } = readNotificationDeleteRequest(formData);
  const { salon } = await requireOwnerSalon();
  const supabase = createClient();

  if (!notificationIds.length) {
    redirect(buildRedirectNotice(returnPathCurrent, "Selecione pelo menos um aviso para excluir.", "error"));
  }

  const { data: existingNotifications, error: notificationError } = await supabase
    .from("salon_customer_notifications")
    .select("id")
    .in("id", notificationIds)
    .eq("salon_id", salon.id)
    .returns<{ id: string }[]>();

  if (notificationError || !(existingNotifications?.length ?? 0)) {
    redirect(buildRedirectNotice(returnPath, "Não foi possível localizar esse aviso.", "error"));
  }

  const existingIds = existingNotifications.map((notification) => notification.id);

  const { data: deletedNotifications, error: deleteError } = await supabase
    .from("salon_customer_notifications")
    .delete()
    .in("id", existingIds)
    .eq("salon_id", salon.id)
    .select("id");

  if (deleteError) {
    redirect(buildRedirectNotice(returnPath, "Não foi possível excluir esse aviso.", "error"));
  }

  const deletedCount = deletedNotifications?.length ?? 0;

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/notifications");
  redirect(
    buildRedirectNotice(
      returnPath,
      deletedCount > 1
        ? `${deletedCount} avisos excluídos com sucesso.`
        : "Aviso excluído com sucesso.",
      "success",
    ),
  );
}
