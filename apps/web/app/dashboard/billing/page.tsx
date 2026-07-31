import Link from "next/link";
import { redirect } from "next/navigation";

import {
  startStripeBillingPortalAction,
  startStripeCheckoutAction,
} from "@/app/actions";
import { EmptyStateCard } from "@/components/EmptyStateCard";
import { FlashMessage } from "@/components/FlashMessage";
import { requireOwnerSalon } from "@/lib/auth";
import {
  BILLING_DISABLED,
  PUBLIC_BILLING_PATH,
  formatBillingPrice,
  formatLimitLabel,
  getSalonBillingWorkspaceSnapshot,
  SINGLE_BILLING_PLAN_YEARLY_COMPARE_AT_PRICE,
  SINGLE_BILLING_PLAN_YEARLY_SAVINGS,
  type SalonBillingPlan,
} from "@/lib/billing";
import { measureServerRender } from "@/lib/serverPerformance";
import {
  getStripeBillingReadiness,
  getStripeOperationalStatus,
} from "@/lib/stripeBilling";

import styles from "./page.module.css";

export const dynamic = "force-dynamic";

type BillingPageProps = {
  searchParams?: Promise<{
    message?: string;
    tone?: string;
    interval?: string;
  }>;
};

function getModeLabel(mode: "test" | "live" | "mixed" | "unknown") {
  switch (mode) {
    case "live":
      return "Cobrança pronta";
    case "test":
      return "Em preparação";
    case "mixed":
      return "Revisão necessária";
    default:
      return "Configuração pendente";
  }
}

function getEnvironmentHeadline(args: {
  billingDisabled: boolean;
  configured: boolean;
  liveReady: boolean;
  mode: "test" | "live" | "mixed" | "unknown";
}) {
  if (!args.configured) {
    return "Cobrança ainda em preparação";
  }

  if (args.billingDisabled && args.mode === "live") {
    return "Última liberação pendente";
  }

  if (args.billingDisabled && args.mode === "test") {
    return "Cobrança em preparação";
  }

  if (args.mode === "mixed") {
    return "Revise a cobrança antes de liberar";
  }

  if (args.liveReady) {
    return "Cobrança pronta para ativar";
  }

  return "Falta concluir a cobrança";
}

function getEnvironmentDescription(args: {
  billingDisabled: boolean;
  configured: boolean;
  liveReady: boolean;
  mode: "test" | "live" | "mixed" | "unknown";
}) {
  if (!args.configured) {
    return "Ainda faltam os dados principais da cobrança para liberar os pagamentos do painel.";
  }

  if (args.billingDisabled && args.mode === "live") {
    return "Quase tudo já está pronto. Falta apenas a liberação final para a cobrança começar a valer no painel.";
  }

  if (args.billingDisabled && args.mode === "test") {
    return "A assinatura já aparece por aqui, mas os pagamentos reais ainda não foram liberados.";
  }

  if (args.liveReady) {
    return "A assinatura já pode ser ativada, renovada e atualizada automaticamente.";
  }

  return "A cobrança já foi conectada, mas ainda precisa de alguns ajustes antes da liberação.";
}

function formatBillingIssueForOwner(issue: string) {
  const normalized = issue.trim().toLowerCase();

  if (!normalized) {
    return "Ainda falta revisar uma etapa da cobrança.";
  }

  if (normalized.includes("stripe_secret_key")) {
    return "Falta ligar a chave principal da cobrança.";
  }

  if (normalized.includes("stripe_webhook_secret")) {
    return "Falta ativar a atualização automática da assinatura.";
  }

  if (normalized.includes("stripe_price_") || normalized.includes("price")) {
    return "Ainda falta cadastrar ou revisar o valor da assinatura.";
  }

  if (normalized.includes("customer portal")) {
    return "A área onde o salão gerencia a assinatura ainda não foi liberada.";
  }

  if (normalized.includes("webhook")) {
    return "A atualização automática da assinatura ainda não está ativa.";
  }

  if (normalized.includes("modo de teste")) {
    return "A cobrança ainda está em preparação e não está recebendo pagamentos reais.";
  }

  if (normalized.includes("misturam itens de teste e produção")) {
    return "Os dados da assinatura precisam ser revisados antes da liberação.";
  }

  if (normalized.includes("ativação final do billing")) {
    return "A cobrança já está pronta, mas a liberação final ainda não foi ligada.";
  }

  if (normalized.includes("não foi possível validar")) {
    return "Não deu para confirmar uma etapa da cobrança agora. Vale revisar novamente.";
  }

  return "Ainda falta concluir uma etapa para liberar a cobrança.";
}

function buildPlanHighlights(plan: SalonBillingPlan) {
  const items = [
    ...(plan.trialDays > 0 ? [`${plan.trialDays} dias grátis na 1ª assinatura`] : []),
    plan.maxStaffMembers === null
      ? "Equipe ilimitada"
      : `${formatLimitLabel(
          plan.maxStaffMembers,
          "profissional",
          "profissionais",
        )} ativos`,
    plan.maxServices === null
      ? "Catálogo ilimitado"
      : `${formatLimitLabel(
          plan.maxServices,
          "serviço",
          "serviços",
        )} no catálogo`,
    plan.maxMonthlyNotifications === null
      ? "Push ilimitado"
      : `${formatLimitLabel(
          plan.maxMonthlyNotifications,
          "notificação",
          "notificações",
        )} por mês`,
  ];

  if (plan.includesGrowthAutomation) {
    items.push("Automação de crescimento");
  }

  if (plan.includesFeedVideo) {
    items.push("Vídeo no feed do app");
  }

  if (plan.includesPrioritySupport) {
    items.push("Suporte prioritário");
  }

  return items;
}

function getSinglePlanActionLabel(
  plan: SalonBillingPlan,
  billingInterval: "monthly" | "yearly",
) {
  if (plan.trialDays > 0 && billingInterval === "monthly") {
    return `Começar com ${plan.trialDays} dias grátis`;
  }

  if (billingInterval === "yearly") {
    return `Ativar anual por ${formatBillingPrice(plan.yearlyPrice, plan.currencyCode)}`;
  }

  return `Ativar mensal por ${formatBillingPrice(plan.monthlyPrice, plan.currencyCode)}`;
}

function hasSignedSystem(
  snapshot: Awaited<ReturnType<typeof getSalonBillingWorkspaceSnapshot>>,
) {
  return (
    Boolean(snapshot.subscription.activatedAt) ||
    Boolean(snapshot.subscription.providerSubscriptionId) ||
    snapshot.subscription.status === "active" ||
    snapshot.subscription.status === "trialing"
  );
}

export default async function BillingPage({
  searchParams: searchParamsPromise,
}: BillingPageProps) {
  return measureServerRender("dashboard.billing", async () => {
    const [searchParams, ownerContext, operationalStatus] = await Promise.all([
      searchParamsPromise,
      requireOwnerSalon({ allowLocked: true }),
      getStripeOperationalStatus(),
    ]);
    const { salon } = ownerContext;
    const billingSnapshot = await getSalonBillingWorkspaceSnapshot(salon.id);

    if (billingSnapshot.isLocked) {
      redirect(PUBLIC_BILLING_PATH);
    }

    const readiness = getStripeBillingReadiness();
    const billingEnabled = !BILLING_DISABLED;
    const checkoutEnabled = billingEnabled && operationalStatus.liveReady;
    const portalEnabled =
      billingEnabled &&
      operationalStatus.portalConfigured &&
      billingSnapshot.subscription.paymentProvider === "stripe" &&
      Boolean(billingSnapshot.subscription.providerCustomerId);
    const portalManagedSubscription =
      portalEnabled &&
      Boolean(billingSnapshot.subscription.providerSubscriptionId);
    const signedSystem = hasSignedSystem(billingSnapshot);
    const selectedInterval =
      searchParams?.interval === "yearly" ? "yearly" : "monthly";
    const issues = [
      ...(!billingEnabled && readiness.configured && operationalStatus.mode === "live"
        ? ["A ativação final do billing ainda não foi ligada neste ambiente."]
        : []),
      ...(operationalStatus.issues.length > 0
        ? operationalStatus.issues
        : readiness.missing.map((item) => `Missing ${item}.`)),
    ]
      .map(formatBillingIssueForOwner)
      .filter((value, index, array) => array.indexOf(value) === index);

    const currentPlan = billingSnapshot.plans[0] ?? billingSnapshot.currentPlan ?? null;
    const currentPlanName = billingSnapshot.currentPlan?.displayName ?? "Plano do sistema";
    const currentCycleLabel =
      billingSnapshot.subscription.billingInterval === "yearly"
        ? "Anual"
        : "Mensal";
    const managementLabel = portalEnabled
      ? "Portal liberado"
      : checkoutEnabled
        ? "Pronta para liberar"
        : "Em preparação";

    return (
      <div className={`page-grid ${styles.page}`}>
        {searchParams?.message ? (
          <FlashMessage message={searchParams.message} tone={searchParams.tone} />
        ) : null}

        <section className={styles.surface}>
          <header className={styles.header}>
            <div className={styles.headerCopy}>
              <span className={styles.eyebrow}>Assinatura do sistema</span>
              <h1>
                {signedSystem
                  ? "Sistema assinado e em operação."
                  : "Assinatura do sistema pendente."}
              </h1>
              <p>
                {signedSystem
                  ? "Esta área gerencia apenas a assinatura do painel do salão. As clientes não compram nada aqui."
                  : "Esta cobrança libera o painel do salão. Não é uma compra para a cliente final."}
              </p>
            </div>

            <div className={styles.headerBadges}>
              <span className={styles.badge}>{billingSnapshot.statusLabel}</span>
              <span className={styles.badge}>{getModeLabel(operationalStatus.mode)}</span>
            </div>
          </header>

          <div className={styles.layout}>
            <section className={styles.summaryPanel}>
              <article className={styles.calloutCard}>
                <span className={styles.cardEyebrow}>Cobrança do sistema</span>
                <strong>
                  {signedSystem
                    ? "Assinatura operacional ativa"
                    : "Ativação operacional necessária"}
                </strong>
                <p>
                  {signedSystem
                    ? "O painel já está coberto pela assinatura do sistema. Use esta tela para acompanhar renovação, status e gestão comercial."
                    : "O salão ainda precisa ativar a assinatura do sistema para liberar a operação completa do painel."}
                </p>
              </article>

              <div className={styles.metricGrid}>
                <article className={styles.metricCard}>
                  <span>Status</span>
                  <strong>{billingSnapshot.statusLabel}</strong>
                  <p>{billingSnapshot.statusDetail}</p>
                </article>

                <article className={styles.metricCard}>
                  <span>Recorrência</span>
                  <strong>{currentCycleLabel}</strong>
                  <p>Plano do sistema: R$ 89 por mês ou R$ 890 no anual.</p>
                </article>

                <article className={styles.metricCard}>
                  <span>Próxima cobrança</span>
                  <strong>{billingSnapshot.nextBillingDateLabel ?? "Em definição"}</strong>
                  <p>
                    {billingSnapshot.subscription.status === "trialing"
                      ? "Fim do trial ou primeira cobrança"
                      : "Renovação da assinatura do painel"}
                  </p>
                </article>

                <article className={styles.metricCard}>
                  <span>Gestão da assinatura</span>
                  <strong>{managementLabel}</strong>
                  <p>
                    {portalEnabled
                      ? "Cartão, renovação e ciclo já podem ser gerenciados pelo portal."
                      : getEnvironmentDescription({
                          billingDisabled: BILLING_DISABLED,
                          configured: readiness.configured,
                          liveReady: operationalStatus.liveReady,
                          mode: operationalStatus.mode,
                        })}
                  </p>
                </article>
              </div>

              {issues.length ? (
                <div className={styles.issueList}>
                  {issues.map((issue) => (
                    <article key={issue} className={styles.issueItem}>
                      <strong>{issue}</strong>
                    </article>
                  ))}
                </div>
              ) : null}
            </section>

            <section className={styles.managementPanel}>
              {signedSystem ? (
                <article className={styles.subscriptionCard}>
                  <span className={styles.cardEyebrow}>Sistema assinado</span>
                  <h2>{currentPlanName}</h2>
                  <p>
                    O sistema de {salon.name} já está assinado. Esta tela existe para
                    acompanhamento e ajustes da assinatura. Não é uma venda dentro do
                    próprio painel.
                  </p>

                  <div className={styles.detailList}>
                    <div>
                      <span>Plano atual</span>
                      <strong>{currentPlanName}</strong>
                    </div>
                    <div>
                      <span>Recorrência atual</span>
                      <strong>{currentCycleLabel}</strong>
                    </div>
                    <div>
                      <span>Próxima cobrança</span>
                      <strong>{billingSnapshot.nextBillingDateLabel ?? "Em definição"}</strong>
                    </div>
                    <div>
                      <span>Gestão da assinatura</span>
                      <strong>{managementLabel}</strong>
                    </div>
                  </div>

                  {currentPlan ? (
                    <div className={styles.includedList}>
                      {buildPlanHighlights(currentPlan).slice(0, 4).map((item) => (
                        <span key={item}>{item}</span>
                      ))}
                    </div>
                  ) : null}

                  <div className={styles.actionStack}>
                    {portalEnabled ? (
                      <form action={startStripeBillingPortalAction}>
                        <button type="submit" className={styles.primaryButton}>
                          Gerenciar assinatura
                        </button>
                      </form>
                    ) : (
                      <div className={styles.portalNotice}>
                        <strong>
                          {getEnvironmentHeadline({
                            billingDisabled: BILLING_DISABLED,
                            configured: readiness.configured,
                            liveReady: operationalStatus.liveReady,
                            mode: operationalStatus.mode,
                          })}
                        </strong>
                        <span>
                          Assim que o portal estiver pronto, os ajustes de cartão,
                          renovação e ciclo passam a ser feitos aqui.
                        </span>
                      </div>
                    )}

                    <Link href="/dashboard/subscriptions" className={styles.secondaryButton}>
                      Abrir planos vendidos pelo salão
                    </Link>
                  </div>

                  {portalManagedSubscription ? (
                    <p className={styles.footnote}>
                      Toda troca posterior de cartão, renovação ou regularização segue
                      pela área da assinatura.
                    </p>
                  ) : null}
                </article>
              ) : currentPlan ? (
                <article className={styles.subscriptionCard}>
                  <span className={styles.cardEyebrow}>Ativação do sistema</span>
                  <h2>Escolha o ciclo da assinatura operacional</h2>
                  <p>
                    Esta cobrança libera o painel do salão. Não é uma compra para as
                    clientes e não aparece no aplicativo final.
                  </p>

                  <div className={styles.intervalSwitch}>
                    <Link
                      href="/dashboard/billing?interval=monthly"
                      className={`${styles.intervalOption} ${
                        selectedInterval === "monthly" ? styles.intervalOptionActive : ""
                      }`}
                    >
                      <strong>Mensal</strong>
                      <span>Cobrança mensal</span>
                    </Link>
                    <Link
                      href="/dashboard/billing?interval=yearly"
                      className={`${styles.intervalOption} ${
                        selectedInterval === "yearly" ? styles.intervalOptionActive : ""
                      }`}
                    >
                      <strong>Anual</strong>
                      <span>Economia no ciclo</span>
                    </Link>
                  </div>

                  <div className={styles.activationGrid}>
                    <article
                      className={`${styles.choiceCard} ${
                        selectedInterval === "monthly" ? styles.choiceCardActive : ""
                      }`}
                    >
                      <span className={styles.choiceLabel}>Mensal</span>
                      <strong>
                        {formatBillingPrice(
                          currentPlan.monthlyPrice,
                          currentPlan.currencyCode,
                        )}
                      </strong>
                      <p>
                        {currentPlan.trialDays > 0
                          ? "1ª cobrança após o teste grátis"
                          : "Cobrança mensal do sistema"}
                      </p>
                      <form action={startStripeCheckoutAction}>
                        <input type="hidden" name="billingInterval" value="monthly" />
                        <button
                          type="submit"
                          className={styles.primaryButton}
                          disabled={!checkoutEnabled}
                        >
                          {getSinglePlanActionLabel(currentPlan, "monthly")}
                        </button>
                      </form>
                    </article>

                    <article
                      className={`${styles.choiceCard} ${
                        selectedInterval === "yearly" ? styles.choiceCardActive : ""
                      }`}
                    >
                      <span className={styles.choiceLabel}>Anual</span>
                      <strong>
                        {formatBillingPrice(
                          currentPlan.yearlyPrice,
                          currentPlan.currencyCode,
                        )}
                      </strong>
                      <p>
                        de{" "}
                        <s>
                          {formatBillingPrice(
                            SINGLE_BILLING_PLAN_YEARLY_COMPARE_AT_PRICE,
                            currentPlan.currencyCode,
                          )}
                        </s>{" "}
                        por ano
                      </p>
                      <p className={styles.savingsText}>
                        economia de{" "}
                        {formatBillingPrice(
                          SINGLE_BILLING_PLAN_YEARLY_SAVINGS,
                          currentPlan.currencyCode,
                        )}{" "}
                        no ano
                      </p>
                      <form action={startStripeCheckoutAction}>
                        <input type="hidden" name="billingInterval" value="yearly" />
                        <button
                          type="submit"
                          className={styles.secondaryButton}
                          disabled={!checkoutEnabled}
                        >
                          {getSinglePlanActionLabel(currentPlan, "yearly")}
                        </button>
                      </form>
                    </article>
                  </div>
                </article>
              ) : (
                <EmptyStateCard
                  eyebrow="Plano indisponível"
                  title="Ainda não há um plano carregado nesta área"
                  description="Revise a configuração comercial para exibir a assinatura ativa do painel."
                />
              )}
            </section>
          </div>
        </section>
      </div>
    );
  });
}
