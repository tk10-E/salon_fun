"use client";

import { useEffect, useState } from "react";

import { deleteServiceAction } from "@/app/actions";

type ConfirmServiceDeleteButtonProps = {
  serviceId: string;
  serviceName: string;
};

export function ConfirmServiceDeleteButton({
  serviceId,
  serviceName,
}: ConfirmServiceDeleteButtonProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <>
      <button type="button" className="danger-button" onClick={() => setOpen(true)}>
        Excluir serviço
      </button>

      {open ? (
        <div className="confirm-modal-backdrop" onClick={() => setOpen(false)} role="presentation">
          <div
            className="confirm-modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby={`delete-service-title-${serviceId}`}
            onClick={(event) => event.stopPropagation()}
          >
            <span className="eyebrow">Confirmar exclusão</span>
            <h3 id={`delete-service-title-${serviceId}`}>Excluir {serviceName}?</h3>
            <p className="muted">
              Essa ação remove o serviço da vitrine do app do cliente. Se ele já estiver em agendamentos ou em posts do
              feed, o sistema vai bloquear a exclusão para proteger os dados do salão.
            </p>

            <div className="confirm-modal-actions">
              <button type="button" className="secondary-button" onClick={() => setOpen(false)}>
                Voltar
              </button>

              <form action={deleteServiceAction}>
                <input type="hidden" name="serviceId" value={serviceId} />
                <button type="submit" className="danger-button">
                  Confirmar exclusão
                </button>
              </form>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
