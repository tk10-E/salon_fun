import type { CSSProperties } from "react";
import Image from "next/image";
import Link from "next/link";

import {
  approveCustomerMembershipRequestAction,
  markCustomerMembershipRequestPaidAction,
  updateCustomerProductOrderStatusAction,
} from "@/app/actions";
import {
  deleteSalonBirthdayCampaignAction,
  updateSalonBirthdayCampaignAction,
} from "@/app/_actions/dashboard-birthdays";
import { updateManagementAppointmentStatusAction } from "@/app/_actions/management";
import {
  AsyncActionForm,
  AsyncActionNoticeRegion,
} from "@/components/AsyncActionForm";
import { EmptyStateCard } from "@/components/EmptyStateCard";
import { MANAGEMENT_ROUTES } from "@/lib/management-navigation";

import type { DashboardHomeData } from "./_lib";

type DashboardHomeContentProps = {
  data: DashboardHomeData;
};

const DASHBOARD_HOME_ROUTES = {
  birthdays: "/dashboard/birthdays",
  clientAppRequests: "/dashboard#dashboard-client-requests",
  finance: "/dashboard/finance",
  promotions: "/dashboard/benefits/promotions",
} as const;

function formatCountLabel(
  count: number,
  singular: string,
  plural = `${singular}s`,
) {
  return `${count} ${count === 1 ? singular : plural}`;
}

type DashboardFigureKind =
  | "spark"
  | "rocket"
  | "heart"
  | "warning"
  | "money"
  | "bars"
  | "megaphone"
  | "target"
  | "wallet";

type DashboardFigureTone = "sky" | "warm" | "gold" | "success" | "soft" | "ink";

function DashboardFigureSvg({ kind }: { kind: DashboardFigureKind }) {
  switch (kind) {
    case "spark":
      return (
        <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
          <rect
            x="4"
            y="5"
            width="16"
            height="14"
            rx="3"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
          />
          <path
            d="M8 15l3-3 2.5 2.5L18 10"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M15 10h3v3"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "rocket":
      return (
        <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
          <g transform="rotate(-42 12 12)">
            <path
              d="M12 3.15c2.82 0 5.1 2.28 5.1 5.1v6.82H6.9V8.25c0-2.82 2.28-5.1 5.1-5.1Z"
              fill="#5f88ff"
            />
            <path
              d="M9.18 4.25c.88-.73 1.82-1.1 2.82-1.1s1.94.37 2.82 1.1l-.6 1.23H9.78l-.6-1.23Z"
              fill="#ff5f6b"
            />
            <path
              d="M6.9 9.05 5.05 10.7V8.28c0-.7.57-1.28 1.28-1.28h.57v2.05Z"
              fill="#ff8c2f"
            />
            <path
              d="M17.1 9.05 18.95 10.7V8.28c0-.7-.57-1.28-1.28-1.28h-.57v2.05Z"
              fill="#ff8c2f"
            />
            <path
              d="m10.12 15.07-1.38 3.3L12 17.16l3.26 1.21-1.38-3.3Z"
              fill="#ff5563"
            />
            <path
              d="M11.2 15.07h1.6c.11 1.04.9 1.9 2.18 2.78.58.4.42 1.29-.28 1.54-1.07.39-2.19-.08-2.8-1.12l-.09-.16-.09.16c-.61 1.04-1.73 1.51-2.8 1.12-.7-.25-.86-1.14-.28-1.54 1.28-.88 2.07-1.74 2.18-2.78Z"
              fill="#ffd44c"
            />
            <path
              d="M11.58 16.12c-.21.76-.78 1.42-1.72 2.08.76-.08 1.49.31 1.9.99l.24.39.24-.39c.41-.68 1.14-1.07 1.9-.99-.94-.66-1.51-1.32-1.72-2.08h-.84Z"
              fill="#ff962f"
            />
            <circle
              cx="12"
              cy="8.38"
              r="2.02"
              fill="#f8fbff"
              stroke="#3d63d7"
              strokeWidth="0.9"
            />
            <circle cx="12" cy="8.38" r="1.02" fill="#82dbff" />
            <path
              d="M12 3.15c2.82 0 5.1 2.28 5.1 5.1v6.82H6.9V8.25c0-2.82 2.28-5.1 5.1-5.1Z"
              fill="none"
              stroke="#2e4b90"
              strokeWidth="0.9"
              strokeLinejoin="round"
            />
            <path
              d="m10.12 15.07-1.38 3.3L12 17.16l3.26 1.21-1.38-3.3Z"
              fill="none"
              stroke="#b93a49"
              strokeWidth="0.8"
              strokeLinejoin="round"
            />
          </g>
        </svg>
      );
    case "heart":
      return (
        <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
          <path
            d="M12 19.2 5.8 13a4 4 0 0 1 5.6-5.7L12 8l.6-.7a4 4 0 0 1 5.6 5.7L12 19.2Z"
            fill="currentColor"
          />
        </svg>
      );
    case "warning":
      return (
        <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
          <path
            d="M12 4.8 20 18.5a1 1 0 0 1-.87 1.5H4.87A1 1 0 0 1 4 18.5L12 4.8Z"
            fill="currentColor"
          />
          <path
            d="M12 9v4.8"
            fill="none"
            stroke="#fffdf5"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <circle cx="12" cy="16.6" r="1.1" fill="#fffdf5" />
        </svg>
      );
    case "money":
      return (
        <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
          <path
            d="M9.18 4.2h5.64c.43 0 .74.42.57.82l-.72 1.7c-.11.27-.05.59.16.81l1.08 1.11c1.56 1.17 2.46 2.94 2.46 4.94 0 3.79-2.92 6.46-6.71 6.46s-6.71-2.67-6.71-6.46c0-2 .9-3.77 2.46-4.94l1.08-1.11c.21-.22.27-.54.16-.81l-.72-1.7c-.17-.4.14-.82.57-.82Z"
            fill="#f4c86b"
          />
          <path d="M9.72 4.2h4.56l-.58 1.58h-3.4L9.72 4.2Z" fill="#70441b" />
          <path d="M9.2 7.28h5.6l.92.9H8.28l.92-.9Z" fill="#986026" />
          <path
            d="M12 8.56c-3.25 0-5.7 2.16-5.7 5 0 3.22 2.41 5.64 5.7 5.64s5.7-2.42 5.7-5.64c0-2.84-2.45-5-5.7-5Z"
            fill="#f7d27e"
          />
          <path
            d="M8.4 11.06c1.02-1.35 2.72-2.14 4.91-2.14 1.05 0 2.03.18 2.84.52-.91-.64-2.28-.99-4.01-.99-2.46 0-4.21.98-5.12 2.61Z"
            fill="#ffebb0"
            opacity="0.95"
          />
          <path
            d="M12.08 10.5v5.58M10.32 11.72h2.18a1.05 1.05 0 1 1 0 2.1h-1.46a1.05 1.05 0 1 0 0 2.1h2.48"
            fill="none"
            stroke="#299949"
            strokeWidth="1.3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M9.18 4.2h5.64c.43 0 .74.42.57.82l-.72 1.7c-.11.27-.05.59.16.81l1.08 1.11c1.56 1.17 2.46 2.94 2.46 4.94 0 3.79-2.92 6.46-6.71 6.46s-6.71-2.67-6.71-6.46c0-2 .9-3.77 2.46-4.94l1.08-1.11c.21-.22.27-.54.16-.81l-.72-1.7c-.17-.4.14-.82.57-.82Z"
            fill="none"
            stroke="#8a5822"
            strokeWidth="0.88"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "bars":
      return (
        <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
          <rect
            x="5"
            y="12"
            width="3"
            height="7"
            rx="1.2"
            fill="currentColor"
          />
          <rect
            x="10.5"
            y="9"
            width="3"
            height="10"
            rx="1.2"
            fill="currentColor"
          />
          <rect
            x="16"
            y="6"
            width="3"
            height="13"
            rx="1.2"
            fill="currentColor"
          />
          <path
            d="M5 8.5h4.2L12 6l2.5 1.8L19 4.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "megaphone":
      return (
        <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
          <path d="M5 10h3l8-4v12l-8-4H5z" fill="currentColor" />
          <path
            d="M8 14v3.5a1.5 1.5 0 0 0 3 0V15"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "target":
      return (
        <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
          <circle
            cx="12"
            cy="12"
            r="7.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
          />
          <circle
            cx="12"
            cy="12"
            r="3.8"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
          />
          <circle cx="12" cy="12" r="1.4" fill="currentColor" />
          <path
            d="M14.6 9.4 19 5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <path
            d="M16.1 5H19v2.9"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "wallet":
      return (
        <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
          <path
            d="M5 8.5A2.5 2.5 0 0 1 7.5 6H17a2 2 0 0 1 2 2v1.2H8.6A2.6 2.6 0 0 0 6 11.8v4.4A2.8 2.8 0 0 0 8.8 19H17a2 2 0 0 0 2-2V9.2"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M18.4 11h-3.1a1.8 1.8 0 1 0 0 3.6h3.1z"
            fill="currentColor"
          />
          <circle cx="15.4" cy="12.8" r="0.9" fill="#fffdf5" />
        </svg>
      );
  }
}

function DashboardFigureBadge({
  kind,
  tone = "soft",
  size = "md",
  className,
}: {
  kind: DashboardFigureKind;
  tone?: DashboardFigureTone;
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <span
      className={`dashboard-figure dashboard-figure--${tone} dashboard-figure--${size}${className ? ` ${className}` : ""}`}
      aria-hidden="true"
    >
      <DashboardFigureSvg kind={kind} />
    </span>
  );
}

export function DashboardHomeContent({
  data,
}: DashboardHomeContentProps) {
  return (
    <>
      <DashboardActionDeck
        agenda={data.agenda}
        attentionItems={data.attentionItems}
        customerGrowth={data.customerGrowth}
        pendingClientAppRequests={data.clientAppRequests.pendingCount}
      />
      <DashboardHero salonName={data.salonName} />
      <DashboardHeadlineAlert
        customerGrowth={data.customerGrowth}
        finance={data.finance}
        agenda={data.agenda}
        attentionItems={data.attentionItems}
        pendingClientAppRequests={data.clientAppRequests.pendingCount}
      />
      <DashboardHealthSummary
        customerGrowth={data.customerGrowth}
        finance={data.finance}
        agenda={data.agenda}
        pendingClientAppRequests={data.clientAppRequests.pendingCount}
        attentionItems={data.attentionItems}
      />

      <section className="dashboard-operations-grid">
        <DashboardFinancePanel finance={data.finance} />
        <DashboardAgendaPanel agenda={data.agenda} />
      </section>

      <section className="dashboard-followup-grid">
        <DashboardClientAppRequestsPanel
          clientAppRequests={data.clientAppRequests}
        />
        <DashboardAttentionPanel attentionItems={data.attentionItems} />
      </section>
    </>
  );
}

export function DashboardBirthdaysPageContent({
  birthdays,
  initialMessage,
  initialTone,
}: {
  birthdays: DashboardHomeData["birthdays"];
  initialMessage?: string;
  initialTone?: string;
}) {
  const hasConfiguredMessage = Boolean(birthdays.campaign.message);

  return (
    <AsyncActionNoticeRegion
      initialMessage={initialMessage}
      initialTone={initialTone}
    >
      <section className="card content-card">
        <p className="eyebrow">Comunicação do app</p>
        <h1 style={{ marginBottom: 10 }}>Aniversários do salão</h1>
        <p className="muted" style={{ marginBottom: 16 }}>
          Monte a homenagem do aplicativo em uma área separada, com edição,
          exclusão e leitura do que entra no ar quando chegar o aniversário.
        </p>
        <div className="inline-actions" style={{ flexWrap: "wrap" }}>
          <span
            className={
              birthdays.campaign.isActive
                ? "badge badge--confirmed"
                : hasConfiguredMessage
                  ? "badge badge--soft"
                  : "badge badge--pending"
            }
          >
            {birthdays.campaign.isActive
              ? "Mensagem pronta para o app"
              : hasConfiguredMessage
                ? "Mensagem salva e pausada"
                : "Mensagem ainda não configurada"}
          </span>
          <span className="badge badge--soft">{birthdays.todayLabel}</span>
          <Link href="/dashboard" className="secondary-button">
            Voltar para a home
          </Link>
        </div>
      </section>

      <section className="dashboard-birthday-grid">
        <DashboardBirthdayCampaignComposerPanel birthdays={birthdays} />
        <DashboardBirthdayCustomersPanel birthdays={birthdays} />
      </section>
    </AsyncActionNoticeRegion>
  );
}

export function DashboardBirthdayHomeSummaryPanel({
  birthdays,
}: {
  birthdays: DashboardHomeData["birthdays"];
}) {
  const hasConfiguredMessage = Boolean(birthdays.campaign.message);
  const hasMedia = Boolean(birthdays.campaign.mediaUrl);

  return (
    <section
      className="card content-card dashboard-panel dashboard-panel--birthday-campaign"
      aria-labelledby="dashboard-birthday-campaign"
    >
      <div className="section-heading">
        <div>
          <h2 id="dashboard-birthday-campaign">
            Mensagem de aniversário no app
          </h2>
          <p className="muted">
            A cliente só vê essa área na home quando for aniversário dela e esta
            mensagem estiver salva.
          </p>
        </div>
        <span
          className={
            birthdays.campaign.isActive
              ? "badge badge--confirmed"
              : hasConfiguredMessage
                ? "badge badge--soft"
                : "badge badge--pending"
          }
        >
          {birthdays.campaign.isActive
            ? "No ar no aniversário"
            : hasConfiguredMessage
              ? "Salva e pausada"
              : "Não configurada"}
        </span>
      </div>

      {hasConfiguredMessage ? (
        <div
          style={{
            display: "grid",
            gap: 16,
            gridTemplateColumns: hasMedia ? "minmax(220px, 280px) 1fr" : "1fr",
            marginBottom: 20,
          }}
        >
          {birthdays.campaign.mediaUrl ? (
            birthdays.campaign.mediaKind === "video" ? (
              <video
                src={birthdays.campaign.mediaUrl}
                controls
                muted
                playsInline
                preload="metadata"
                style={{
                  width: "100%",
                  borderRadius: 22,
                  border: "1px solid var(--border, rgba(15, 23, 42, 0.08))",
                  background: "rgba(15, 23, 42, 0.04)",
                  minHeight: 220,
                  objectFit: "cover",
                }}
              />
            ) : (
              <Image
                src={birthdays.campaign.mediaUrl}
                alt="Mídia atual da campanha de aniversário"
                width={1120}
                height={880}
                unoptimized
                style={{
                  width: "100%",
                  height: "auto",
                  borderRadius: 22,
                  border: "1px solid var(--border, rgba(15, 23, 42, 0.08))",
                  display: "block",
                  minHeight: 220,
                  objectFit: "cover",
                }}
              />
            )
          ) : null}
          <article className="simple-row" style={{ margin: 0 }}>
            <div
              className="inline-actions"
              style={{ marginBottom: 10, flexWrap: "wrap" }}
            >
              <span className="badge badge--soft">
                {birthdays.campaign.mediaKind === "video"
                  ? "Vídeo publicado"
                  : birthdays.campaign.mediaKind === "image"
                    ? "Foto publicada"
                    : "Sem mídia"}
              </span>
              <span className="badge badge--soft">
                {birthdays.todayCount
                  ? `${birthdays.todayCount} aniversariante${birthdays.todayCount === 1 ? "" : "s"} hoje`
                  : "Aguardando próximo aniversário"}
              </span>
            </div>
            <h3>{birthdays.campaign.title ?? "Feliz aniversário!"}</h3>
            <p className="muted">{birthdays.campaign.message}</p>
            <small className="list-meta">
              Se a campanha estiver pausada, a cliente não vê nada na home mesmo
              tendo aniversário.
            </small>
          </article>
        </div>
      ) : (
        <EmptyStateCard
          eyebrow="Sem mensagem"
          title="Monte a homenagem do aniversário"
          description="Salve um texto com foto ou vídeo e o app só mostra para a cliente no dia do aniversário."
        />
      )}

      <div className="simple-row__actions">
        <Link href={DASHBOARD_HOME_ROUTES.birthdays} className="primary-button">
          {hasConfiguredMessage ? "Abrir aniversários" : "Montar homenagem"}
        </Link>
        <Link href={MANAGEMENT_ROUTES.clients} className="secondary-button">
          Conferir clientes
        </Link>
      </div>
    </section>
  );
}

export function DashboardBirthdayCampaignComposerPanel({
  birthdays,
}: {
  birthdays: DashboardHomeData["birthdays"];
}) {
  const hasConfiguredMessage = Boolean(birthdays.campaign.message);
  const hasMedia = Boolean(birthdays.campaign.mediaUrl);

  return (
    <section
      className="card content-card dashboard-panel dashboard-panel--birthday-campaign"
      aria-labelledby="dashboard-birthday-campaign"
    >
      <div className="section-heading">
        <div>
          <h2 id="dashboard-birthday-campaign">
            Mensagem de aniversário no app
          </h2>
          <p className="muted">
            A cliente só vê essa área na home quando for aniversário dela e a
            homenagem estiver salva e ativa.
          </p>
        </div>
        <span
          className={
            birthdays.campaign.isActive
              ? "badge badge--confirmed"
              : hasConfiguredMessage
                ? "badge badge--soft"
                : "badge badge--pending"
          }
        >
          {birthdays.campaign.isActive
            ? "No ar no aniversário"
            : hasConfiguredMessage
              ? "Salva e pausada"
              : "Não configurada"}
        </span>
      </div>

      {hasConfiguredMessage ? (
        <div
          style={{
            display: "grid",
            gap: 16,
            gridTemplateColumns: hasMedia ? "minmax(220px, 280px) 1fr" : "1fr",
            marginBottom: 20,
          }}
        >
          {birthdays.campaign.mediaUrl ? (
            birthdays.campaign.mediaKind === "video" ? (
              <video
                src={birthdays.campaign.mediaUrl}
                controls
                muted
                playsInline
                preload="metadata"
                style={{
                  width: "100%",
                  borderRadius: 22,
                  border: "1px solid var(--border, rgba(15, 23, 42, 0.08))",
                  background: "rgba(15, 23, 42, 0.04)",
                  minHeight: 220,
                  objectFit: "cover",
                }}
              />
            ) : (
              <Image
                src={birthdays.campaign.mediaUrl}
                alt="Mídia atual da campanha de aniversário"
                width={1120}
                height={880}
                unoptimized
                style={{
                  width: "100%",
                  height: "auto",
                  borderRadius: 22,
                  border: "1px solid var(--border, rgba(15, 23, 42, 0.08))",
                  display: "block",
                  minHeight: 220,
                  objectFit: "cover",
                }}
              />
            )
          ) : null}
          <article className="simple-row" style={{ margin: 0 }}>
            <div
              className="inline-actions"
              style={{ marginBottom: 10, flexWrap: "wrap" }}
            >
              <span className="badge badge--soft">
                {birthdays.campaign.mediaKind === "video"
                  ? "Video publicado"
                  : birthdays.campaign.mediaKind === "image"
                    ? "Foto publicada"
                    : "Sem midia"}
              </span>
              <span className="badge badge--soft">
                {birthdays.todayCount
                  ? `${birthdays.todayCount} aniversariante${birthdays.todayCount === 1 ? "" : "s"} hoje`
                  : "Aguardando próximo aniversário"}
              </span>
            </div>
            <h3>{birthdays.campaign.title ?? "Feliz aniversário!"}</h3>
            <p className="muted">{birthdays.campaign.message}</p>
            <small className="list-meta">
              Quando der meia-noite no fuso do salão, o app esconde a mensagem
              automaticamente.
            </small>
          </article>
        </div>
      ) : (
        <EmptyStateCard
          eyebrow="Sem mensagem"
          title="Monte a homenagem do aniversário"
          description="Salve um texto com foto ou vídeo e o app só mostra para a cliente no dia do aniversário."
        />
      )}

      <AsyncActionForm action={updateSalonBirthdayCampaignAction}>
        <input
          type="hidden"
          name="returnPath"
          value={DASHBOARD_HOME_ROUTES.birthdays}
        />
        <div
          style={{
            display: "grid",
            gap: 14,
          }}
        >
          <label style={{ display: "grid", gap: 6 }}>
            <span>Título da homenagem</span>
            <input
              type="text"
              name="birthdayCampaignTitle"
              maxLength={80}
              defaultValue={birthdays.campaign.title ?? "Feliz aniversário!"}
              placeholder="Ex.: Seu dia merece um cuidado especial"
            />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span>Mensagem que aparece na home</span>
            <textarea
              name="birthdayCampaignMessage"
              rows={5}
              maxLength={800}
              defaultValue={birthdays.campaign.message ?? ""}
              placeholder="Escreva a mensagem que a cliente vai ler no dia do aniversário."
            />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span>Foto ou vídeo</span>
            <input
              type="file"
              name="birthdayCampaignMedia"
              accept="image/png,image/jpeg,image/webp,video/mp4,video/quicktime,video/webm"
            />
            <small className="list-meta">
              Aceita foto ou vídeo curto. O app esconde toda essa área quando
              não houver mensagem ativa para o aniversário.
            </small>
          </label>

          <div
            className="inline-actions"
            style={{
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <label
              style={{
                alignItems: "center",
                display: "inline-flex",
                gap: 8,
              }}
            >
              <input
                type="checkbox"
                name="birthdayCampaignIsActive"
                defaultChecked={birthdays.campaign.isActive}
              />
                  <span>Mostrar no app quando chegar o aniversário</span>
            </label>

            {birthdays.campaign.mediaUrl ? (
              <label
                style={{
                  alignItems: "center",
                  display: "inline-flex",
                  gap: 8,
                }}
              >
                <input type="checkbox" name="removeBirthdayCampaignMedia" />
                <span>Remover mídia atual</span>
              </label>
            ) : null}
          </div>

          <div className="simple-row__actions">
            <button type="submit" className="primary-button">
              Salvar mensagem de aniversário
            </button>
            <Link href={MANAGEMENT_ROUTES.clients} className="secondary-button">
              Conferir clientes
            </Link>
          </div>
        </div>
      </AsyncActionForm>

      {hasConfiguredMessage ? (
        <div
          className="simple-row"
          style={{
            marginTop: 18,
            paddingTop: 18,
            borderTop: "1px solid var(--border, rgba(15, 23, 42, 0.08))",
          }}
        >
          <div>
            <h3 style={{ marginBottom: 6 }}>Excluir homenagem atual</h3>
            <p className="muted">
              Remove a mensagem, desliga a exibição no app e apaga a mídia salva
              nessa campanha.
            </p>
          </div>
          <div className="simple-row__actions">
            <AsyncActionForm action={deleteSalonBirthdayCampaignAction}>
              <input
                type="hidden"
                name="returnPath"
                value={DASHBOARD_HOME_ROUTES.birthdays}
              />
              <button type="submit" className="danger-button">
                Excluir mensagem
              </button>
            </AsyncActionForm>
          </div>
        </div>
      ) : null}
    </section>
  );
}

export function DashboardBirthdayCustomersPanel({
  birthdays,
}: {
  birthdays: DashboardHomeData["birthdays"];
}) {
  return (
    <section
      className="card content-card dashboard-panel dashboard-panel--birthday-customers"
      aria-labelledby="dashboard-birthday-customers"
    >
      <div className="section-heading">
        <div>
          <h2 id="dashboard-birthday-customers">Aniversariantes do dia</h2>
          <p className="muted">
            O painel cruza a data de nascimento do cadastro com o fuso do salão.
          </p>
        </div>
        <span
          className={
            birthdays.todayCount
              ? "badge badge--confirmed"
              : "badge badge--soft"
          }
        >
          {birthdays.todayLabel}
        </span>
      </div>

      {birthdays.todayCount && !birthdays.campaign.isActive ? (
        <div
          className="badge badge--pending"
          style={{ marginBottom: 16, width: "fit-content" }}
        >
          Existe aniversariante hoje, mas a mensagem no app esta pausada.
        </div>
      ) : null}

      {birthdays.items.length ? (
        <div className="simple-list">
          {birthdays.items.map((customer) => (
            <article key={customer.id} className="simple-row">
              <div
                className="inline-actions"
                style={{ marginBottom: 8, flexWrap: "wrap" }}
              >
                <span className="badge badge--soft">
                  {customer.birthDateLabel}
                </span>
                {customer.turningAge != null ? (
                  <span className="badge badge--confirmed">
                    Faz {customer.turningAge} ano
                    {customer.turningAge === 1 ? "" : "s"}
                  </span>
                ) : null}
              </div>
              <h3>{customer.name}</h3>
              <p className="muted">
                {customer.phone?.trim()
                  ? `Telefone ${customer.phone}`
                  : "Sem telefone principal no cadastro."}
              </p>
              <div className="simple-row__actions">
                <Link
                  href={`${MANAGEMENT_ROUTES.clients}?clientId=${customer.id}`}
                  className="secondary-button"
                >
                  Abrir cliente
                </Link>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <EmptyStateCard
          eyebrow="Nada hoje"
          title="Nenhum aniversário no radar de hoje"
          description="Quando alguma cliente fizer aniversário hoje, ela aparece aqui e o app pode mostrar a homenagem salva."
        />
      )}
    </section>
  );
}

function DashboardQuickActions({
  customerGrowth,
  pendingClientAppRequests,
}: {
  customerGrowth: DashboardHomeData["customerGrowth"];
  pendingClientAppRequests: number;
}) {
  return (
    <section className="dashboard-quick-actions" aria-label="Atalhos do painel">
      <div className="dashboard-quick-actions__icons">
        <Link
          href={DASHBOARD_HOME_ROUTES.promotions}
          className="dashboard-quick-actions__icon dashboard-quick-actions__icon--insight"
          aria-label={`Promoções do salão: ${formatCountLabel(customerGrowth.newCustomersThisMonth, "nova cliente", "novas clientes")} no mês`}
        >
          <QuickShortcutGlyph kind="spark" />
          <small>{customerGrowth.newCustomersThisMonth}</small>
        </Link>

        <Link
          href={DASHBOARD_HOME_ROUTES.clientAppRequests}
          className="dashboard-quick-actions__icon dashboard-quick-actions__icon--rocket"
          aria-label={`Pendências do app: ${pendingClientAppRequests}`}
        >
          <QuickShortcutGlyph kind="rocket" />
          <small>{pendingClientAppRequests}</small>
        </Link>
      </div>

      <Link
        href={DASHBOARD_HOME_ROUTES.promotions}
        className="dashboard-quick-actions__cta"
      >
        <span className="dashboard-quick-actions__cta-badge" aria-hidden="true">
          <QuickShortcutGlyph kind="heart" />
        </span>
        <div className="dashboard-quick-actions__cta-copy">
          <strong>Crescer meu salão</strong>
          <span>
            {formatCountLabel(
              customerGrowth.newCustomersThisMonth,
              "nova cliente",
              "novas clientes",
            )}{" "}
            no mês e{" "}
            {formatCountLabel(
              pendingClientAppRequests,
              "pedido do app",
              "pedidos do app",
            )}{" "}
            aguardando resposta.
          </span>
        </div>
        <span className="dashboard-quick-actions__cta-arrow" aria-hidden="true">
          {">"}
        </span>
      </Link>
    </section>
  );
}

function DashboardActionDeck({
  agenda,
  attentionItems,
  customerGrowth,
  pendingClientAppRequests,
}: {
  agenda: DashboardHomeData["agenda"];
  attentionItems: DashboardHomeData["attentionItems"];
  customerGrowth: DashboardHomeData["customerGrowth"];
  pendingClientAppRequests: number;
}) {
  const agendaSummary =
    agenda.items.length > 0
      ? `${formatCountLabel(agenda.items.length, "horario", "horarios")} para acompanhar agora.`
      : "Sem horario confirmado. Vale abrir encaixes ou chamar clientes.";
  const clientsSummary =
    attentionItems.length > 0
      ? `${formatCountLabel(attentionItems.length, "ponto de atencao", "pontos de atencao")} para agir hoje.`
      : `${formatCountLabel(customerGrowth.activeCustomersLast30d, "cliente ativa", "clientes ativas")} nos ultimos 30 dias.`;
  const appSalesHref =
    pendingClientAppRequests > 0
      ? DASHBOARD_HOME_ROUTES.clientAppRequests
      : DASHBOARD_HOME_ROUTES.promotions;
  const appSalesLabel =
    pendingClientAppRequests > 0
      ? `Pend\u00EAncias do app: ${pendingClientAppRequests}`
      : "Abrir vendas do app";
  const appSalesSummary =
    pendingClientAppRequests > 0
      ? `${formatCountLabel(pendingClientAppRequests, "pedido do app", "pedidos do app")} aguardando resposta do salao.`
      : `${formatCountLabel(customerGrowth.newCustomersThisMonth, "nova cliente", "novas clientes")} chegaram neste mes.`;

  return (
    <section className="dashboard-action-deck" aria-label="Atalhos do painel">
      <Link
        href={MANAGEMENT_ROUTES.appointments}
        className="dashboard-action-card"
        aria-label="Abrir agenda do sal\u00E3o"
      >
        <DashboardFigureBadge kind="spark" tone="sky" />
        <div className="dashboard-action-card__copy">
          <strong>Agenda</strong>
          <span>{agendaSummary}</span>
        </div>
      </Link>

      <Link
        href={MANAGEMENT_ROUTES.clients}
        className="dashboard-action-card"
        aria-label="Abrir clientes do sal\u00E3o"
      >
        <DashboardFigureBadge kind="heart" tone="gold" />
        <div className="dashboard-action-card__copy">
          <strong>Clientes</strong>
          <span>{clientsSummary}</span>
        </div>
      </Link>

      <Link
        href={appSalesHref}
        className="dashboard-action-card dashboard-action-card--highlight"
        aria-label={appSalesLabel}
      >
        <DashboardFigureBadge kind="megaphone" tone="warm" />
        <div className="dashboard-action-card__copy">
          <strong>Vender no app</strong>
          <span>{appSalesSummary}</span>
        </div>
      </Link>
    </section>
  );
}

function QuickShortcutGlyph({ kind }: { kind: "spark" | "rocket" | "heart" }) {
  return (
    <span className="dashboard-quick-actions__glyph" aria-hidden="true">
      <DashboardFigureSvg kind={kind} />
    </span>
  );
}

function DashboardHero({ salonName }: Pick<DashboardHomeData, "salonName">) {
  return (
    <section className="dashboard-health-hero">
      <div className="dashboard-health-hero__copy">
        <span className="eyebrow">Operação do dia</span>
        <h1>Tudo do salão em uma tela</h1>
        <p>Agenda, vendas e clientes para agir rápido.</p>
      </div>
      <div className="dashboard-health-hero__meta">
        <span>Salão</span>
        <strong>{salonName}</strong>
        <small>Dados reais do próprio salão.</small>
      </div>
    </section>
  );
}

function DashboardHeadlineAlert({
  customerGrowth,
  finance,
  agenda,
  attentionItems,
  pendingClientAppRequests,
}: {
  customerGrowth: DashboardHomeData["customerGrowth"];
  finance: DashboardHomeData["finance"];
  agenda: DashboardHomeData["agenda"];
  attentionItems: DashboardHomeData["attentionItems"];
  pendingClientAppRequests: number;
}) {
  const deltaIsNegative = customerGrowth.monthlyDeltaLabel.startsWith("-");
  const tone =
    pendingClientAppRequests > 0
      ? "warm"
      : deltaIsNegative ||
          agenda.items.length === 0 ||
          attentionItems.length > 0
        ? "danger"
        : "success";
  const headline =
    pendingClientAppRequests > 0
      ? "Pedidos do app aguardando resposta"
      : deltaIsNegative || agenda.items.length === 0
        ? "Agenda pede atenção"
        : "Tudo em ordem hoje";
  const message =
    pendingClientAppRequests > 0
      ? `${formatCountLabel(pendingClientAppRequests, "pedido do app", "pedidos do app")} aguardam resposta do salão.`
      : deltaIsNegative
        ? `Seu movimento caiu ${customerGrowth.monthlyDeltaLabel.replace("-", "")} em relação ao mês anterior. Hoje estão previstos ${finance.todayRevenueLabel}.`
        : agenda.items.length === 0
          ? "Nenhum horário confirmado hoje. Vale reforçar a agenda."
          : `${formatCountLabel(agenda.items.length, "horário", "horários")} no dia e ${finance.todayRevenueLabel} previstos para hoje.`;

  return (
    <section
      className={`dashboard-health-alert dashboard-health-alert--${tone}`}
    >
      <div className="dashboard-health-alert__copy">
        <div className="dashboard-health-alert__title">
          <span>Resumo principal</span>
          <div className="dashboard-health-alert__headline-row">
            <DashboardFigureBadge
              kind={tone === "success" ? "spark" : "warning"}
              tone={tone === "success" ? "success" : "gold"}
              size="sm"
            />
            <strong>{headline}</strong>
            {tone === "danger" || tone === "warm" ? (
              <DashboardFigureBadge kind="warning" tone="gold" size="sm" />
            ) : null}
          </div>
        </div>
        <p>{message}</p>
      </div>
      <div className="dashboard-health-alert__actions">
        <Link
          href={MANAGEMENT_ROUTES.appointments}
          className="dashboard-health-alert__cta"
          aria-label="Abrir agenda do salão"
        >
          <span className="dashboard-health-alert__cta-copy">
            <span>Organizar agenda</span>
            <strong>Ver agenda</strong>
          </span>
          <span className="dashboard-health-alert__cta-icon" aria-hidden="true">
            <DashboardFigureSvg kind="spark" />
          </span>
        </Link>
        <Link
          href={MANAGEMENT_ROUTES.appointments}
          className="secondary-button dashboard-health-alert__secondary"
        >
          Abrir agenda
        </Link>
      </div>
    </section>
  );
}

function DashboardHealthSummary({
  customerGrowth,
  finance,
  agenda,
  attentionItems,
  pendingClientAppRequests,
}: {
  customerGrowth: DashboardHomeData["customerGrowth"];
  finance: DashboardHomeData["finance"];
  agenda: DashboardHomeData["agenda"];
  attentionItems: DashboardHomeData["attentionItems"];
  pendingClientAppRequests: number;
}) {
  const agendaHeadline =
    agenda.items.length === 0 ? "Horários vazios hoje" : "Horários do dia";

  return (
    <section className="dashboard-health-grid" aria-label="Saúde do salão">
      <div className="dashboard-health-grid__main">
        <div className="dashboard-health-grid__cards">
          <article className="dashboard-health-card dashboard-health-card--ink">
            <div>
              <div className="dashboard-health-card__intro">
                <DashboardFigureBadge kind="rocket" tone="sky" />
                <div className="dashboard-health-card__heading">
                  <div className="dashboard-health-card__topline">
                    <span className="dashboard-health-card__eyebrow">
                      Carteira
                    </span>
                    <small className="dashboard-health-card__mini-positive">
                      +{customerGrowth.newCustomersToday} hoje
                    </small>
                  </div>
                  <h2>Novas clientes no mês</h2>
                </div>
              </div>
              <strong>{customerGrowth.newCustomersThisMonth}</strong>
              <p>
                Ritmo {customerGrowth.monthlyDeltaLabel} em relação ao mês anterior.
              </p>
            </div>
            <div className="dashboard-health-card__footer">
              <span>
                {formatCountLabel(
                  customerGrowth.activeCustomersLast30d,
                  "cliente ativa",
                  "clientes ativas",
                )}{" "}
                nos últimos 30 dias
              </span>
              <Link
                href={MANAGEMENT_ROUTES.clients}
                className="dashboard-health-card__link"
              >
                Abrir clientes
              </Link>
            </div>
          </article>

          <article className="dashboard-health-card dashboard-health-card--coral">
            <div>
              <div className="dashboard-health-card__intro">
                <DashboardFigureBadge kind="money" tone="gold" />
                <div className="dashboard-health-card__heading">
                  <span className="dashboard-health-card__eyebrow">Caixa</span>
                  <h2>Comandas em aberto</h2>
                </div>
              </div>
              <strong>{finance.openTabsPendingLabel}</strong>
              <p>
                {finance.openTabsCount
                  ? `${formatCountLabel(finance.openTabsCount, "comanda aberta", "comandas abertas")} aguardando fechamento.`
                  : "Nenhuma comanda aberta agora."}
              </p>
            </div>
            <div className="dashboard-health-card__footer">
              <span>Ticket médio do mês {finance.averageTicketLabel}</span>
              <Link
                href={DASHBOARD_HOME_ROUTES.finance}
                className="dashboard-health-card__link"
              >
                Fechar comandas
              </Link>
            </div>
          </article>

          <article className="dashboard-health-card dashboard-health-card--ice">
            <div>
              <div className="dashboard-health-card__intro">
                <DashboardFigureBadge kind="bars" tone="soft" />
                <div className="dashboard-health-card__heading">
                  <span className="dashboard-health-card__eyebrow">Agenda</span>
                  <h2>{agendaHeadline}</h2>
                </div>
              </div>
              <div className="dashboard-health-card__value-inline">
                <strong>{finance.todayRevenueLabel}</strong>
                <small>previstos hoje</small>
              </div>
              <p>
                {agenda.items.length
                  ? `${formatCountLabel(agenda.items.length, "horário confirmado", "horários confirmados")} hoje.`
                  : "Nenhum horário confirmado no dia."}
              </p>
            </div>
            <div className="dashboard-health-card__footer">
              <span>
                {formatCountLabel(
                  pendingClientAppRequests,
                  "pedido do app",
                  "pedidos do app",
                )}{" "}
                aguardando
              </span>
              <Link
                href={MANAGEMENT_ROUTES.appointments}
                className="dashboard-health-card__link dashboard-health-card__link--success"
              >
                Preencher agenda
              </Link>
            </div>
          </article>
        </div>

        <DashboardActionPriorities
          attentionItems={attentionItems}
          pendingClientAppRequests={pendingClientAppRequests}
          finance={finance}
          compact
        />
      </div>
    </section>
  );
}

function DashboardActionPriorities({
  attentionItems,
  pendingClientAppRequests,
  finance,
  compact = false,
}: {
  attentionItems: DashboardHomeData["attentionItems"];
  pendingClientAppRequests: number;
  finance: DashboardHomeData["finance"];
  compact?: boolean;
}) {
  const priorities = [
    {
      title: "Criar promoção rápida",
      icon: "megaphone" as const,
      iconTone: "warm" as const,
      description:
        pendingClientAppRequests > 0
          ? `${formatCountLabel(pendingClientAppRequests, "pedido do app", "pedidos do app")} podem virar ação de retomada hoje.`
          : "Oferta rápida para aquecer a agenda de hoje.",
      href: DASHBOARD_HOME_ROUTES.promotions,
      cta: "Abrir promoções",
      tone: "warm",
    },
    {
      title: "Reativar clientes inativos",
      icon: "rocket" as const,
      iconTone: "sky" as const,
      description:
        attentionItems[0]?.description ??
        "Clientes sem retorno há 30 dias pedem uma nova conversa.",
      href: MANAGEMENT_ROUTES.clients,
      cta: "Ver carteira",
      tone: "success",
    },
    {
      title: "Ajustar preços",
      icon: "bars" as const,
      iconTone: "gold" as const,
      description:
        finance.openTabsCount > 0
          ? `${formatCountLabel(finance.openTabsCount, "comanda em aberto", "comandas em aberto")} pedem revisão de oferta e margem.`
          : `Ticket médio atual: ${finance.averageTicketLabel}.`,
      href: MANAGEMENT_ROUTES.services,
      cta: "Ver oportunidades",
      tone: "soft",
    },
  ];

  return (
    <section
      className={`dashboard-priorities${compact ? " dashboard-priorities--compact" : ""}`}
      aria-label="Prioridades para ação"
    >
      <div className="dashboard-priorities__header">
        <div>
          <span className="eyebrow">Prioridades para ação</span>
          <h2>O que fazer agora</h2>
        </div>
        <p className="muted">
          Ações rápidas com base nos dados reais do painel.
        </p>
      </div>

      <div className="dashboard-priorities__grid">
        {priorities.map((priority) => (
          <article
            key={priority.title}
            className={`dashboard-priority-card dashboard-priority-card--${priority.tone}`}
          >
            <div className="dashboard-priority-card__header">
              <DashboardFigureBadge
                kind={priority.icon}
                tone={priority.iconTone}
              />
              <div>
                <h3>{priority.title}</h3>
                <p>{priority.description}</p>
              </div>
            </div>
            <Link href={priority.href} className="primary-button">
              {priority.cta}
            </Link>
          </article>
        ))}
      </div>
    </section>
  );
}

export function DashboardGrowthPanel({
  customerGrowth,
}: {
  customerGrowth: DashboardHomeData["customerGrowth"];
}) {
  const chartPeak = Math.max(...customerGrowth.series.map((item) => item.count), 1);
  const chartAverageRaw =
    customerGrowth.series.reduce((total, item) => total + item.count, 0) /
    Math.max(customerGrowth.series.length, 1);
  const chartAverage = Math.round(chartAverageRaw);
  const currentItem =
    customerGrowth.series[customerGrowth.series.length - 1] ?? null;
  const bestMonth =
    customerGrowth.series.reduce<(typeof customerGrowth.series)[number] | null>(
      (currentBest, item) => {
        if (!currentBest || item.count > currentBest.count) {
          return item;
        }

        return currentBest;
      },
      null,
    ) ?? currentItem;
  const bestMonthIndex = Math.max(
    customerGrowth.series.findIndex((item) => item.key === bestMonth?.key),
    0,
  );
  const deltaValue =
    Number.parseInt(customerGrowth.monthlyDeltaLabel.replace("%", ""), 10) || 0;
  const deltaIsNegative = deltaValue < 0;
  const deltaIsPositive = deltaValue > 0;
  const statusHeadline = deltaIsNegative
    ? "Atenção necessária"
    : deltaIsPositive
      ? "Ritmo acima da média"
      : "Ritmo estável";
  const statusDetail = deltaIsNegative
    ? "Ritmo abaixo da média dos últimos 6 meses."
      : deltaIsPositive
        ? "Ritmo acima da média dos últimos 6 meses."
        : "Sem variação relevante contra o mês anterior.";
  const topCardHeadline =
    customerGrowth.newCustomersToday > 0
      ? `+${customerGrowth.newCustomersToday} hoje no radar`
      : "Nenhuma nova entrada hoje";
  const topCardDetail = bestMonth
    ? `Pico do período: ${bestMonth.count} em ${bestMonth.label}. ${statusDetail}`
    : statusDetail;
  const chartGuides = Array.from(
    new Set([
      chartPeak,
      Math.max(1, Math.ceil(chartPeak * 0.66)),
      Math.max(1, Math.ceil(chartPeak * 0.33)),
      0,
    ]),
  ).sort((left, right) => right - left);
  const chartWidth = 760;
  const chartHeight = 340;
  const chartPaddingX = 18;
  const chartPaddingTop = 24;
  const chartPaddingBottom = 28;
  const chartUsableHeight = chartHeight - chartPaddingTop - chartPaddingBottom;
  const chartStep =
    customerGrowth.series.length > 1
      ? (chartWidth - chartPaddingX * 2) / (customerGrowth.series.length - 1)
      : 0;
  const chartScale = Math.max(chartPeak, chartAverageRaw, 1);
  const chartPoints = customerGrowth.series.map((item, index) => ({
    item,
    index,
    x: chartPaddingX + chartStep * index,
    y:
      chartPaddingTop +
      chartUsableHeight -
      (item.count / chartScale) * chartUsableHeight,
  }));
  const backgroundPoints = customerGrowth.series.map((item, index) => ({
    x: chartPaddingX + chartStep * index,
    y:
      chartPaddingTop +
      chartUsableHeight * 0.26 +
      (chartUsableHeight * 0.32 * (chartPeak - item.count + chartAverageRaw)) /
        Math.max(chartScale + chartAverageRaw, 1),
  }));
  const highlightedPoint =
    chartPoints[bestMonthIndex] ?? chartPoints[chartPoints.length - 1] ?? null;
  const averageLineY =
    chartPaddingTop +
    chartUsableHeight -
    (chartAverageRaw / chartScale) * chartUsableHeight;
  const guidePositions = chartGuides.map((level) => ({
    level,
    y:
      chartPaddingTop +
      chartUsableHeight -
      (level / chartScale) * chartUsableHeight,
  }));

  const buildSmoothPath = (
    points: Array<{ x: number; y: number }>,
    baselineY?: number,
  ) => {
    if (!points.length) {
      return "";
    }

    let path = `M ${points[0].x} ${points[0].y}`;

    for (let index = 0; index < points.length - 1; index += 1) {
      const previousPoint = points[index - 1] ?? points[index];
      const currentPoint = points[index];
      const nextPoint = points[index + 1];
      const afterNextPoint = points[index + 2] ?? nextPoint;
      const controlPointOneX =
        currentPoint.x + (nextPoint.x - previousPoint.x) / 6;
      const controlPointOneY =
        currentPoint.y + (nextPoint.y - previousPoint.y) / 6;
      const controlPointTwoX =
        nextPoint.x - (afterNextPoint.x - currentPoint.x) / 6;
      const controlPointTwoY =
        nextPoint.y - (afterNextPoint.y - currentPoint.y) / 6;

      path += ` C ${controlPointOneX} ${controlPointOneY} ${controlPointTwoX} ${controlPointTwoY} ${nextPoint.x} ${nextPoint.y}`;
    }

    if (typeof baselineY === "number") {
      const lastPoint = points[points.length - 1];
      const firstPoint = points[0];
      path += ` L ${lastPoint.x} ${baselineY} L ${firstPoint.x} ${baselineY} Z`;
    }

    return path;
  };

  const mainAreaPath = buildSmoothPath(
    chartPoints.map((point) => ({ x: point.x, y: point.y })),
    chartHeight,
  );
  const backgroundAreaPath = buildSmoothPath(backgroundPoints, chartHeight);
  const linePath = buildSmoothPath(
    chartPoints.map((point) => ({ x: point.x, y: point.y })),
  );
  const tooltipStyle = {
    "--growth-tooltip-left": `${Math.min(
      84,
      Math.max(
        18,
        highlightedPoint
          ? ((highlightedPoint.x - chartPaddingX) /
              Math.max(chartWidth - chartPaddingX * 2, 1)) *
              100
          : 50,
      ),
    )}%`,
    "--growth-tooltip-top": "18%",
  } as CSSProperties;
  const growthAlertLabel = `${customerGrowth.monthlyDeltaLabel} nas entradas`;
  const currentMonthNarrative = currentItem
    ? `${currentItem.label} fechou com ${formatCountLabel(currentItem.count, "nova cliente", "novas clientes")}.`
    : "Sem leitura recente.";

  return (
    <article
      id="dashboard-growth-panel"
      className="card content-card dashboard-panel dashboard-panel--growth"
    >
      <div className="dashboard-growth-hero">
        <div className="dashboard-growth-hero__top">
          <div className="dashboard-growth-hero__title-block">
            <div className="dashboard-growth-hero__eyebrow">Crescimento</div>
            <div className="dashboard-panel__header dashboard-growth-hero__header">
              <div>
                <h2>Crescimento de clientes</h2>
                <p className="muted">
                  Base, entradas e ritmo dos últimos 6 meses.
                </p>
              </div>
              <Link
                href={MANAGEMENT_ROUTES.clients}
                className="dashboard-panel__link"
              >
                Abrir clientes
              </Link>
            </div>
          </div>

          <article
            className={`dashboard-growth-hero__alert${deltaIsNegative ? " dashboard-growth-hero__alert--warning" : ""}`}
          >
            <DashboardFigureBadge
              kind={customerGrowth.newCustomersToday > 0 ? "rocket" : deltaIsNegative ? "warning" : "bars"}
              tone={deltaIsNegative ? "warm" : "soft"}
              size="sm"
            />
            <div>
              <strong>
                {topCardHeadline}
              </strong>
              <small>
                {topCardDetail}{" "}
                <span className="dashboard-growth-hero__alert-pill">
                  {growthAlertLabel}
                </span>
              </small>
            </div>
          </article>
        </div>

        <div className="dashboard-growth-summary">
          <article className="dashboard-growth-kpi dashboard-growth-kpi--hero">
            <span>Base total</span>
            <strong>{customerGrowth.totalCustomers}</strong>
            <small>Clientes cadastradas na operação do salão.</small>
          </article>

          <article className="dashboard-growth-kpi dashboard-growth-kpi--hero">
            <span>Ativas 30d</span>
            <strong>{customerGrowth.activeCustomersLast30d}</strong>
            <small>Clientes com atendimento concluído nos últimos 30 dias.</small>
          </article>

          <article className="dashboard-growth-kpi dashboard-growth-kpi--hero dashboard-growth-kpi--accent">
            <span>Novas no mês</span>
            <em>
              {customerGrowth.newCustomersThisMonth > 0
                ? `+${customerGrowth.newCustomersThisMonth} novas clientes`
                : "Sem novas clientes"}
            </em>
            <strong>{customerGrowth.monthlyDeltaLabel}</strong>
            <small>
              {customerGrowth.hasPreviousBaseline
                ? "Ritmo contra a média dos últimos 6 meses."
                : "Sem base anterior relevante para comparação."}
            </small>
          </article>
        </div>

        <div className="dashboard-growth-hero__chart">
          <div className="dashboard-growth-hero__chart-top">
            <div className="dashboard-chart__heading">
              <h3>Entrada de clientes</h3>
              <small>Leitura comercial real dos últimos 6 meses do salão.</small>
            </div>

            <div className="dashboard-growth-hero__chart-delta">
              <span>Vs mês anterior</span>
              <strong>{customerGrowth.monthlyDeltaLabel}</strong>
            </div>
          </div>

          <div className="dashboard-chart__summary dashboard-growth-hero__chart-summary">
            <span className="dashboard-chart__tag">
              Pico do período: {bestMonth?.count ?? chartPeak} ({bestMonth?.label ?? "sem leitura"})
            </span>
            <span className="dashboard-chart__tag dashboard-chart__tag--accent">
              Média de 6 meses: {formatCountLabel(chartAverage, "cliente", "clientes")}
            </span>
          </div>

          <div className="dashboard-growth-hero__plot-grid">
            <div className="dashboard-growth-hero__axis" aria-hidden="true">
              {guidePositions.map((guide) => (
                <span
                  key={guide.level}
                  style={{ top: `${(guide.y / chartHeight) * 100}%` }}
                >
                  {guide.level}
                </span>
              ))}
            </div>

            <div className="dashboard-growth-hero__plot-shell">
              {highlightedPoint ? (
                <div
                  className="dashboard-growth-hero__tooltip"
                  style={tooltipStyle}
                >
                  <strong>
                    <span>
                      {bestMonth?.label ?? currentItem?.label ?? "Agora"}
                    </span>
                    <span aria-hidden="true">•</span>
                    <span>
                      {formatCountLabel(
                        bestMonth?.count ?? currentItem?.count ?? 0,
                        "entrada",
                        "entradas",
                      )}
                    </span>
                  </strong>
                  <small>Melhor fechamento do período no gráfico real.</small>
                  <small>
                    Média do semestre: {formatCountLabel(chartAverage, "cliente", "clientes")}
                  </small>
                </div>
              ) : null}

              <div
                className="dashboard-growth-hero__average-label"
                style={{ top: `${(averageLineY / chartHeight) * 100}%` }}
              >
                Média últimos 6 meses
              </div>

              <div className="dashboard-growth-hero__real-label">
                Entradas reais
              </div>

              <svg
                viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                className="dashboard-growth-hero__svg"
                aria-hidden="true"
                focusable="false"
              >
                <defs>
                  <linearGradient
                    id="dashboard-growth-main-fill"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="0%" stopColor="rgba(86, 127, 205, 0.58)" />
                    <stop offset="50%" stopColor="rgba(86, 127, 205, 0.22)" />
                    <stop offset="100%" stopColor="rgba(86, 127, 205, 0.04)" />
                  </linearGradient>
                  <linearGradient
                    id="dashboard-growth-soft-fill"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="0%" stopColor="rgba(230, 239, 255, 0.9)" />
                    <stop offset="100%" stopColor="rgba(230, 239, 255, 0)" />
                  </linearGradient>
                  <linearGradient
                    id="dashboard-growth-line"
                    x1="0"
                    y1="0"
                    x2="1"
                    y2="0"
                  >
                    <stop offset="0%" stopColor="#2c4c7b" />
                    <stop offset="50%" stopColor="#3769b3" />
                    <stop offset="100%" stopColor="#7aa8ff" />
                  </linearGradient>
                </defs>

                {guidePositions
                  .filter((guide) => guide.level > 0)
                  .map((guide) => (
                    <line
                      key={`guide-${guide.level}`}
                      x1={chartPaddingX}
                      y1={guide.y}
                      x2={chartWidth - chartPaddingX}
                      y2={guide.y}
                      className="dashboard-growth-hero__grid-line"
                    />
                  ))}

                <path
                  d={backgroundAreaPath}
                  className="dashboard-growth-hero__soft-area"
                />

                <line
                  x1={chartPaddingX}
                  y1={averageLineY}
                  x2={chartWidth - chartPaddingX}
                  y2={averageLineY}
                  className="dashboard-growth-hero__average-line"
                />

                {highlightedPoint ? (
                  <line
                    x1={highlightedPoint.x}
                    y1={highlightedPoint.y}
                    x2={highlightedPoint.x}
                    y2={chartHeight}
                    className="dashboard-growth-hero__focus-line"
                  />
                ) : null}

                <path
                  d={mainAreaPath}
                  className="dashboard-growth-hero__main-area"
                />
                <path
                  d={linePath}
                  className="dashboard-growth-hero__line"
                />

                {chartPoints.map((point, index) => (
                  <g
                    key={point.item.key}
                    className={`dashboard-growth-hero__point${
                      index === bestMonthIndex
                        ? " dashboard-growth-hero__point--peak"
                        : index === chartPoints.length - 1
                          ? " dashboard-growth-hero__point--current"
                          : ""
                    }`}
                  >
                    <circle
                      cx={point.x}
                      cy={point.y}
                      r={index === bestMonthIndex ? 11 : 8}
                      className="dashboard-growth-hero__point-glow"
                    />
                    <circle
                      cx={point.x}
                      cy={point.y}
                      r={index === bestMonthIndex ? 6.5 : 5}
                      className="dashboard-growth-hero__point-core"
                    />
                  </g>
                ))}
              </svg>
            </div>

            <span aria-hidden="true" />
            <div
              className="dashboard-growth-hero__x-axis"
              style={{
                gridTemplateColumns: `repeat(${customerGrowth.series.length}, minmax(0, 1fr))`,
              }}
            >
              {customerGrowth.series.map((item, index) => (
                <span
                  key={item.key}
                  className={`dashboard-growth-hero__x-label${
                    index === bestMonthIndex
                      ? " dashboard-growth-hero__x-label--peak"
                      : ""
                  }`}
                >
                  {item.label}
                </span>
              ))}
            </div>
          </div>

          <div className="dashboard-growth-hero__footnotes">
            <p>{currentMonthNarrative}</p>
            <p>
              {customerGrowth.hasPreviousBaseline
                ? `Comparação direta: ${customerGrowth.monthlyDeltaLabel} contra o mês anterior.`
                : "Ainda não existe base anterior suficiente para comparação direta."}
            </p>
          </div>
        </div>
      </div>
    </article>
  );
}

function DashboardAgendaPanel({
  agenda,
}: {
  agenda: DashboardHomeData["agenda"];
}) {
  return (
    <article
      id="dashboard-agenda-day"
      className="card content-card dashboard-panel dashboard-panel--agenda"
    >
      <div className="dashboard-panel__header">
        <h2>Agenda do dia</h2>
        <Link
          href={MANAGEMENT_ROUTES.appointments}
          className="dashboard-panel__link"
        >
          {agenda.dateLabel}
        </Link>
      </div>

      <div className="dashboard-agenda-list">
        {!agenda.items.length ? (
          <div className="dashboard-empty">
            Nenhum horário hoje. Abra a agenda para organizar o dia.
          </div>
        ) : (
          agenda.items.map((appointment) => (
            <div key={appointment.id} className="dashboard-agenda-item">
              <div className="dashboard-agenda-item__content">
                <strong className="dashboard-agenda-item__time">
                  {appointment.timeLabel}
                </strong>
                <span className="dashboard-agenda-item__separator">-</span>
                <strong>{appointment.serviceName}</strong>
                <span>{appointment.customerLine}</span>
              </div>

              {appointment.isPending ? (
                <span className="dashboard-agenda-item__flag" />
              ) : null}
            </div>
          ))
        )}
      </div>
    </article>
  );
}

function DashboardFinancePanel({
  finance,
}: {
  finance: DashboardHomeData["finance"];
}) {
  const recoveryHeadline =
    finance.openTabsCount > 0
      ? `Recupere até ${finance.openTabsPendingLabel} hoje`
      : `Hoje estão previstos ${finance.todayRevenueLabel}`;
  const recoveryNote =
    finance.openTabsCount > 0
      ? `${formatCountLabel(finance.openTabsCount, "comanda", "comandas")} ainda pedem fechamento no caixa.`
      : `${formatCountLabel(finance.monthCompletedAppointmentsCount, "atendimento concluído", "atendimentos concluídos")} no mês.`;

  return (
    <article className="card content-card dashboard-panel dashboard-panel--finance">
      <div className="dashboard-panel__header">
        <div className="dashboard-panel__title">
          <DashboardFigureBadge kind="wallet" tone="soft" size="sm" />
          <h2>Finanças do salão</h2>
        </div>
        <Link href="/dashboard/finance" className="dashboard-panel__link">
          Abrir caixa
        </Link>
      </div>

      <div className="dashboard-finance-highlight">
        <div>
          <span className="dashboard-finance-highlight__eyebrow">
            Foco financeiro
          </span>
          <strong>{recoveryHeadline}</strong>
        </div>
        <p>{recoveryNote}</p>
      </div>

      <div className="dashboard-finance-executive-grid">
        <article className="dashboard-finance-executive-card">
          <span>Faturamento previsto</span>
          <strong>{finance.todayRevenueLabel}</strong>
          <small>
            {formatCountLabel(
              finance.todayAppointmentsCount,
              "horário previsto hoje",
              "horários previstos hoje",
            )}
          </small>
        </article>

        <article className="dashboard-finance-executive-card">
          <span>Faturamento do mês</span>
          <strong>{finance.monthRevenueLabel}</strong>
          <small>
            {formatCountLabel(
              finance.monthCompletedAppointmentsCount,
              "atendimento concluído",
              "atendimentos concluídos",
            )}
          </small>
        </article>

        <article className="dashboard-finance-executive-card">
          <span>Comandas abertas</span>
          <strong>{finance.openTabsCount}</strong>
          <small>
            {finance.openTabsCount
              ? `${finance.openTabsPendingLabel} em aberto`
              : "Nenhuma comanda aberta agora"}
          </small>
        </article>

        <article className="dashboard-finance-executive-card dashboard-finance-executive-card--accent">
          <span>Ticket médio</span>
          <strong>{finance.averageTicketLabel}</strong>
          <small>Leitura média do mês</small>
        </article>
      </div>
    </article>
  );
}

function DashboardClientAppRequestsPanel({
  clientAppRequests,
}: {
  clientAppRequests: DashboardHomeData["clientAppRequests"];
}) {
  const appointmentCount = clientAppRequests.appointments.length;
  const storeOrderCount = clientAppRequests.storeOrders.length;
  const pendingMembershipRequests = clientAppRequests.memberships.filter(
    (request) => request.stage === "pending_approval",
  );
  const awaitingPaymentRequests = clientAppRequests.memberships.filter(
    (request) => request.stage === "awaiting_payment",
  );
  const membershipCount =
    pendingMembershipRequests.length + awaitingPaymentRequests.length;
  const hasRequests =
    appointmentCount > 0 || membershipCount > 0 || storeOrderCount > 0;

  return (
    <article
      id="dashboard-client-requests"
      className="card content-card dashboard-panel dashboard-panel--client-requests"
    >
      <div className="dashboard-panel__header">
        <div>
          <h2>Pedidos do aplicativo</h2>
          <p className="muted">Agendamentos, pedidos e planos enviados pelo aplicativo.</p>
        </div>
        <span className="dashboard-panel__link">
          {clientAppRequests.pendingCount} aguardando
        </span>
      </div>

      {hasRequests ? (
        <div className="dashboard-request-stack">
          <div className="dashboard-request-overview">
            <article className="dashboard-request-overview__card">
              <span>Agendamentos</span>
              <strong>{appointmentCount}</strong>
            </article>
            <article className="dashboard-request-overview__card">
              <span>Loja</span>
              <strong>{storeOrderCount}</strong>
            </article>
            <article className="dashboard-request-overview__card">
              <span>Planos</span>
              <strong>{membershipCount}</strong>
            </article>
          </div>

          {appointmentCount ? (
            <section className="dashboard-request-section">
              <div className="dashboard-request-section__header">
                <div>
                  <h3>Agendamentos</h3>
                  <p className="muted">Confirme os horários enviados pelo aplicativo.</p>
                </div>
                <span className="dashboard-request-section__count">
                  {appointmentCount}
                </span>
              </div>
              <div className="simple-list dashboard-request-section__list">
                {clientAppRequests.appointments.map((request) => (
                  <article
                    key={`appointment-${request.id}`}
                    className="simple-row"
                  >
                    <div
                      className="inline-actions"
                      style={{ marginBottom: 6, flexWrap: "wrap" }}
                    >
                      <span className="badge badge--pending">Agendamento</span>
                      <span className="badge badge--soft">
                        {request.customerName}
                      </span>
                      <span className="badge badge--soft">
                        {request.dateLabel} • {request.timeLabel}
                      </span>
                    </div>
                    <h4>{request.serviceName}</h4>
                    <p className="muted">
                      Pedido aguardando confirmação do salão.
                    </p>
                    <div
                      className="simple-row__actions"
                      style={{ flexWrap: "wrap" }}
                    >
                      <AsyncActionForm
                        action={updateManagementAppointmentStatusAction}
                      >
                        <input
                          type="hidden"
                          name="returnPath"
                          value="/dashboard"
                        />
                        <input
                          type="hidden"
                          name="appointmentId"
                          value={request.id}
                        />
                        <input type="hidden" name="status" value="confirmed" />
                        <button type="submit" className="primary-button">
                          Confirmar horário
                        </button>
                      </AsyncActionForm>
                      <Link
                        href={MANAGEMENT_ROUTES.appointments}
                        className="secondary-button"
                      >
                        Abrir agenda
                      </Link>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          {storeOrderCount ? (
            <section className="dashboard-request-section">
              <div className="dashboard-request-section__header">
                <div>
                  <h3>Pedidos da loja</h3>
                  <p className="muted">
                    Separe e confirme o que entrou pela vitrine.
                  </p>
                </div>
                <span className="dashboard-request-section__count">
                  {storeOrderCount}
                </span>
              </div>
              <div className="simple-list dashboard-request-section__list">
                {clientAppRequests.storeOrders.map((request) => (
                  <article
                    key={`store-order-${request.id}`}
                    className="simple-row"
                  >
                    <div
                      className="inline-actions"
                      style={{ marginBottom: 6, flexWrap: "wrap" }}
                    >
                      <span className="badge badge--pending">Loja</span>
                      <span className="badge badge--soft">
                        {request.customerName}
                      </span>
                      <span className="badge badge--soft">
                        {request.orderNumberLabel}
                      </span>
                    </div>
                    <h4>{request.itemsLabel}</h4>
                    <p className="muted">
                      {request.priceLabel} • {request.requestedAtLabel}
                    </p>
                    <small className="list-meta">{request.note}</small>
                    <div
                      className="simple-row__actions"
                      style={{ flexWrap: "wrap" }}
                    >
                      <form action={updateCustomerProductOrderStatusAction}>
                        <input
                          type="hidden"
                          name="returnPath"
                          value="/dashboard"
                        />
                        <input
                          type="hidden"
                          name="orderId"
                          value={request.id}
                        />
                        <input type="hidden" name="status" value="confirmed" />
                        <button type="submit" className="primary-button">
                          Confirmar pedido
                        </button>
                      </form>
                      <Link
                        href="/dashboard/inventory"
                        className="secondary-button"
                      >
                        Abrir loja
                      </Link>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          {membershipCount ? (
            <section className="dashboard-request-section">
              <div className="dashboard-request-section__header">
                <div>
                  <h3>Pedidos de plano</h3>
                  <p className="muted">
                    Aprove o pedido e confirme o pagamento sem sair da tela
                    inicial.
                  </p>
                </div>
                <span className="dashboard-request-section__count">
                  {membershipCount}
                </span>
              </div>
              <div className="simple-list dashboard-request-section__list">
                {[...pendingMembershipRequests, ...awaitingPaymentRequests].map(
                  (request) => (
                  <article
                    key={`membership-${request.id}`}
                    className="simple-row"
                  >
                    <div
                      className="inline-actions"
                      style={{ marginBottom: 6, flexWrap: "wrap" }}
                    >
                      <span className="badge badge--pending">
                        {request.stage === "awaiting_payment"
                          ? "Aguardando pagamento"
                          : "Plano"}
                      </span>
                      <span className="badge badge--soft">
                        {request.customerName}
                      </span>
                      <span className="badge badge--soft">
                        {request.stage === "awaiting_payment" &&
                        request.approvedAtLabel
                          ? `Aprovado em ${request.approvedAtLabel}`
                          : request.requestedAtLabel}
                      </span>
                    </div>
                    <h4>{request.title}</h4>
                    <p className="muted">
                      {request.stage === "awaiting_payment"
                        ? request.priceLabel
                          ? `${request.priceLabel} • pedido aprovado e aguardando confirmação de pagamento.`
                          : "Pedido aprovado e aguardando confirmação de pagamento."
                        : request.priceLabel
                          ? `${request.priceLabel} • pedido feito pelo aplicativo.`
                          : "Pedido feito pelo aplicativo."}
                    </p>
                    {request.validityLabel ? (
                      <p className="list-meta">
                        {request.stage === "awaiting_payment" &&
                        request.approvedStartsOnLabel
                          ? `Início programado: ${request.approvedStartsOnLabel} • ${request.validityLabel}`
                          : request.validityLabel}
                      </p>
                    ) : null}
                    <small className="list-meta">
                      {request.note.startsWith("Sem observação")
                        ? request.note
                        : `Mensagem da cliente: ${request.note}`}
                    </small>
                    <div
                      className="simple-row__actions"
                      style={{ flexWrap: "wrap" }}
                    >
                      {request.stage === "awaiting_payment" ? (
                        <form action={markCustomerMembershipRequestPaidAction}>
                          <input
                            type="hidden"
                            name="returnPath"
                            value="/dashboard"
                          />
                          <input
                            type="hidden"
                            name="requestId"
                            value={request.id}
                          />
                          <button type="submit" className="primary-button">
                            Marcar como pago e ativar
                          </button>
                        </form>
                      ) : (
                        <form
                          action={approveCustomerMembershipRequestAction}
                          style={{
                            display: "flex",
                            gap: 10,
                            flexWrap: "wrap",
                            alignItems: "end",
                          }}
                        >
                          <input
                            type="hidden"
                            name="returnPath"
                            value="/dashboard"
                          />
                          <input
                            type="hidden"
                            name="requestId"
                            value={request.id}
                          />
                          <div className="field" style={{ minWidth: 190 }}>
                            <label htmlFor={`membership-start-${request.id}`}>
                              Início real da assinatura
                            </label>
                            <input
                              id={`membership-start-${request.id}`}
                              name="startsOn"
                              type="date"
                              defaultValue={request.defaultStartsOn}
                              required
                            />
                          </div>
                          <button type="submit" className="primary-button">
                            Aprovar e aguardar pagamento
                          </button>
                        </form>
                      )}
                      <Link
                        href="/dashboard/subscriptions"
                        className="secondary-button"
                      >
                        Ver plano
                      </Link>
                    </div>
                  </article>
                ),
                )}
              </div>
            </section>
          ) : null}
        </div>
      ) : (
        <EmptyStateCard
          eyebrow="Sem pedidos"
          title="Nada pendente agora"
          description="Quando a cliente pedir horário, produto ou plano pelo aplicativo, aparece aqui."
        />
      )}
    </article>
  );
}

function DashboardAttentionPanel({
  attentionItems,
}: {
  attentionItems: DashboardHomeData["attentionItems"];
}) {
  return (
    <article
      id="dashboard-attention"
      className="card content-card dashboard-panel dashboard-panel--attention dashboard-panel--attention-summary"
    >
      <div className="dashboard-panel__header">
        <h2>O que merece atenção hoje</h2>
      </div>

      {attentionItems.length ? (
        <div className="simple-list" style={{ padding: "14px 18px 16px" }}>
          {attentionItems.map((item) => (
            <article key={item.label} className="simple-row">
              <h3>{item.label}</h3>
              <p className="muted">{item.description}</p>
              <div className="simple-row__actions">
                <Link href={item.href} className="secondary-button">
                  Abrir
                </Link>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <EmptyStateCard
          eyebrow="Tudo em ordem"
          title="Nenhum alerta importante agora"
          description="Operação do dia sem pendência crítica."
        />
      )}
    </article>
  );
}

export function DashboardVacancyRadarPanel({
  vacancyRadar,
}: {
  vacancyRadar: DashboardHomeData["vacancyRadar"];
}) {
  return (
    <article className="card content-card dashboard-panel dashboard-panel--vacancy-radar">
      <div className="dashboard-panel__header">
        <div>
          <h2>Vagas para preencher</h2>
          <p className="muted">Veja horários livres e as clientes com mais chance de encaixe.</p>
        </div>
        <Link href={MANAGEMENT_ROUTES.appointments} className="dashboard-panel__link">
          {formatCountLabel(vacancyRadar.openCount, "vaga", "vagas")}
        </Link>
      </div>

      {vacancyRadar.items.length ? (
        <div className="simple-list" style={{ padding: "14px 18px 16px" }}>
          {vacancyRadar.items.map((item) => (
            <article key={item.id} className="simple-row">
              <div
                className="inline-actions"
                style={{ marginBottom: 8, flexWrap: "wrap" }}
              >
                <span className="badge badge--pending">{item.serviceName}</span>
                <span className="badge badge--soft">{item.staffName}</span>
                <span className="badge badge--soft">{item.scheduleLabel}</span>
              </div>
              <h3>{item.summary}</h3>
              {item.suggestions.length ? (
                <div className="simple-list" style={{ padding: 0 }}>
                  {item.suggestions.map((suggestion) => (
                    <div key={suggestion.id} className="simple-row">
                      <strong>{suggestion.name}</strong>
                      <p className="muted" style={{ margin: "4px 0 0" }}>
                        {suggestion.daysSinceLastVisitLabel} - {suggestion.reasonLabel}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="muted" style={{ margin: "6px 0 0" }}>
                  Ainda não surgiu uma cliente forte para esta vaga. Vale abrir
                  uma campanha ou avisar a base.
                </p>
              )}
              <div className="simple-row__actions" style={{ flexWrap: "wrap" }}>
                <a href={item.agendaHref} className="secondary-button">
                  Abrir vaga na agenda
                </a>
                <Link href={MANAGEMENT_ROUTES.clients} className="secondary-button">
                  Abrir clientes
                </Link>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <EmptyStateCard
          eyebrow="Sem vaga aberta"
          title="Nenhuma vaga precisando de encaixe agora"
          description="Quando houver cancelamento, o painel mostra quem tem mais chance de ocupar o horário."
        />
      )}
    </article>
  );
}

export function DashboardMovementForecastPanel({
  movementForecast,
}: {
  movementForecast: DashboardHomeData["movementForecast"];
}) {
  return (
    <article className="card content-card dashboard-panel dashboard-panel--movement-forecast">
      <div className="dashboard-panel__header">
        <div>
          <h2>Movimento previsto</h2>
          <p className="muted">Resumo do movimento do salão com base na agenda real.</p>
        </div>
        <Link href="/dashboard/operations" className="dashboard-panel__link">
          Ver operação
        </Link>
      </div>

      {movementForecast.hasBaseline ? (
        <div className="simple-list" style={{ padding: "14px 18px 16px" }}>
          <article className="simple-row">
            <h3>{movementForecast.summary}</h3>
            <div
              className="inline-actions"
              style={{ marginTop: 8, flexWrap: "wrap" }}
            >
              {movementForecast.weakestDayLabel &&
              movementForecast.weakestDayVolumeLabel ? (
                <span className="badge badge--pending">
                  Mais fraco: {movementForecast.weakestDayLabel} •{" "}
                  {movementForecast.weakestDayVolumeLabel}
                </span>
              ) : null}
              {movementForecast.strongestDayLabel &&
              movementForecast.strongestDayVolumeLabel ? (
                <span className="badge badge--confirmed">
                  Mais forte: {movementForecast.strongestDayLabel} •{" "}
                  {movementForecast.strongestDayVolumeLabel}
                </span>
              ) : null}
              {movementForecast.lowWindowLabel ? (
                <span className="badge badge--soft">
                  Horário mais vazio: {movementForecast.lowWindowLabel}
                </span>
              ) : null}
              {movementForecast.focusServiceLabel ? (
                <span className="badge badge--soft">
                  Serviço em queda: {movementForecast.focusServiceLabel}
                </span>
              ) : null}
            </div>
          </article>

          <article className="simple-row">
            <h3>Próximas ações sugeridas</h3>
            <ul style={{ margin: "8px 0 0", paddingLeft: 18 }}>
              {movementForecast.suggestions.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <div className="simple-row__actions" style={{ flexWrap: "wrap" }}>
              <Link href="/dashboard/benefits/promotions?compose=1" className="secondary-button">
                Criar promoção
              </Link>
              <Link href="/dashboard/ai" className="secondary-button">
                Pedir sugestão ao assistente
              </Link>
            </div>
          </article>
        </div>
      ) : (
        <EmptyStateCard
          eyebrow="Sem previsão ainda"
          title="Ainda não há histórico para prever o movimento"
          description="Assim que houver mais atendimentos concluídos, esta área passa a mostrar os dias mais fracos, os horários mais vazios e os serviços em queda."
        />
      )}
    </article>
  );
}
