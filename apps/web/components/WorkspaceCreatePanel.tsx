"use client";

import { useEffect, useId, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

type WorkspaceCreatePanelProps = {
  buttonClassName?: string;
  buttonLabel: string;
  children: ReactNode;
  className?: string;
  description?: string;
  dialogClassName?: string;
  dialogDescription?: string;
  dialogTitle?: string;
  eyebrow?: string;
  helper?: string;
  id: string;
  title: string;
  variant?: "card" | "button";
};

export function WorkspaceCreatePanel({
  buttonClassName = "primary-button",
  buttonLabel,
  children,
  className,
  description,
  dialogClassName,
  dialogDescription,
  dialogTitle,
  eyebrow,
  helper,
  id,
  title,
  variant = "card",
}: WorkspaceCreatePanelProps) {
  const [open, setOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const headingId = useId();
  const resolvedDialogTitle = dialogTitle ?? title;
  const resolvedDialogDescription = dialogDescription ?? description;

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    const previousDocumentOverflow = document.documentElement.style.overflow;
    document.documentElement.classList.add("workspace-modal-open");
    document.body.classList.add("workspace-modal-open");
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.documentElement.style.overflow = previousDocumentOverflow;
      document.body.classList.remove("workspace-modal-open");
      document.documentElement.classList.remove("workspace-modal-open");
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const modal =
    open && isMounted
      ? createPortal(
          <div
            className="workspace-create-backdrop"
            onClick={() => setOpen(false)}
            role="presentation"
          >
            <div
              className={`workspace-create-dialog form-panel${dialogClassName ? ` ${dialogClassName}` : ""}`}
              role="dialog"
              aria-modal="true"
              aria-labelledby={headingId}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="workspace-create-dialog__header">
                <div>
                  {eyebrow ? <span className="eyebrow">{eyebrow}</span> : null}
                  <h3 id={headingId}>{resolvedDialogTitle}</h3>
                  {resolvedDialogDescription ? (
                    <p className="muted">{resolvedDialogDescription}</p>
                  ) : null}
                  {helper ? (
                    <small className="list-meta workspace-create-dialog__helper">
                      {helper}
                    </small>
                  ) : null}
                </div>

                <button
                  type="button"
                  className="workspace-create-dialog__close"
                  onClick={() => setOpen(false)}
                >
                  Fechar
                </button>
              </div>

              <div className="workspace-create-dialog__content">{children}</div>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      {variant === "card" ? (
        <section
          id={id}
          className={`card content-card create-launcher-card${className ? ` ${className}` : ""}`}
        >
          <div className="section-heading create-launcher-card__header">
            <div>
              {eyebrow ? <span className="eyebrow">{eyebrow}</span> : null}
              <h2>{title}</h2>
              {description ? <p className="muted">{description}</p> : null}
            </div>

            <button
              type="button"
              className={buttonClassName}
              onClick={() => setOpen(true)}
            >
              {buttonLabel}
            </button>
          </div>
        </section>
      ) : (
        <div
          id={id}
          className={`workspace-create-trigger${className ? ` ${className}` : ""}`}
        >
          <button
            type="button"
            className={buttonClassName}
            onClick={() => setOpen(true)}
          >
            {buttonLabel}
          </button>
        </div>
      )}
      {modal}
    </>
  );
}
