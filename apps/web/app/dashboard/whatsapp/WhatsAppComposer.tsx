"use client";

import { useEffect, useRef, useState } from "react";

export type WhatsAppQuickReplyOption = {
  label: string;
  message: string;
};

export type WhatsAppQuickReplySection = {
  label: string;
  replies: WhatsAppQuickReplyOption[];
};

type WhatsAppComposerProps = {
  autoFocus?: boolean;
  defaultValue: string;
  hint: string;
  placeholder?: string;
  quickReplySections?: WhatsAppQuickReplySection[];
  quickReplies?: WhatsAppQuickReplyOption[];
  quickRepliesLabel?: string;
  textareaId: string;
};

function ComposerSubmitButton({ pending }: { pending: boolean }) {
  return (
    <button type="submit" className="primary-button" disabled={pending}>
      {pending ? "Enviando..." : "Enviar mensagem"}
    </button>
  );
}

export function WhatsAppComposer({
  autoFocus = false,
  defaultValue,
  hint,
  placeholder,
  quickReplySections,
  quickReplies = [],
  quickRepliesLabel = "Respostas rápidas",
  textareaId,
}: WhatsAppComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [message, setMessage] = useState(defaultValue);
  const [pending, setPending] = useState(false);
  const resolvedQuickReplySections =
    quickReplySections?.filter((section) => section.replies.length) ??
    (quickReplies.length
      ? [
          {
            label: quickRepliesLabel,
            replies: quickReplies,
          },
        ]
      : []);

  useEffect(() => {
    setMessage(defaultValue);
    setPending(false);
  }, [defaultValue]);

  useEffect(() => {
    const form = textareaRef.current?.form;
    if (!form) {
      return;
    }

    const handleSubmit = () => setPending(true);
    form.addEventListener("submit", handleSubmit);

    return () => {
      form.removeEventListener("submit", handleSubmit);
    };
  }, []);

  return (
    <>
      {resolvedQuickReplySections.length ? (
        <div className="whatsapp-quick-replies-stack">
          {resolvedQuickReplySections.map((section, index) => (
            <div key={`${section.label}-${index}`} className="whatsapp-quick-replies">
              <span className="whatsapp-quick-replies__label">
                {section.label}
              </span>
              <div className="whatsapp-quick-replies__list">
                {section.replies.map((reply) => (
                  <button
                    key={reply.label}
                    type="button"
                    className="whatsapp-quick-replies__button"
                    disabled={pending}
                    onClick={() => setMessage(reply.message)}
                  >
                    {reply.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <div className="whatsapp-quick-replies__actions">
            <button
              type="button"
              className="whatsapp-quick-replies__button whatsapp-quick-replies__button--ghost"
              disabled={pending}
              onClick={() => setMessage("")}
            >
              Limpar
            </button>
          </div>
        </div>
      ) : null}

      <div className="field">
        <label htmlFor={textareaId}>Mensagem</label>
        <textarea
          ref={textareaRef}
          id={textareaId}
          name="message"
          rows={4}
          value={message}
          autoFocus={autoFocus}
          disabled={pending}
          placeholder={placeholder}
          onChange={(event) => setMessage(event.target.value)}
          onKeyDown={(event) => {
            if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
              event.preventDefault();
              event.currentTarget.form?.requestSubmit();
            }
          }}
        />
      </div>

      <div className="whatsapp-chat__composer-footer">
        <p className="whatsapp-chat__composer-hint">
          {hint} Use Ctrl + Enter para enviar mais rápido.
        </p>
        <ComposerSubmitButton pending={pending} />
      </div>
    </>
  );
}
