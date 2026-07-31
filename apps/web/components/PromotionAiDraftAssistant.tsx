"use client";

import { useState } from "react";

import { postInternalAiJson } from "@/lib/ai/clientRequest";

type PromotionAiDraftAssistantProps = {
  aiEnabled: boolean;
  initialGoal?: string;
  initialNotes?: string;
};

type DraftResponse = {
  draft?: {
    description: string;
    endsOn: string | null;
    highlightText: string;
    model: string;
    priceSuggestion: number | null;
    serviceId: string | null;
    sessionsIncluded: number | null;
    startsOn: string | null;
    title: string;
    validityDays: number | null;
  };
  error?: string;
  ok: boolean;
};

type PromotionDraftKind = "membership" | "promotion";

type ServiceOption = {
  id: string;
  label: string;
};

const PROMOTION_GOAL_OPTIONS = [
  "lotar a agenda desta semana",
  "sexta com baixo movimento",
  "reativar clientes parados",
  "vender um plano mensal",
] as const;

function readInputValue<
  T extends HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement,
>(id: string) {
  const element = document.getElementById(id) as T | null;
  return element?.value?.trim() ?? "";
}

function writeFieldValue(id: string, value: string) {
  const element = document.getElementById(id) as
    | HTMLInputElement
    | HTMLSelectElement
    | HTMLTextAreaElement
    | null;

  if (!element) {
    return;
  }

  element.value = value;
  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
}

function writeCheckboxValue(id: string, checked: boolean) {
  const element = document.getElementById(id) as HTMLInputElement | null;

  if (!element) {
    return;
  }

  element.checked = checked;
  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
}

function readServiceOptions() {
  const select = document.getElementById(
    "offer-membership-service",
  ) as HTMLSelectElement | null;

  if (!select) {
    return [] as ServiceOption[];
  }

  return Array.from(select.options)
    .filter((option) => option.value.trim())
    .map((option) => ({
      id: option.value.trim(),
      label: option.text.trim(),
    }));
}

function getFriendlyErrorMessage(error: string | undefined) {
  switch (error) {
    case "ai_not_configured":
      return "A IA não está disponível agora para este salão.";
    case "invalid_service":
      return "O serviço escolhido não faz parte deste salão.";
    case "unauthenticated":
      return "Sua sessão expirou. Entre novamente para usar a IA.";
    case "too_many_requests":
      return "A IA recebeu muitas tentativas seguidas. Aguarde um pouco e tente novamente.";
    case "request_timeout":
      return "A IA demorou mais do que o esperado. Tente de novo em instantes.";
    default:
      return "Não foi possível montar a oferta agora. Tente novamente em instantes.";
  }
}

function readPriceHint() {
  const rawValue = readInputValue<HTMLInputElement>("offer-price");

  if (!rawValue) {
    return null;
  }

  const normalized = Number(rawValue.replace(",", "."));
  return Number.isFinite(normalized) && normalized >= 0 ? normalized : null;
}

function resolveDraftKind(goal: string): PromotionDraftKind {
  const selectedKind = readInputValue<HTMLSelectElement>("offer-kind");

  if (selectedKind === "membership") {
    return "membership";
  }

  return goal === "vender um plano mensal" ? "membership" : "promotion";
}

function resolveInitialGoal(initialGoal: string | undefined) {
  if (
    initialGoal &&
    PROMOTION_GOAL_OPTIONS.includes(
      initialGoal as (typeof PROMOTION_GOAL_OPTIONS)[number],
    )
  ) {
    return initialGoal;
  }

  return PROMOTION_GOAL_OPTIONS[0];
}

export function PromotionAiDraftAssistant({
  aiEnabled,
  initialGoal,
  initialNotes = "",
}: PromotionAiDraftAssistantProps) {
  const [goal, setGoal] = useState(resolveInitialGoal(initialGoal));
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
      const kind = resolveDraftKind(goal);
      const serviceOptions = kind === "membership" ? readServiceOptions() : [];

      const { payload, response } = await postInternalAiJson<DraftResponse>(
        "/api/internal/ai/promotion-draft",
        {
          descriptionHint: readInputValue<HTMLTextAreaElement>(
            "offer-description",
          ),
          goal,
          highlightHint: readInputValue<HTMLInputElement>("offer-highlight"),
          kind,
          notes,
          priceHint: readPriceHint(),
          serviceId: readInputValue<HTMLSelectElement>("offer-membership-service"),
          serviceOptions,
          titleHint: readInputValue<HTMLInputElement>("offer-title"),
        },
      );

      if (!response.ok || !payload?.ok || !payload.draft) {
        setStatus({
          message: getFriendlyErrorMessage(payload?.error),
          tone: "error",
        });
        return;
      }

      writeFieldValue("offer-kind", kind);
      writeFieldValue("offer-title", payload.draft.title);
      writeFieldValue("offer-highlight", payload.draft.highlightText);
      writeFieldValue("offer-description", payload.draft.description);
      writeCheckboxValue("offer-active", true);

      if (payload.draft.priceSuggestion != null) {
        writeFieldValue(
          "offer-price",
          payload.draft.priceSuggestion.toFixed(2),
        );
      }

      if (payload.draft.startsOn) {
        writeFieldValue("offer-start", payload.draft.startsOn);
      }

      if (payload.draft.endsOn) {
        writeFieldValue("offer-end", payload.draft.endsOn);
      }

      if (kind === "membership") {
        if (payload.draft.serviceId) {
          writeFieldValue("offer-membership-service", payload.draft.serviceId);
        }

        if (payload.draft.sessionsIncluded != null) {
          writeFieldValue(
            "offer-membership-sessions",
            String(payload.draft.sessionsIncluded),
          );
        }

        if (payload.draft.validityDays != null) {
          writeFieldValue(
            "offer-membership-validity",
            String(payload.draft.validityDays),
          );
        }
      } else {
        writeFieldValue("offer-membership-service", "");
        writeFieldValue("offer-membership-sessions", "");
        writeFieldValue("offer-membership-validity", "");
      }

      setStatus({
        message: "Oferta preenchida com a IA. Revise e publique.",
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
    <div style={{ display: "grid", gap: 12, marginBottom: 16 }}>
      <div
        style={{
          border: "1px solid rgba(214, 197, 182, 0.84)",
          borderRadius: 22,
          padding: 16,
          background: "rgba(255, 255, 255, 0.78)",
        }}
      >
        <strong>Assistente de IA</strong>
        <p style={{ color: "#715d50", margin: "8px 0 0" }}>
          A IA preenche título, chamada, descrição, período da campanha e
          sugestão comercial com base no contexto do salão. Você só revisa e
          publica.
        </p>

        <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
          <label className="field">
            <span>Objetivo da campanha</span>
            <select value={goal} onChange={(event) => setGoal(event.target.value)}>
              <option value="lotar a agenda desta semana">
                Lotar a agenda desta semana
              </option>
              <option value="sexta com baixo movimento">
                Sexta com baixo movimento
              </option>
              <option value="reativar clientes parados">
                Reativar clientes sem retorno
              </option>
              <option value="vender um plano mensal">
                Vender um plano mensal
              </option>
            </select>
          </label>

          <label className="field">
            <span>Orientação para a IA</span>
            <textarea
              id="offer-ai-notes"
              rows={3}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Ex.: destaque a urgência, valorize cabelo curto e mantenha o texto premium, simples e fácil de vender."
            />
          </label>
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
          <button
            type="button"
            className="secondary-button"
            onClick={handleGenerate}
            disabled={!aiEnabled || isLoading}
          >
            {isLoading ? "Preenchendo..." : "Preencher oferta com IA"}
          </button>
        </div>

        {!aiEnabled ? (
          <p className="muted" role="status" style={{ marginTop: 8 }}>
            A IA não está disponível agora para criar ofertas.
          </p>
        ) : null}

        {status ? (
          <p
            className="muted"
            role="status"
            style={{
              color: status.tone === "error" ? "#9f3a38" : "#2b6f4a",
              marginTop: 8,
            }}
          >
            {status.message}
          </p>
        ) : null}
      </div>
    </div>
  );
}
