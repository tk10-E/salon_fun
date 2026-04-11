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

      <div className="notification-log-toolbar">
        <label className="notification-log-toolbar__toggle">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={(event) => toggleAll(event.target.checked)}
          />
          Marcar todos desta página
        </label>

        <div className="notification-log-toolbar__actions">
          <span className="services-toolbar__count">
            {selectedIds.length} {selectedIds.length === 1 ? "aviso selecionado" : "avisos selecionados"}
          </span>
          <button type="submit" className="danger-button" disabled={selectedIds.length === 0}>
            Excluir selecionados
          </button>
        </div>
      </div>

      <div className="row-list notification-log-list">
        {items.map((item) => {
          const { notification, category, customerName, dispatchSnapshot } = item;
          const isSelected = selectedIds.includes(notification.id);
          const createdAtLabel = new Intl.DateTimeFormat("pt-BR", {
            dateStyle: "short",
            timeStyle: "short",
            timeZone: "America/Sao_Paulo",
          }).format(new Date(notification.created_at));
          const dispatchLabel = dispatchSnapshot
            ? `${formatDispatchStatus(dispatchSnapshot.status)}${
                dispatchSnapshot.sent_count != null || dispatchSnapshot.failed_count != null
                  ? ` • enviados ${dispatchSnapshot.sent_count ?? 0} • falhas ${dispatchSnapshot.failed_count ?? 0}`
                  : ""
              }`
            : "O envio desse aviso ainda está sendo processado.";
          const destinationLabel =
            notification.audience === "single_customer"
              ? customerName ?? "Cliente específico"
              : "Clientes do app deste salão";

          return (
            <article key={notification.id} className="list-row notification-log-card">
              <div className="list-row__content notification-log-card__content">
                <div className="notification-log-card__header">
                  <div className="notification-log-card__selection">
                    <label className="notification-log-card__checkbox">
                      <input
                        type="checkbox"
                        name="notificationIds"
                        value={notification.id}
                        checked={isSelected}
                        onChange={(event) => toggleSelection(notification.id, event.target.checked)}
                      />
                      Selecionar
                    </label>
                    <div className="notification-log-card__badges">
                      <span className={badgeClassForCategory(category)}>{formatCategoryLabel(category)}</span>
                      <span className="badge badge--soft">{formatAudienceLabel(notification.audience)}</span>
                      <span className={badgeClassForDispatchStatus(dispatchSnapshot?.status)}>
                        {formatDispatchStatus(dispatchSnapshot?.status)}
                      </span>
                    </div>
                  </div>

                  <div className="notification-log-card__header-actions">
                    <small className="notification-log-card__timestamp">
                      Enviado em {createdAtLabel}
                    </small>
                    <button
                      type="submit"
                      name="singleDeleteId"
                      value={notification.id}
                      className="danger-button"
                    >
                      Excluir aviso
                    </button>
                  </div>
                </div>

                <div className="notification-log-card__body">
                  <div className="notification-log-card__copy">
                    <h3>{notification.title}</h3>
                    <p className="notification-log-card__description">{notification.body}</p>
                  </div>

                  <div className="notification-log-card__meta-grid">
                    <div className="notification-log-card__meta-item">
                      <span className="notification-log-card__meta-label">Tipo do aviso</span>
                      <strong>{formatNotificationType(notification.notification_type)}</strong>
                      <p>Ajuda a entender rapidamente o objetivo desse disparo.</p>
                    </div>

                    <div className="notification-log-card__meta-item">
                      <span className="notification-log-card__meta-label">Resultado do envio</span>
                      <strong>{formatDispatchStatus(dispatchSnapshot?.status)}</strong>
                      <p>{dispatchLabel}</p>
                    </div>

                    <div className="notification-log-card__meta-item">
                      <span className="notification-log-card__meta-label">Destino</span>
                      <strong>{destinationLabel}</strong>
                      <p>
                        {notification.audience === "single_customer"
                          ? "Aviso enviado para uma pessoa específica da base."
                          : "Disparo voltado para toda a base ativa do app do cliente."}
                      </p>
                    </div>

                    <div
                      className={`notification-log-card__meta-item${
                        dispatchSnapshot?.error_detail ? " notification-log-card__meta-item--danger" : ""
                      }`}
                    >
                      <span className="notification-log-card__meta-label">Observação</span>
                      <strong>
                        {dispatchSnapshot?.error_detail ? "Vale revisar este aviso" : "Sem alerta relevante"}
                      </strong>
                      <p>
                        {dispatchSnapshot?.error_detail ??
                          "Nao houve nenhum alerta relevante no envio mais recente desse aviso."}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </form>
  );
}
