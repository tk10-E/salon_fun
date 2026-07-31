"use client";

import { useState } from "react";

import {
  CLIENT_APP_CAMPAIGN_AUDIENCE_OPTIONS,
  CLIENT_APP_CAMPAIGN_PRIORITY_OPTIONS,
  CLIENT_APP_CAMPAIGN_TARGET_OPTIONS,
} from "@/lib/clientAppConfig";

export type SettingsClientAppCampaignDraft = {
  slot: number;
  id: string;
  isActive: boolean;
  priority: string;
  startsAt: string;
  endsAt: string;
  audience: string;
  eyebrow: string;
  title: string;
  message: string;
  campaignLabel: string;
  ctaLabel: string;
  ctaTarget: string;
};

type SettingsCampaignsFieldProps = {
  initialCampaigns: SettingsClientAppCampaignDraft[];
};

type CampaignItem = SettingsClientAppCampaignDraft & {
  formSlot: number;
};

function createEmptyCampaign(formSlot: number): CampaignItem {
  return {
    formSlot,
    slot: formSlot,
    id: "",
    isActive: false,
    priority: "medium",
    startsAt: "",
    endsAt: "",
    audience: "all",
    eyebrow: "",
    title: "",
    message: "",
    campaignLabel: "",
    ctaLabel: "",
    ctaTarget: "explore",
  };
}

function normalizeShortText(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : null;
}

function truncateText(value: string, maxLength = 120) {
  return value.length > maxLength
    ? `${value.slice(0, maxLength - 1).trimEnd()}…`
    : value;
}

function getOptionLabel(
  options: readonly { value: string; label: string }[],
  value: string,
  fallback: string,
) {
  return options.find((option) => option.value === value)?.label ?? fallback;
}

function formatCampaignMoment(value: string) {
  const normalized = normalizeShortText(value);
  if (!normalized) {
    return null;
  }

  const [datePart, timePart] = normalized.split("T");
  const [year, month, day] = datePart.split("-");

  if (!year || !month || !day) {
    return null;
  }

  const formattedDate = `${day}/${month}/${year.slice(-2)}`;
  const formattedTime = timePart?.slice(0, 5);

  return formattedTime ? `${formattedDate} • ${formattedTime}` : formattedDate;
}

function getCampaignWindowLabel(campaign: CampaignItem) {
  const startsAt = formatCampaignMoment(campaign.startsAt);
  const endsAt = formatCampaignMoment(campaign.endsAt);

  if (startsAt && endsAt) {
    return `${startsAt} até ${endsAt}`;
  }

  if (startsAt) {
    return `Comeca ${startsAt}`;
  }

  if (endsAt) {
    return `Vai até ${endsAt}`;
  }

  return "Sem vigência definida";
}

function buildInitialCampaigns(
  initialCampaigns: SettingsClientAppCampaignDraft[],
) {
  if (initialCampaigns.length === 0) {
    return [createEmptyCampaign(1)];
  }

  return initialCampaigns.map((campaign, index) => ({
    ...campaign,
    formSlot: index + 1,
  }));
}

function CampaignCard({
  campaign,
  displayIndex,
  canRemove,
  onRemove,
  onPatch,
}: {
  campaign: CampaignItem;
  displayIndex: number;
  canRemove: boolean;
  onRemove: () => void;
  onPatch: (patch: Partial<CampaignItem>) => void;
}) {
  const isPublished = campaign.isActive;
  const campaignTitle =
    normalizeShortText(campaign.title) ?? `Campanha ${displayIndex}`;
  const campaignEyebrow =
    normalizeShortText(campaign.eyebrow) ??
    normalizeShortText(campaign.campaignLabel) ??
    `Campanha ${displayIndex}`;
  const campaignSummary = truncateText(
    normalizeShortText(campaign.message) ??
      "Mensagem destacada da home do app do cliente com CTA direto e janela de exibição controlada.",
  );
  const priorityLabel = getOptionLabel(
    CLIENT_APP_CAMPAIGN_PRIORITY_OPTIONS,
    campaign.priority,
    "Prioridade média",
  );
  const audienceLabel = getOptionLabel(
    CLIENT_APP_CAMPAIGN_AUDIENCE_OPTIONS,
    campaign.audience,
    "Toda a base",
  );
  const ctaTargetLabel = getOptionLabel(
    CLIENT_APP_CAMPAIGN_TARGET_OPTIONS,
    campaign.ctaTarget,
    "Reservar",
  );
  const ctaLabel = normalizeShortText(campaign.ctaLabel) ?? "CTA pendente";

  return (
    <article className="settings-campaign-card">
      <div className="settings-campaign-card__header">
        <div className="settings-campaign-card__heading">
          <span className="settings-campaign-card__eyebrow">
            {campaignEyebrow}
          </span>
          <strong>{campaignTitle}</strong>
        </div>

        <div className="settings-campaign-card__header-actions">
          <span
            className={`settings-campaign-card__status ${
              isPublished
                ? "settings-campaign-card__status--active"
                : "settings-campaign-card__status--draft"
            }`}
          >
            {isPublished ? "Publicada" : "Rascunho"}
          </span>

          {canRemove ? (
            <button
              type="button"
              className="settings-campaign-card__remove"
              onClick={onRemove}
            >
              Remover
            </button>
          ) : null}
        </div>
      </div>

      <p className="settings-campaign-card__summary">{campaignSummary}</p>

      <div
        className="settings-campaign-card__facts"
        aria-label={`Resumo da campanha ${displayIndex}`}
      >
        <span className="settings-campaign-card__fact">{priorityLabel}</span>
        <span className="settings-campaign-card__fact">{audienceLabel}</span>
        <span className="settings-campaign-card__fact">
          {ctaLabel} • {ctaTargetLabel}
        </span>
        <span className="settings-campaign-card__fact">
          {getCampaignWindowLabel(campaign)}
        </span>
      </div>

      <div className="settings-campaign-card__toggle-row">
        <label className="checkbox-field settings-campaign-card__toggle">
          <input
            type="checkbox"
            name={`clientAppCampaignIsActive_${campaign.formSlot}`}
            defaultChecked={campaign.isActive}
            onChange={(event) => onPatch({ isActive: event.target.checked })}
          />
          Publicar na central do app
        </label>
      </div>

      <div className="settings-campaign-card__group">
        <span className="settings-campaign-card__group-label">
          Distribuicao
        </span>
        <div className="split-grid settings-campaign-card__grid">
          <label className="field">
            <span>Prioridade</span>
            <select
              name={`clientAppCampaignPriority_${campaign.formSlot}`}
              defaultValue={campaign.priority}
              onChange={(event) => onPatch({ priority: event.target.value })}
            >
              {CLIENT_APP_CAMPAIGN_PRIORITY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Audiência</span>
            <select
              name={`clientAppCampaignAudience_${campaign.formSlot}`}
              defaultValue={campaign.audience}
              onChange={(event) => onPatch({ audience: event.target.value })}
            >
              {CLIENT_APP_CAMPAIGN_AUDIENCE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="settings-campaign-card__group">
        <span className="settings-campaign-card__group-label">Conteudo</span>
        <div className="split-grid settings-campaign-card__grid">
          <label className="field">
            <span>Selo curto</span>
            <input
              name={`clientAppCampaignEyebrow_${campaign.formSlot}`}
              defaultValue={campaign.eyebrow}
              placeholder="Ex.: Agora no app"
              onChange={(event) => onPatch({ eyebrow: event.target.value })}
            />
          </label>

          <label className="field">
            <span>Rótulo interno</span>
            <input
              name={`clientAppCampaignLabel_${campaign.formSlot}`}
              defaultValue={campaign.campaignLabel}
              placeholder="Ex.: Retorno da semana"
              onChange={(event) =>
                onPatch({ campaignLabel: event.target.value })
              }
            />
          </label>
        </div>

        <label className="field">
          <span>Título</span>
          <input
            name={`clientAppCampaignTitle_${campaign.formSlot}`}
            defaultValue={campaign.title}
            placeholder="Ex.: Volte essa semana"
            onChange={(event) => onPatch({ title: event.target.value })}
          />
        </label>

        <label className="field">
          <span>Mensagem</span>
          <textarea
            name={`clientAppCampaignMessage_${campaign.formSlot}`}
            defaultValue={campaign.message}
            rows={3}
            placeholder="Explique o motivo da campanha e o próximo passo."
            onChange={(event) => onPatch({ message: event.target.value })}
          />
        </label>
      </div>

      <div className="settings-campaign-card__group">
        <span className="settings-campaign-card__group-label">
          Ação e vigência
        </span>
        <div className="split-grid settings-campaign-card__grid">
          <label className="field">
            <span>CTA</span>
            <input
              name={`clientAppCampaignCtaLabel_${campaign.formSlot}`}
              defaultValue={campaign.ctaLabel}
              placeholder="Ex.: Reservar agora"
              onChange={(event) => onPatch({ ctaLabel: event.target.value })}
            />
          </label>

          <label className="field">
            <span>Destino do CTA</span>
            <select
              name={`clientAppCampaignCtaTarget_${campaign.formSlot}`}
              defaultValue={campaign.ctaTarget}
              onChange={(event) => onPatch({ ctaTarget: event.target.value })}
            >
              {CLIENT_APP_CAMPAIGN_TARGET_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="split-grid settings-campaign-card__grid">
          <label className="field">
            <span>Começa em</span>
            <input
              type="datetime-local"
              name={`clientAppCampaignStartsAt_${campaign.formSlot}`}
              defaultValue={campaign.startsAt}
              onChange={(event) => onPatch({ startsAt: event.target.value })}
            />
          </label>

          <label className="field">
            <span>Termina em</span>
            <input
              type="datetime-local"
              name={`clientAppCampaignEndsAt_${campaign.formSlot}`}
              defaultValue={campaign.endsAt}
              onChange={(event) => onPatch({ endsAt: event.target.value })}
            />
          </label>
        </div>
      </div>

      <input
        type="hidden"
        name={`clientAppCampaignId_${campaign.formSlot}`}
        defaultValue={campaign.id}
      />
    </article>
  );
}

export function SettingsCampaignsField({
  initialCampaigns,
}: SettingsCampaignsFieldProps) {
  const [campaigns, setCampaigns] = useState<CampaignItem[]>(() =>
    buildInitialCampaigns(initialCampaigns),
  );
  const [nextFormSlot, setNextFormSlot] = useState(
    initialCampaigns.length > 0 ? initialCampaigns.length + 1 : 2,
  );

  function handleAddCampaign() {
    setCampaigns((current) => [...current, createEmptyCampaign(nextFormSlot)]);
    setNextFormSlot((current) => current + 1);
  }

  function handleRemoveCampaign(formSlot: number) {
    setCampaigns((current) =>
      current.filter((campaign) => campaign.formSlot !== formSlot),
    );
  }

  function handlePatchCampaign(
    formSlot: number,
    patch: Partial<CampaignItem>,
  ) {
    setCampaigns((current) =>
      current.map((campaign) =>
        campaign.formSlot === formSlot
          ? { ...campaign, ...patch }
          : campaign,
      ),
    );
  }

  return (
    <div className="settings-campaigns-field">
      <div className="settings-campaigns-field__toolbar">
        <div className="settings-campaigns-field__copy">
          <strong>Campanha principal + extras sob demanda</strong>
          <p>
            Comece com uma campanha e adicione novas apenas quando fizer
            sentido para a operação.
          </p>
        </div>

        <button
          type="button"
          className="secondary-button settings-campaigns-field__add"
          onClick={handleAddCampaign}
        >
          Adicionar campanha
        </button>
      </div>

      <div className="settings-campaign-grid">
        {campaigns.map((campaign, index) => (
          <CampaignCard
            key={campaign.formSlot}
            campaign={campaign}
            displayIndex={index + 1}
            canRemove={campaigns.length > 1}
            onRemove={() => handleRemoveCampaign(campaign.formSlot)}
            onPatch={(patch) => handlePatchCampaign(campaign.formSlot, patch)}
          />
        ))}
      </div>
    </div>
  );
}
