"use client";

import { useState } from "react";

import { deleteSalonNotificationAction } from "@/app/actions";

import {
  badgeClassForDispatchStatus,
  badgeClassForCategory,
  formatAudienceLabel,
  formatCategoryLabel,
  formatDispatchStatus,
  formatNotificationType,
  type NotificationCategory,
  type NotificationDispatchSnapshot,
  type NotificationRow,
} from "./shared";

type NotificationListItem = {
  notification: NotificationRow;
  category: NotificationCategory;
  customerName: string | null;
  dispatchSnapshot: NotificationDispatchSnapshot | null;
};

type NotificationsListProps = {
  items: NotificationListItem[];
  returnPathCurrent: string;
  returnPathPrevious: string;
};

export function NotificationsList({
  items,
  returnPathCurrent,
  returnPathPrevious,
}: NotificationsListProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const allSelected = items.length > 0 && selectedIds.length === items.length;

  function toggleSelection(notificationId: string, checked: boolean) {
    setSelectedIds((current) => {
      if (checked) {
        if (current.includes(notificationId)) {
          return current;
        }

        return [...current, notificationId];
      }

      return current.filter((id) => id !== notificationId);
    });
  }

  function toggleAll(checked: boolean) {
    setSelectedIds(checked ? items.map((item) => item.notification.id) : []);
  }

  return (
    <form action={deleteSalonNotificationAction}>
      <input type="hidden" name="returnPathCurrent" value={returnPathCurrent} />
      <input type="hidden" name="returnPathPrevious" value={returnPathPrevious} />
      <input type="hidden" name="pageItemCount" value={String(items.length)} />

      <div
        className="inline-actions"
        style={{ marginBottom: 16, justifyContent: "space-between", alignItems: "center" }}
      >
        <label
          style={{ display: "inline-flex", alignItems: "center", gap: 10, fontWeight: 700, cursor: "pointer" }}
        >
          <input
            type="checkbox"
            checked={allSelected}
            onChange={(event) => toggleAll(event.target.checked)}
          />
          Marcar todos desta página
        </label>

        <div className="inline-actions" style={{ alignItems: "center" }}>
          <span className="services-toolbar__count">
            {selectedIds.length} {selectedIds.length === 1 ? "aviso selecionado" : "avisos selecionados"}
          </span>
          <button type="submit" className="danger-button" disabled={selectedIds.length === 0}>
            Excluir selecionados
          </button>
        </div>
      </div>

      <div className="row-list">
        {items.map((item) => {
          const { notification, category, customerName, dispatchSnapshot } = item;
          const isSelected = selectedIds.includes(notification.id);

          return (
            <article key={notification.id} className="list-row">
              <div className="list-row__content">
                <div
                  className="inline-actions"
                  style={{ marginBottom: 8, justifyContent: "space-between", alignItems: "flex-start" }}
                >
                  <div className="inline-actions" style={{ alignItems: "center" }}>
                    <label
                      style={{ display: "inline-flex", alignItems: "center", gap: 8, fontWeight: 700, cursor: "pointer" }}
                    >
                      <input
                        type="checkbox"
                        name="notificationIds"
                        value={notification.id}
                        checked={isSelected}
                        onChange={(event) => toggleSelection(notification.id, event.target.checked)}
                      />
                      Selecionar
                    </label>
                    <span className={badgeClassForCategory(category)}>{formatCategoryLabel(category)}</span>
                    <span className="badge badge--soft">{formatAudienceLabel(notification.audience)}</span>
                    <span className={badgeClassForDispatchStatus(dispatchSnapshot?.status)}>
                      {formatDispatchStatus(dispatchSnapshot?.status)}
                    </span>
                  </div>

                  <button
                    type="submit"
                    name="singleDeleteId"
                    value={notification.id}
                    className="danger-button"
                  >
                    Excluir aviso
                  </button>
                </div>
                <h3>{notification.title}</h3>
                <p className="muted list-description">{notification.body}</p>
                <small className="list-meta">
                  Tipo interno: {formatNotificationType(notification.notification_type)}
                </small>
                <small className="list-meta">
                  Enviado em {new Intl.DateTimeFormat("pt-BR", {
                    dateStyle: "short",
                    timeStyle: "short",
                    timeZone: "America/Sao_Paulo",
                  }).format(new Date(notification.created_at))}
                </small>
                {dispatchSnapshot ? (
                  <small className="list-meta">
                    Auditoria push: {formatDispatchStatus(dispatchSnapshot.status)}
                    {dispatchSnapshot.sent_count != null || dispatchSnapshot.failed_count != null
                      ? ` • enviados ${dispatchSnapshot.sent_count ?? 0} • falhas ${dispatchSnapshot.failed_count ?? 0}`
                      : ""}
                    {dispatchSnapshot.response_status != null
                      ? ` • resposta ${dispatchSnapshot.response_status}`
                      : ""}
                  </small>
                ) : (
                  <small className="list-meta">
                    Auditoria push: ainda sem snapshot de despacho para esse aviso.
                  </small>
                )}
                {dispatchSnapshot?.error_detail ? (
                  <small className="list-meta">Último erro: {dispatchSnapshot.error_detail}</small>
                ) : null}
                {notification.audience === "single_customer" ? (
                  <small className="list-meta">Destino: {customerName ?? "Cliente específico"}</small>
                ) : (
                  <small className="list-meta">Destino: clientes do app deste salão</small>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </form>
  );
}
