import type { CSSProperties } from "react";
import Link from "next/link";

import styles from "./page.module.css";
import {
  AsyncActionForm,
  AsyncActionNoticeRegion,
} from "@/components/AsyncActionForm";
import { DashboardIdentityAvatar } from "@/components/DashboardIdentityAvatar";
import {
  createManagementProfessionalAction,
  deleteManagementProfessionalAction,
  updateManagementProfessionalAction,
} from "@/app/_actions/management";
import { requireOwnerSalon } from "@/lib/auth";
import { formatCurrency } from "@/lib/formatters";
import {
  buildFilterHref,
  loadManagementProfessionals,
  loadManagementServiceAssignmentOptions,
} from "@/lib/management";
import { MANAGEMENT_ROUTES } from "@/lib/management-navigation";

type ManagementProfessional = Awaited<
  ReturnType<typeof loadManagementProfessionals>
>[number];
type ManagementServiceAssignment = Awaited<
  ReturnType<typeof loadManagementServiceAssignmentOptions>
>[number];

type ProfissionaisPageProps = {
  searchParams?: Promise<{
    q?: string;
    composer?: string;
    showHistory?: string;
    message?: string;
    tone?: string;
  }>;
};

type TeamBenchmarks = {
  maxSold: number;
  maxCompleted: number;
  maxUpcoming: number;
  maxServices: number;
  maxCommission: number;
};

type PerformanceSnapshot = {
  progress: number;
  label: string;
  tone: "rise" | "steady" | "build";
  soldShare: number;
  commissionShare: number;
  agendaShare: number;
};

function professionalInitials(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean);

  if (!parts.length) {
    return "EQ";
  }

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return `${parts[0][0] ?? "E"}${parts[parts.length - 1][0] ?? "Q"}`.toUpperCase();
}

function clampPercentage(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function roundReviewStars(value: number | null | undefined) {
  if (!value) {
    return 0;
  }

  return Math.max(0, Math.min(5, Math.round(value)));
}

function formatReviewCount(count: number) {
  return count === 1
    ? "1 avaliação real do app"
    : `${count} avaliações reais do app`;
}

function formatCompactPhone(value?: string | null) {
  if (!value) {
    return "Contato principal não informado";
  }

  return value;
}

function deriveBenchmarks(
  professionals: ManagementProfessional[],
): TeamBenchmarks {
  return professionals.reduce<TeamBenchmarks>(
    (current, professional) => ({
      maxSold: Math.max(current.maxSold, professional.totalSold),
      maxCompleted: Math.max(current.maxCompleted, professional.completedCount),
      maxUpcoming: Math.max(current.maxUpcoming, professional.upcomingCount),
      maxServices: Math.max(
        current.maxServices,
        professional.assignedServiceIds.length,
      ),
      maxCommission: Math.max(
        current.maxCommission,
        professional.commissionProjected,
      ),
    }),
    {
      maxSold: 0,
      maxCompleted: 0,
      maxUpcoming: 0,
      maxServices: 0,
      maxCommission: 0,
    },
  );
}

function derivePerformance(
  professional: ManagementProfessional,
  benchmarks: TeamBenchmarks,
): PerformanceSnapshot {
  const soldShare = benchmarks.maxSold
    ? professional.totalSold / benchmarks.maxSold
    : 0;
  const completedShare = benchmarks.maxCompleted
    ? professional.completedCount / benchmarks.maxCompleted
    : 0;
  const agendaShare = benchmarks.maxUpcoming
    ? professional.upcomingCount / benchmarks.maxUpcoming
    : 0;
  const serviceShare = benchmarks.maxServices
    ? professional.assignedServiceIds.length / benchmarks.maxServices
    : 0;
  const commissionShare = benchmarks.maxCommission
    ? professional.commissionProjected / benchmarks.maxCommission
    : 0;

  const index =
    soldShare * 0.36 +
    completedShare * 0.24 +
    agendaShare * 0.18 +
    serviceShare * 0.1 +
    commissionShare * 0.12;
  const progress = clampPercentage(index * 100);

  if (progress >= 84) {
    return {
      progress,
      label: "Meta atingida",
      tone: "rise",
      soldShare: clampPercentage(soldShare * 100),
      commissionShare: clampPercentage(commissionShare * 100),
      agendaShare: clampPercentage(agendaShare * 100),
    };
  }

  if (progress >= 52) {
    return {
      progress,
      label: "Ritmo consistente",
      tone: "steady",
      soldShare: clampPercentage(soldShare * 100),
      commissionShare: clampPercentage(commissionShare * 100),
      agendaShare: clampPercentage(agendaShare * 100),
    };
  }

  return {
    progress,
    label: professional.completedCount
      ? "Base em construção"
      : "Nova na carteira",
    tone: "build",
    soldShare: clampPercentage(soldShare * 100),
    commissionShare: clampPercentage(commissionShare * 100),
    agendaShare: clampPercentage(agendaShare * 100),
  };
}

function TeamGlyph({
  name,
}: {
  name: "search" | "plus" | "calendar" | "spark" | "trend" | "dots";
}) {
  switch (name) {
    case "search":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M10.5 4.75a5.75 5.75 0 1 1 0 11.5a5.75 5.75 0 0 1 0-11.5Zm0 1.5a4.25 4.25 0 1 0 0 8.5a4.25 4.25 0 0 0 0-8.5Zm6.53 9.72a.75.75 0 0 1 1.06 0l2.16 2.16a.75.75 0 0 1-1.06 1.06l-2.16-2.16a.75.75 0 0 1 0-1.06Z"
            fill="currentColor"
          />
        </svg>
      );
    case "calendar":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M7 3.75a.75.75 0 0 1 .75.75V6h8.5V4.5a.75.75 0 0 1 1.5 0V6h.25A2.75 2.75 0 0 1 20.75 8.75v9.5A2.75 2.75 0 0 1 18 21H6a2.75 2.75 0 0 1-2.75-2.75v-9.5A2.75 2.75 0 0 1 6 6h.25V4.5A.75.75 0 0 1 7 3.75ZM18 11.5H6v6.75c0 .69.56 1.25 1.25 1.25h9.5c.69 0 1.25-.56 1.25-1.25V11.5Z"
            fill="currentColor"
          />
        </svg>
      );
    case "spark":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M11.23 4.54c.28-1.06 1.8-1.06 2.08 0l.46 1.74a1.5 1.5 0 0 0 1.06 1.06l1.74.46c1.06.28 1.06 1.8 0 2.08l-1.74.46a1.5 1.5 0 0 0-1.06 1.06l-.46 1.74c-.28 1.06-1.8 1.06-2.08 0l-.46-1.74a1.5 1.5 0 0 0-1.06-1.06l-1.74-.46c-1.06-.28-1.06-1.8 0-2.08l1.74-.46a1.5 1.5 0 0 0 1.06-1.06l.46-1.74Z"
            fill="currentColor"
          />
        </svg>
      );
    case "trend":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M5 4.25a.75.75 0 0 1 .75.75v13.25H19a.75.75 0 0 1 0 1.5H5A.75.75 0 0 1 4.25 19V5A.75.75 0 0 1 5 4.25Zm2.78 9.03a.75.75 0 0 1 0-1.06l2.44-2.44a.75.75 0 0 1 1.06 0l1.47 1.47l3.97-3.97a.75.75 0 0 1 1.06 1.06l-4.5 4.5a.75.75 0 0 1-1.06 0L10.75 11.4l-1.91 1.91a.75.75 0 0 1-1.06 0Z"
            fill="currentColor"
          />
        </svg>
      );
    case "dots":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M6.75 12a1.25 1.25 0 1 1-2.5 0a1.25 1.25 0 0 1 2.5 0Zm6.5 0a1.25 1.25 0 1 1-2.5 0a1.25 1.25 0 0 1 2.5 0Zm5.25 1.25a1.25 1.25 0 1 0 0-2.5a1.25 1.25 0 0 0 0 2.5Z"
            fill="currentColor"
          />
        </svg>
      );
    case "plus":
    default:
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M12 4.25a.75.75 0 0 1 .75.75v6.25H19a.75.75 0 0 1 0 1.5h-6.25V19a.75.75 0 0 1-1.5 0v-6.25H5a.75.75 0 0 1 0-1.5h6.25V5a.75.75 0 0 1 .75-.75Z"
            fill="currentColor"
          />
        </svg>
      );
  }
}

function StarRow({ label, rating }: { label?: string; rating: number }) {
  return (
    <div
      className={styles.starRow}
      aria-label={label ?? `${rating} de 5 estrelas`}
    >
      {Array.from({ length: 5 }).map((_, index) => (
        <span
          key={index}
          className={`${styles.star} ${index < rating ? styles.starActive : ""}`}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M12 3.75l2.52 5.11 5.64.82-4.08 3.98.96 5.62L12 16.63 6.96 19.28l.96-5.62-4.08-3.98 5.64-.82L12 3.75Z"
              fill="currentColor"
            />
          </svg>
        </span>
      ))}
    </div>
  );
}

function ProfessionalReview({
  professional,
}: {
  professional: ManagementProfessional;
}) {
  if (!professional.reviewCount || professional.reviewAverage === null) {
    return (
      <div className={styles.reviewStack}>
        <div className={`${styles.ratingRow} ${styles.ratingRowMuted}`}>
          <TeamGlyph name="spark" />
          <span>Sem avaliações no app</span>
        </div>
        <small className={styles.reviewMetaMuted}>
          Assim que a cliente avaliar no app, a media real aparece aqui.
        </small>
      </div>
    );
  }

  const roundedStars = roundReviewStars(professional.reviewAverage);
  const reviewLabel = `${professional.reviewAverage.toFixed(1)} no app`;

  return (
    <div className={styles.reviewStack}>
      <div className={styles.ratingRow}>
        <StarRow
          label={`${professional.reviewAverage.toFixed(1)} de 5 estrelas com ${professional.reviewCount} avaliações reais do app`}
          rating={roundedStars}
        />
        <span className={styles.reviewScore}>{reviewLabel}</span>
      </div>
      <small className={styles.reviewMeta}>
        {formatReviewCount(professional.reviewCount)}
      </small>
    </div>
  );
}

function Avatar({
  professional,
  large = false,
}: {
  professional: ManagementProfessional;
  large?: boolean;
}) {
  const avatarShellClassName = `${styles.avatarShell} ${large ? styles.avatarShellLarge : ""}`;

  return (
    <div className={avatarShellClassName}>
      <DashboardIdentityAvatar
        imageUrl={professional.imageUrl}
        alt={`Foto de ${professional.name}`}
        fallbackText={professionalInitials(professional.name)}
        className={styles.avatarFrame}
        imageClassName={styles.avatarImage}
        fallbackClassName={styles.avatarFallback}
      />
      {professional.is_active ? <span className={styles.avatarStatus} /> : null}
    </div>
  );
}

function ServiceToggleGroup({
  services,
  selectedServiceIds,
}: {
  services: ManagementServiceAssignment[];
  selectedServiceIds: string[];
}) {
  if (!services.length) {
    return (
      <div className={styles.field}>
        <label>Serviços habilitados</label>
        <p className={styles.fieldHint}>
          Cadastre pelo menos um serviço antes de vincular a agenda desse
          profissional.
        </p>
      </div>
    );
  }

  const selectedIds = new Set(selectedServiceIds);

  return (
    <fieldset className={styles.fieldset}>
      <legend>Serviços habilitados</legend>
      <p className={styles.fieldHint}>
        Os serviços selecionados aparecem para esse profissional no app do
        cliente e nas reservas do salão.
      </p>
      <div className={styles.serviceChipGrid}>
        {services.map((service) => (
          <label key={service.id} className={styles.serviceChip}>
            <input
              type="checkbox"
              name="serviceIds"
              value={service.id}
              defaultChecked={selectedIds.has(service.id)}
            />
            <span className={styles.serviceChipBody}>
              <strong>{service.name}</strong>
              <small>{service.isActive ? "Disponível" : "Pausado"}</small>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function ProfessionalEditor({
  professional,
  currentPath,
  services,
}: {
  professional: ManagementProfessional;
  currentPath: string;
  services: ManagementServiceAssignment[];
}) {
  return (
    <div className={styles.editorPanel}>
      <AsyncActionForm
        action={updateManagementProfessionalAction}
        className={styles.editorForm}
        encType="multipart/form-data"
      >
        <input type="hidden" name="returnPath" value={currentPath} />
        <input type="hidden" name="professionalId" value={professional.id} />
        <input type="hidden" name="serviceSelectionReady" value="1" />

        <div className={styles.editorGrid}>
          <div className={styles.field}>
            <label htmlFor={`professional-name-${professional.id}`}>Nome</label>
            <input
              id={`professional-name-${professional.id}`}
              name="name"
              defaultValue={professional.name}
              required
            />
          </div>

          <div className={styles.field}>
            <label htmlFor={`professional-specialty-${professional.id}`}>
              Especialidade
            </label>
            <input
              id={`professional-specialty-${professional.id}`}
              name="specialty"
              defaultValue={professional.role ?? ""}
            />
          </div>

          <div className={styles.field}>
            <label htmlFor={`professional-phone-${professional.id}`}>
              Telefone
            </label>
            <input
              id={`professional-phone-${professional.id}`}
              name="phone"
              defaultValue={professional.phone ?? ""}
            />
          </div>

          <div className={styles.field}>
            <label htmlFor={`professional-commission-${professional.id}`}>
              Comissão (%)
            </label>
            <input
              id={`professional-commission-${professional.id}`}
              name="commissionRatePercent"
              type="number"
              min="0"
              max="100"
              step="0.1"
              defaultValue={Number(professional.commission_rate_percent ?? 0)}
              required
            />
          </div>
        </div>

        <div className={styles.supportGrid}>
          <label className={styles.toggleField}>
            <input
              type="checkbox"
              name="isActive"
              defaultChecked={professional.is_active}
            />
            <span className={styles.toggleControl} aria-hidden="true" />
            <span className={styles.toggleCopy}>
              <strong>Profissional ativo</strong>
              <small>
                Quando ativo, aparece na agenda e pode receber novos horários.
              </small>
            </span>
          </label>

          <div className={styles.field}>
            <label htmlFor={`professional-image-${professional.id}`}>
              Foto do profissional
            </label>
            <input
              id={`professional-image-${professional.id}`}
              name="image"
              type="file"
              accept="image/png,image/jpeg,image/webp"
            />
            <p className={styles.fieldHint}>
              A foto aparece no app do cliente quando a cliente escolhe a
              profissional.
            </p>
          </div>
        </div>

        {professional.imageUrl ? (
          <label className={styles.toggleField}>
            <input type="checkbox" name="removeImage" />
            <span className={styles.toggleControl} aria-hidden="true" />
            <span className={styles.toggleCopy}>
              <strong>Remover foto atual</strong>
              <small>Troca por avatar com iniciais.</small>
            </span>
          </label>
        ) : null}

        <ServiceToggleGroup
          selectedServiceIds={professional.assignedServiceIds}
          services={services}
        />

        <div className={styles.editorActions}>
          <button type="submit" className={styles.primaryButton}>
            {professional.is_active ? "Salvar alterações" : "Salvar e reativar"}
          </button>
        </div>
      </AsyncActionForm>

      {professional.is_active ? (
        <AsyncActionForm action={deleteManagementProfessionalAction}>
          <input type="hidden" name="returnPath" value={currentPath} />
          <input type="hidden" name="professionalId" value={professional.id} />
          <p className={styles.editorNote}>
            Se ainda existir agenda futura, remaneje os horários antes de tirar
            esse profissional da equipe.
          </p>
          <button type="submit" className={styles.dangerButton}>
            Remover da equipe
          </button>
        </AsyncActionForm>
      ) : null}
    </div>
  );
}

function ProfessionalCard({
  professional,
  currentPath,
  services,
  benchmarks,
}: {
  professional: ManagementProfessional;
  currentPath: string;
  services: ManagementServiceAssignment[];
  benchmarks: TeamBenchmarks;
}) {
  const performance = derivePerformance(professional, benchmarks);
  const agendaHref = buildFilterHref(
    MANAGEMENT_ROUTES.appointments,
    undefined,
    { professionalId: professional.id },
  );
  const progressStyle = {
    width: `${performance.progress}%`,
  } satisfies CSSProperties;
  const performanceClassName = `${styles.performanceCard} ${
    performance.tone === "rise"
      ? styles.performanceRise
      : performance.tone === "steady"
        ? styles.performanceSteady
        : styles.performanceBuild
  }`;
  const renderPerformanceSnapshot = () => (
    <>
      <div className={styles.metricRow}>
        <article className={styles.metricCard}>
          <span>Vendidos no mês</span>
          <strong>{formatCurrency(professional.totalSold)}</strong>
        </article>
        <article className={styles.metricCard}>
          <span>Atendimentos no mês</span>
          <strong>{professional.completedCount}</strong>
        </article>
        <article className={styles.metricCard}>
          <span>Comissão</span>
          <strong>
            {Number(professional.commission_rate_percent ?? 0).toFixed(0)}%
          </strong>
        </article>
      </div>

      <section className={performanceClassName}>
        <div className={styles.performanceHeader}>
          <div>
            <span>Comissão do mês</span>
            <strong>{formatCurrency(professional.commissionProjected)}</strong>
          </div>
          <div className={styles.performanceHeaderBadge}>
            <TeamGlyph name="trend" />
            {performance.progress}%
          </div>
        </div>

        <div className={styles.progressTrack} aria-hidden="true">
          <span className={styles.progressValue} style={progressStyle} />
        </div>

        <div className={styles.performanceMeta}>
          <strong>{performance.label}</strong>
          <small>
            {professional.upcomingCount} próximo(s) e{" "}
            {professional.assignedServiceIds.length} serviço(s) habilitado(s)
          </small>
        </div>

        <div className={styles.sparkline} aria-hidden="true">
          <span style={{ width: `${performance.soldShare}%` }} />
          <span style={{ width: `${performance.commissionShare}%` }} />
          <span style={{ width: `${performance.agendaShare}%` }} />
        </div>
      </section>
    </>
  );

  return (
    <article
      className={`${styles.teamCard} ${!professional.is_active ? styles.teamCardMuted : ""}`}
    >
      <div className={styles.cardHead}>
        <Avatar professional={professional} />

        <div className={styles.cardIdentity}>
          <div className={styles.identityTopline}>
            <div>
              <h3>{professional.name}</h3>
              <p>{professional.role?.trim() || "Pronta para receber agenda"}</p>
            </div>
            <span
              className={`${styles.statusBadge} ${
                professional.is_active ? styles.statusLive : styles.statusPaused
              }`}
            >
              {professional.is_active ? "Online" : "Fora da equipe"}
            </span>
          </div>

          <ProfessionalReview professional={professional} />

          <p className={styles.identityMeta}>
            {formatCompactPhone(professional.phone)}
          </p>
        </div>
      </div>

      <div className={styles.teamSecondaryDesktop}>{renderPerformanceSnapshot()}</div>

      <details className={styles.teamMobileDetails}>
        <summary className={styles.teamMobileSummary}>Ver resultados do mês</summary>
        <div className={styles.teamMobileBody}>{renderPerformanceSnapshot()}</div>
      </details>

      <div className={styles.cardFooter}>
        <Link href={agendaHref} className={styles.sectionButton}>
          <span className={styles.buttonIcon}>
            <TeamGlyph name="calendar" />
          </span>
          Ver agenda
        </Link>

        <details className={styles.inlineDetails}>
          <summary className={styles.inlineSummary}>Editar</summary>
          <ProfessionalEditor
            professional={professional}
            currentPath={currentPath}
            services={services}
          />
        </details>
      </div>
    </article>
  );
}

export default async function ProfissionaisPage({
  searchParams: searchParamsPromise,
}: ProfissionaisPageProps) {
  const [searchParams, { salon }] = await Promise.all([
    searchParamsPromise,
    requireOwnerSalon(),
  ]);
  const query = searchParams?.q?.trim() ?? "";
  const showHistory = searchParams?.showHistory === "1";
  const isComposerOpen = searchParams?.composer === "1";

  const [professionals, services] = await Promise.all([
    loadManagementProfessionals({
      salonId: salon.id,
      timeZone: salon.timezone,
    }),
    loadManagementServiceAssignmentOptions(salon.id),
  ]);

  const filteredProfessionals = professionals.filter((professional) => {
    if (!query) {
      return true;
    }

    const haystack = [professional.name, professional.role, professional.phone]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return haystack.includes(query.toLowerCase());
  });
  const activeProfessionals = filteredProfessionals.filter(
    (professional) => professional.is_active,
  );
  const inactiveProfessionals = filteredProfessionals.filter(
    (professional) => !professional.is_active,
  );
  const activeProfessionalsAll = professionals.filter(
    (professional) => professional.is_active,
  );
  const inactiveProfessionalsAll = professionals.filter(
    (professional) => !professional.is_active,
  );
  const totalSold = professionals.reduce(
    (sum, professional) => sum + professional.totalSold,
    0,
  );
  const totalCompleted = professionals.reduce(
    (sum, professional) => sum + professional.completedCount,
    0,
  );
  const totalUpcoming = professionals.reduce(
    (sum, professional) => sum + professional.upcomingCount,
    0,
  );
  const benchmarks = deriveBenchmarks(activeProfessionalsAll);
  const currentPath = buildFilterHref(
    MANAGEMENT_ROUTES.professionals,
    searchParams,
    {},
  );
  const clearFiltersHref = buildFilterHref(
    MANAGEMENT_ROUTES.professionals,
    searchParams,
    { q: undefined },
  );
  const historyToggleHref = buildFilterHref(
    MANAGEMENT_ROUTES.professionals,
    searchParams,
    { showHistory: showHistory ? undefined : "1" },
  );
  const openComposerHref = `${buildFilterHref(
    MANAGEMENT_ROUTES.professionals,
    searchParams,
    { composer: "1" },
  )}#professional-create`;
  const closeComposerHref = buildFilterHref(
    MANAGEMENT_ROUTES.professionals,
    searchParams,
    { composer: undefined },
  );
  return (
    <AsyncActionNoticeRegion
      initialMessage={searchParams?.message}
      initialTone={searchParams?.tone}
    >
      <div className={styles.page}>
        <section className={styles.board}>
          <header className={styles.topbar}>
            <div className={styles.titleBlock}>
              <span className={styles.eyebrow}>Equipe</span>
              <h1>Profissionais</h1>
              <p>
                Cadastre, ative e acompanhe quem atende no salao sem excesso de tela.
              </p>
            </div>

            <form method="get" className={styles.toolbar}>
              {showHistory ? (
                <input type="hidden" name="showHistory" value="1" />
              ) : null}
              {isComposerOpen ? (
                <input type="hidden" name="composer" value="1" />
              ) : null}

              <label className={styles.searchBox} htmlFor="team-search">
                <span className={styles.searchIcon}>
                  <TeamGlyph name="search" />
                </span>
                <input
                  id="team-search"
                  name="q"
                  defaultValue={query}
                  placeholder="Buscar por nome, especialidade ou telefone"
                />
              </label>

              <button type="submit" className={styles.toolbarButton}>
                Buscar
              </button>

              {query ? (
                <Link
                  href={clearFiltersHref}
                  className={styles.toolbarGhostButton}
                >
                  Limpar
                </Link>
              ) : null}

              {inactiveProfessionalsAll.length ? (
                <Link
                  href={historyToggleHref}
                  className={styles.toolbarGhostButton}
                >
                  {showHistory
                    ? "Ocultar histórico"
                    : `Histórico (${inactiveProfessionalsAll.length})`}
                </Link>
              ) : null}

              <Link
                href={isComposerOpen ? closeComposerHref : openComposerHref}
                className={styles.primaryButton}
              >
                <span className={styles.buttonIcon}>
                  <TeamGlyph name="plus" />
                </span>
                {isComposerOpen ? "Fechar cadastro" : "Novo profissional"}
              </Link>
            </form>
          </header>

          <div className={styles.statsRow}>
            <article className={styles.statCard}>
              <span className={styles.statLabel}>Profissionais ativos</span>
              <strong>{activeProfessionalsAll.length}</strong>
              <small>{professionals.length} pessoa(s) cadastrada(s)</small>
            </article>
            <article className={styles.statCard}>
              <span className={styles.statLabel}>Agenda futura</span>
              <strong>{totalUpcoming}</strong>
              <small>{filteredProfessionals.length} profissional(is) no filtro atual</small>
            </article>
            <article className={styles.statCard}>
              <span className={styles.statLabel}>Vendas do mes</span>
              <strong>{formatCurrency(totalSold)}</strong>
              <small>{totalCompleted} atendimento(s) concluidos</small>
            </article>
          </div>

          {isComposerOpen ? (
            <section id="professional-create" className={styles.composer}>
              <div className={styles.composerHeader}>
                <div>
                  <span className={styles.eyebrow}>New team member</span>
                  <h2>Novo profissional</h2>
                  <p>
                    Cadastro leve com foto, comissão e serviços liberados para a
                    agenda.
                  </p>
                </div>

                <Link
                  href={closeComposerHref}
                  className={styles.toolbarGhostButton}
                >
                  Fechar
                </Link>
              </div>

              <AsyncActionForm
                action={createManagementProfessionalAction}
                className={styles.composerForm}
                encType="multipart/form-data"
                resetOnSuccess
              >
                <input
                  type="hidden"
                  name="returnPath"
                  value={closeComposerHref}
                />
                <input type="hidden" name="serviceSelectionReady" value="1" />

                <div className={styles.editorGrid}>
                  <div className={styles.field}>
                    <label htmlFor="professional-name">Nome</label>
                    <input id="professional-name" name="name" required />
                  </div>

                  <div className={styles.field}>
                    <label htmlFor="professional-specialty">
                      Especialidade
                    </label>
                    <input
                      id="professional-specialty"
                      name="specialty"
                      placeholder="Ex.: especialista em trança"
                    />
                  </div>

                  <div className={styles.field}>
                    <label htmlFor="professional-phone">Telefone</label>
                    <input
                      id="professional-phone"
                      name="phone"
                      placeholder="(11) 99999-0000"
                    />
                  </div>

                  <div className={styles.field}>
                    <label htmlFor="professional-commission">
                      Comissão (%)
                    </label>
                    <input
                      id="professional-commission"
                      name="commissionRatePercent"
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      defaultValue="30"
                      required
                    />
                  </div>
                </div>

                <div className={styles.supportGrid}>
                  <label className={styles.toggleField}>
                    <input type="checkbox" name="isActive" defaultChecked />
                    <span className={styles.toggleControl} aria-hidden="true" />
                    <span className={styles.toggleCopy}>
                      <strong>Profissional ativo</strong>
                      <small>
                        Entra direto na agenda e no fluxo de reservas.
                      </small>
                    </span>
                  </label>

                  <div className={styles.field}>
                    <label htmlFor="professional-image">
                      Foto do profissional
                    </label>
                    <input
                      id="professional-image"
                      name="image"
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                    />
                    <p className={styles.fieldHint}>
                      Opcional. A foto aparece para a cliente no momento da
                      escolha.
                    </p>
                  </div>
                </div>

                <ServiceToggleGroup
                  selectedServiceIds={[]}
                  services={services}
                />

                <div className={styles.editorActions}>
                  <button type="submit" className={styles.primaryButton}>
                    Salvar profissional
                  </button>
                </div>
              </AsyncActionForm>
            </section>
          ) : null}

          <div className={styles.layout}>
            <div className={styles.catalogColumn}>
              <section className={styles.catalogSection}>
                <div className={styles.sectionHeader}>
                  <div>
                    <span className={styles.sectionEyebrow}>Equipe</span>
                    <h2>Lista da equipe</h2>
                    <p>
                      {activeProfessionals.length
                        ? `${activeProfessionals.length} profissional(is) ativo(s) na busca atual`
                        : "Nenhum profissional ativo encontrado com esse filtro"}
                    </p>
                  </div>

                  <div className={styles.sectionFilters}>
                    <span className={styles.sectionPill}>
                      Base: {query ? "filtrada" : "completa"}
                    </span>
                    <span className={styles.sectionPill}>
                      Histórico: {showHistory ? "aberto" : "fechado"}
                    </span>
                  </div>
                </div>

                {activeProfessionals.length ? (
                  <div className={styles.teamGrid}>
                    {activeProfessionals.map((professional) => (
                      <ProfessionalCard
                        key={professional.id}
                        professional={professional}
                        currentPath={currentPath}
                        services={services}
                        benchmarks={benchmarks}
                      />
                    ))}
                  </div>
                ) : (
                  <div className={styles.emptyState}>
                    <span className={styles.emptyStateEyebrow}>
                      Equipe vazia
                    </span>
                    <h3>
                      {query
                        ? "A busca não encontrou profissionais"
                        : "Cadastre o primeiro profissional"}
                    </h3>
                    <p>
                      {query
                        ? "Ajuste o termo da busca ou limpe o filtro para voltar à lista completa."
                        : "A equipe precisa de pelo menos um profissional ativo para receber novos horários."}
                    </p>
                  </div>
                )}

                {inactiveProfessionalsAll.length && !showHistory ? (
                  <p className={styles.catalogNote}>
                    Quem saiu da equipe fica fora da lista principal para manter
                    a operação limpa. O histórico aparece só quando você pedir.
                  </p>
                ) : null}
              </section>

              {inactiveProfessionals.length && showHistory ? (
                <section className={styles.catalogSection}>
                  <div className={styles.sectionHeader}>
                    <div>
                      <span className={styles.sectionEyebrow}>
                        Historico
                      </span>
                      <h2>Histórico da equipe</h2>
                      <p>
                        {inactiveProfessionals.length} profissional(is) fora da
                        agenda ativa, com histórico preservado.
                      </p>
                    </div>
                  </div>

                  <div className={styles.teamGrid}>
                    {inactiveProfessionals.map((professional) => (
                      <ProfessionalCard
                        key={professional.id}
                        professional={professional}
                        currentPath={currentPath}
                        services={services}
                        benchmarks={benchmarks}
                      />
                    ))}
                  </div>
                </section>
              ) : null}
            </div>

          </div>
        </section>
      </div>
    </AsyncActionNoticeRegion>
  );
}


