"use client";

import Link from "next/link";
import { useState } from "react";

import { postInternalAiJson } from "@/lib/ai/clientRequest";
import type { RecoveryCampaignSnapshot } from "@/lib/ai/recoveryCampaign";

type DashboardRecoveryCampaignPanelProps = {
  aiEnabled: boolean;
  question?: string;
  snapshot: RecoveryCampaignSnapshot;
};

type RecoveryResponse = {
  error?: string;
  ok: boolean;
  recovery?: {
    available: boolean;
    candidates: Array<{
      avgTicketLabel: string;
      chanceLabel: string;
      customerId: string;
      daysSinceLastVisitLabel: string;
      name: string;
      reasonLabel: string;
      score: number;
    }>;
    ctaHref: string | null;
    ctaLabel: string | null;
    draft: {
      campaignName: string;
      discountLabel: string;
      instagramCaption: string;
      model: string;
      priceSuggestion: number | null;
      strategyBullets: string[];
      whatsappText: string;
    } | null;
    followUp: string | null;
    snapshot: RecoveryCampaignSnapshot;
  };
};

function getFriendlyErrorMessage(error: string | undefined) {
  switch (error) {
    case "invalid_request":
      return "Não foi possível montar a sugestão com esse pedido.";
    case "too_many_requests":
      return "A IA recebeu muitas tentativas em sequência. Aguarde um instante e tente novamente.";
    case "request_timeout":
      return "A IA demorou além do esperado para montar a campanha. Tente novamente em instantes.";
    case "unauthenticated":
      return "Sua sessão expirou. Entre novamente para usar esse recurso.";
    default:
      return "Não foi possível montar a sugestão agora. Tente novamente em instantes.";
  }
}

export function DashboardRecoveryCampaignPanel({
  aiEnabled,
  question,
  snapshot,
}: DashboardRecoveryCampaignPanelProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<{
    message: string;
    tone: "error" | "success";
  } | null>(null);
  const [recovery, setRecovery] = useState<RecoveryResponse["recovery"] | null>(
    null,
  );

  async function handleGenerate() {
    setIsLoading(true);
    setStatus(null);

    try {
      const { payload, response } = await postInternalAiJson<RecoveryResponse>(
        "/api/internal/ai/recovery-campaign",
        {
          question: question ?? "Preencher agenda de amanhã com IA",
        },
        15_000,
      );

      if (!response.ok || !payload?.ok || !payload.recovery) {
        setRecovery(null);
        setStatus({
          message: getFriendlyErrorMessage(payload?.error),
          tone: "error",
        });
        return;
      }

      setRecovery(payload.recovery);
      setStatus({
        message: payload.recovery.draft
          ? "Sugestão pronta para revisão."
          : "Oportunidade encontrada, mas ainda sem texto sugerido.",
        tone: "success",
      });
    } catch (error) {
      setRecovery(null);
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
    <article className="card content-card dashboard-panel dashboard-panel--recovery-campaign">
      <div className="dashboard-panel__header">
        <div>
          <h2>Campanha para preencher horários</h2>
          <p className="muted">
            A sugestão cruza horário livre, profissional, serviço e chance real
            de retorno. Nada é enviado sem sua revisão.
          </p>
        </div>
        <span
          className={
            snapshot.available ? "badge badge--pending" : "badge badge--soft"
          }
        >
          {snapshot.available ? "Sugestão pronta" : "Sem oportunidade agora"}
        </span>
      </div>

      <div className="simple-list" style={{ padding: "14px 18px 16px" }}>
        <article className="simple-row">
          <h3>{snapshot.headline}</h3>
          <p className="muted">{snapshot.summary}</p>
          {snapshot.available ? (
            <div
              className="inline-actions"
              style={{ marginTop: 8, flexWrap: "wrap" }}
            >
              {snapshot.windowLabel ? (
                <span className="badge badge--soft">
                  Horário livre: {snapshot.windowLabel}
                </span>
              ) : null}
              {snapshot.staffName ? (
                <span className="badge badge--soft">
                  Profissional: {snapshot.staffName}
                </span>
              ) : null}
              {snapshot.serviceName ? (
                <span className="badge badge--pending">
                  Serviço: {snapshot.serviceName}
                </span>
              ) : null}
              <span className="badge badge--confirmed">
                Clientes sugeridos: {snapshot.candidateCount}
              </span>
              {snapshot.topChanceLabel ? (
                <span className="badge badge--soft">
                  Maior chance: {snapshot.topChanceLabel}
                </span>
              ) : null}
            </div>
          ) : null}
          <div className="simple-row__actions" style={{ flexWrap: "wrap" }}>
            <button
              type="button"
              className="primary-button"
              onClick={() => void handleGenerate()}
              disabled={!aiEnabled || !snapshot.available || isLoading}
            >
              {isLoading ? "Montando sugestão..." : "Criar sugestão"}
            </button>
            <Link
              href="/dashboard/benefits/promotions?compose=1"
              className="secondary-button"
            >
              Abrir promoções
            </Link>
            <Link href="/dashboard/gestao/clientes" className="secondary-button">
              Ver clientes
            </Link>
          </div>
          {!aiEnabled ? (
            <p className="muted" style={{ margin: 0 }}>
              Esse recurso não está disponível nesta conta no momento.
            </p>
          ) : null}
        </article>

        {status ? (
          <p
            className="muted"
            role="status"
            style={{
              color: status.tone === "error" ? "#9f3a38" : "#2b6f4a",
              margin: 0,
            }}
          >
            {status.message}
          </p>
        ) : null}

        {recovery?.available && recovery.draft ? (
          <>
            <article className="simple-row">
              <div
                className="inline-actions"
                style={{ marginBottom: 8, flexWrap: "wrap" }}
              >
                <span className="badge badge--accent">
                  {recovery.draft.campaignName}
                </span>
                <span className="badge badge--soft">
                  {recovery.draft.discountLabel}
                </span>
              </div>
              <h3>Mensagem pronta para revisar</h3>
              <p className="muted" style={{ marginBottom: 10 }}>
                WhatsApp
              </p>
              <p style={{ marginTop: 0 }}>{recovery.draft.whatsappText}</p>
              <p className="muted" style={{ marginBottom: 10 }}>
                Legenda Instagram
              </p>
              <p style={{ marginTop: 0 }}>{recovery.draft.instagramCaption}</p>
              <ul style={{ margin: "8px 0 0", paddingLeft: 18 }}>
                {recovery.draft.strategyBullets.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <small className="list-meta">
                A sugestão não é enviada sozinha. Revise o texto, confirme o
                desconto e escolha quando publicar ou disparar.
              </small>
            </article>

            <article className="simple-row">
              <h3>Clientes com mais chance de voltar</h3>
              <div className="simple-list" style={{ padding: 0 }}>
                {recovery.candidates.slice(0, 5).map((candidate) => (
                  <div key={candidate.customerId} className="simple-row">
                    <div
                      className="inline-actions"
                      style={{ marginBottom: 6, flexWrap: "wrap" }}
                    >
                      <span className="badge badge--confirmed">
                        {candidate.chanceLabel} • {candidate.score}%
                      </span>
                      <span className="badge badge--soft">
                        {candidate.daysSinceLastVisitLabel}
                      </span>
                      <span className="badge badge--soft">
                        Ticket {candidate.avgTicketLabel}
                      </span>
                    </div>
                    <strong>{candidate.name}</strong>
                    <p className="muted" style={{ margin: "4px 0 0" }}>
                      {candidate.reasonLabel}
                    </p>
                  </div>
                ))}
              </div>
              <div className="simple-row__actions" style={{ flexWrap: "wrap" }}>
                {recovery.ctaHref && recovery.ctaLabel ? (
                  <a href={recovery.ctaHref} className="primary-button">
                    {recovery.ctaLabel}
                  </a>
                ) : null}
                <Link href="/dashboard/ai" className="secondary-button">
                  Abrir assistente
                </Link>
              </div>
            </article>
          </>
        ) : null}
      </div>
    </article>
  );
}
