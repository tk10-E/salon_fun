"use client";

import { useState } from "react";

import { postInternalAiJson } from "@/lib/ai/clientRequest";

type FeedAiDraftAssistantProps = {
  aiEnabled: boolean;
  initialNotes?: string;
};

type DraftResponse = {
  draft?: {
    caption: string;
    model: string;
    title: string;
  };
  error?: string;
  ok: boolean;
};

function readInputValue<T extends HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
  id: string,
) {
  const element = document.getElementById(id) as T | null;
  return element?.value?.trim() ?? "";
}

function writeFieldValue(id: string, value: string) {
  const element = document.getElementById(id) as
    | HTMLInputElement
    | HTMLTextAreaElement
    | null;

  if (!element) {
    return;
  }

  element.value = value;
  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
}

function getFriendlyErrorMessage(error: string | undefined) {
  switch (error) {
    case "ai_not_configured":
      return "A IA não está disponível agora para este salão.";
    case "invalid_service":
      return "O serviço escolhido não faz parte deste salão.";
    case "invalid_staff_member":
      return "O profissional escolhido não faz parte deste salão.";
    case "unauthenticated":
      return "Sua sessão expirou. Entre novamente para usar a IA.";
    case "too_many_requests":
      return "A IA recebeu muitas tentativas seguidas. Aguarde um pouco e tente novamente.";
    case "request_timeout":
      return "A IA demorou mais do que o esperado. Tente de novo em instantes.";
    default:
      return "Não foi possível gerar o texto agora. Tente novamente em instantes.";
  }
}

export function FeedAiDraftAssistant({
  aiEnabled,
  initialNotes = "",
}: FeedAiDraftAssistantProps) {
  const [notes, setNotes] = useState(initialNotes);
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<{
    message: string;
    tone: "error" | "success";
  } | null>(null);

  async function handleGenerate() {
    setIsLoading(true);
    setStatus(null);

    try {
      const { payload, response } = await postInternalAiJson<DraftResponse>(
        "/api/internal/ai/feed-draft",
        {
          captionHint: readInputValue<HTMLTextAreaElement>("feed-caption"),
          notes,
          postType: readInputValue<HTMLSelectElement>("feed-type") || "standard",
          serviceId: readInputValue<HTMLSelectElement>("feed-service"),
          staffMemberId: readInputValue<HTMLSelectElement>("feed-staff-member"),
          titleHint: readInputValue<HTMLInputElement>("feed-title"),
        },
      );

      if (!response.ok || !payload?.ok || !payload.draft) {
        setStatus({
          message: getFriendlyErrorMessage(payload?.error),
          tone: "error",
        });
        return;
      }

      writeFieldValue("feed-title", payload.draft.title);
      writeFieldValue("feed-caption", payload.draft.caption);

      setStatus({
        message: "Rascunho criado com IA.",
        tone: "success",
      });
    } catch (error) {
      setStatus({
        message: getFriendlyErrorMessage(
          error instanceof Error ? error.message : undefined,
        ),
        tone: "error",
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="simple-list" style={{ marginBottom: 12 }}>
      <article className="simple-row">
        <strong>Assistente de IA</strong>
        <p className="muted">
          Crie título e legenda com base no formato, no serviço e no
          profissional. Você só revisa e publica.
        </p>

        <div className="field" style={{ marginTop: 8 }}>
          <label htmlFor="feed-ai-notes">Orientação para a IA</label>
          <textarea
            id="feed-ai-notes"
            rows={3}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Ex.: destaque a promoção da semana, fale de resultado natural e convide para agendar."
          />
          <small className="muted">
            Use este campo para direcionar o tom da legenda antes de gerar.
          </small>
        </div>

        <div className="simple-row__actions" style={{ marginTop: 8 }}>
          <button
            type="button"
            className="secondary-button"
            onClick={handleGenerate}
            disabled={!aiEnabled || isLoading}
          >
            {isLoading ? "Gerando..." : "Criar título e legenda com IA"}
          </button>
        </div>

        {!aiEnabled ? (
          <p className="muted" role="status">
            A IA não está disponível agora para criar textos.
          </p>
        ) : null}

        {status ? (
          <p
            className="muted"
            role="status"
            style={{
              color: status.tone === "error" ? "#9f3a38" : "#2b6f4a",
              marginTop: 6,
            }}
          >
            {status.message}
          </p>
        ) : null}
      </article>
    </div>
  );
}
