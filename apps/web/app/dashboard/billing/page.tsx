import Link from "next/link";
import { redirect } from "next/navigation";

import {
  startStripeBillingPortalAction,
  startStripeCheckoutAction,
} from "@/app/actions";
import { DashboardWorkspaceHero } from "@/components/DashboardWorkspaceHero";
import { EmptyStateCard } from "@/components/EmptyStateCard";
import { FlashMessage } from "@/components/FlashMessage";
import {
  BILLING_DISABLED,
  PUBLIC_BILLING_PATH,
  formatBillingPrice,
  formatLimitLabel,
  getSalonBillingWorkspaceSnapshot,
  type SalonBillingPlan,
} from "@/lib/billing";
import { requireOwnerSalon } from "@/lib/auth";
import {
  getStripeBillingReadiness,
  getStripeOperationalStatus,
} from "@/lib/stripeBilling";
import { measureServerRender } from "@/lib/serverPerformance";

export const dynamic = "force-dynamic";

type BillingPageProps = {
  searchParams?: Promise<{
    message?: string;
    tone?: string;
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
    return "Os planos já aparecem por aqui, mas os pagamentos reais ainda não foram liberados.";
  }

  if (args.liveReady) {
    return "A assinatura do painel já pode ser ativada, renovada e atualizada automaticamente.";
  }

  return "A cobrança já foi conectada, mas ainda precisa de alguns ajustes antes de ser liberada.";
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
    return "Ainda faltam cadastrar ou revisar os valores dos planos.";
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
    return "Os valores da cobrança precisam ser revisados antes da liberação.";
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
    const planChangesManagedInPortal =
      portalEnabled &&
      Boolean(billingSnapshot.subscription.providerSubscriptionId);
    const issues = [
      ...(!billingEnabled && readiness.configured && operationalStatus.mode === "live"
        ? ["A ativação final do billing ainda não foi ligada neste ambiente."]
        : []),
      ...(operationalStatus.issues.length > 0
        ? operationalStatus.issues
        : readiness.missing.map((item) => `Missing ${item}.`)),
    ].map(formatBillingIssueForOwner).filter((value, index, array) => array.indexOf(value) === index);

    return (
      <div className="page-grid billing-page">
        {searchParams?.message ? (
          <FlashMessage
            message={searchParams.message}
            tone={searchParams.tone}
          />
        ) : null}

        <DashboardWorkspaceHero
          eyebrow="Assinatura do sistema"
          title={`${billingSnapshot.currentPlan.displayName} para ${salon.name}`}
          description="Organize a assinatura do painel sem misturar com os planos e pacotes que o salão vende para as clientes."
          highlight={{
            label: "Status atual",
            value: billingSnapshot.statusLabel,
            note: billingSnapshot.statusDetail,
          }}
          signals={[
            {
              label: "Cobrança",
              value: getModeLabel(operationalStatus.mode),
              tone: checkoutEnabled ? "success" : "warm",
            },
            {
              label: "Liberação",
              value: billingEnabled ? "Ativa" : "Em preparação",
              tone: billingEnabled ? "accent" : "soft",
            },
          ]}
          stats={[
            {
              label: "Ciclo do plano",
              value:
                billingSnapshot.subscription.billingInterval === "yearly"
                  ? "Anual"
                  : "Mensal",
              note: billingSnapshot.currentPlan.displayName,
              tone: "soft",
            },
            {
              label: "Próxima virada",
              value: billingSnapshot.nextBillingDateLabel ?? "Em definição",
              note:
                billingSnapshot.subscription.status === "trialing"
                  ? "Fim do trial ou primeira cobrança"
                  : billingSnapshot.isLocked
                    ? "Liberação do painel após a assinatura"
                    : "Renovação da assinatura",
              tone: billingSnapshot.isLocked ? "danger" : "accent",
            },
            {
              label: "Área da assinatura",
              value: portalEnabled
                ? "Liberada"
                : checkoutEnabled
                  ? "Pronta para liberar"
                  : "Em preparação",
              note: portalEnabled
                ? "O salão já consegue ajustar pagamento e renovação."
                : "Assim que a cobrança for liberada, o acesso aparece aqui.",
              tone: portalEnabled ? "success" : "soft",
            },
          ]}
          actions={
            <>
              {portalEnabled ? (
                <form action={startStripeBillingPortalAction}>
                  <button type="submit" className="primary-button">
                    Gerenciar assinatura
                  </button>
                </form>
              ) : null}

              {!billingSnapshot.isLocked ? (
                <Link href="/dashboard/subscriptions" className="secondary-button">
                  Ver planos do salão
                </Link>
              ) : null}
            </>
          }
          aside={
            <div className="billing-page__aside">
              <span className="eyebrow">Situação da cobrança</span>
              <h3>
                {getEnvironmentHeadline({
                  billingDisabled: BILLING_DISABLED,
                  configured: readiness.configured,
                  liveReady: operationalStatus.liveReady,
                  mode: operationalStatus.mode,
                })}
              </h3>
              <p>
                {getEnvironmentDescription({
                  billingDisabled: BILLING_DISABLED,
                  configured: readiness.configured,
                  liveReady: operationalStatus.liveReady,
                  mode: operationalStatus.mode,
                })}
              </p>
            </div>
          }
        />

        <section className="billing-page__status-grid">
          <article className="card metric-card metric-card--soft">
            <span className="eyebrow">Cadastro</span>
            <strong>{readiness.configured ? "Completo" : "Em ajuste"}</strong>
            <p>
              {readiness.configured
                ? "Os dados principais da cobrança já foram preenchidos."
                : "Ainda falta completar a base da cobrança para liberar os pagamentos."}
            </p>
          </article>

          <article className="card metric-card metric-card--accent">
            <span className="eyebrow">Atualização automática</span>
            <strong>
              {operationalStatus.webhookConfigured ? "Ativa" : "Pendente"}
            </strong>
            <p>
              {operationalStatus.webhookConfigured
                ? "A assinatura do painel já consegue atualizar acesso sozinha."
                : "Sem essa etapa, o pagamento não atualiza a assinatura automaticamente."}
            </p>
          </article>

          <article className="card metric-card metric-card--warm">
            <span className="eyebrow">Área da assinatura</span>
            <strong>
              {operationalStatus.portalConfigured ? "Liberada" : "Pendente"}
            </strong>
            <p>
              {operationalStatus.portalConfigured
                ? "O salão já consegue revisar pagamento e renovação por conta própria."
                : "Libere essa área para o salão conseguir gerenciar a assinatura."}
            </p>
          </article>
        </section>

        {issues.length ? (
          <section className="dashboard-panel billing-page__panel">
            <div className="dashboard-panel__header">
              <div className="dashboard-panel__title">
                <span className="eyebrow">Antes de liberar a cobrança</span>
                <h2>O que ainda falta concluir</h2>
              </div>
            </div>

            <div className="billing-page__checklist">
              {issues.map((issue) => (
                <article key={issue} className="billing-page__checklist-item">
                  <strong>{issue}</strong>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        <section className="dashboard-panel billing-page__panel">
          <div className="dashboard-panel__header">
            <div className="dashboard-panel__title">
              <span className="eyebrow">Planos do sistema</span>
              <h2>Cobrança do painel por estabelecimento</h2>
              <p>
                A cliente final continua usando o app do salão sem pagar. Quem
                assina o sistema é o estabelecimento.
              </p>
            </div>
          </div>

          <div className="billing-page__plans">
            {billingSnapshot.plans.map((plan) => {
              const isCurrentPlan = billingSnapshot.currentPlan.id === plan.id;

              return (
                <article
                  key={plan.id}
                  className={`billing-plan-card${
                    isCurrentPlan ? " billing-plan-card--current" : ""
                  }`}
                >
                  <div className="billing-plan-card__header">
                    <div>
                      <span className="eyebrow">{plan.displayName}</span>
                      <h3>{plan.tagline ?? plan.description}</h3>
                    </div>
                    {isCurrentPlan ? (
                      <span className="badge badge--confirmed">
                        {billingSnapshot.isLocked &&
                        !billingSnapshot.subscription.activatedAt
                          ? "Plano inicial"
                          : "Plano atual"}
                      </span>
                    ) : null}
                  </div>

                  {plan.highlight ? (
                    <p className="billing-plan-card__highlight">
                      {plan.highlight}
                    </p>
                  ) : null}

                  <div className="billing-plan-card__prices">
                    <div>
                      <span>Mensal</span>
                      <strong>
                        {formatBillingPrice(plan.monthlyPrice, plan.currencyCode)}
                      </strong>
                    </div>
                    <div>
                      <span>Anual</span>
                      <strong>
                        {formatBillingPrice(plan.yearlyPrice, plan.currencyCode)}
                      </strong>
                    </div>
                  </div>

                  <div className="billing-plan-card__limits">
                    {buildPlanHighlights(plan).map((item) => (
                      <span key={item} className="badge badge--soft">
                        {item}
                      </span>
                    ))}
                  </div>

                  <div className="billing-plan-card__actions">
                    {planChangesManagedInPortal ? (
                      <span className="badge badge--soft">
                        Alterações e regularização seguem pela área da assinatura.
                      </span>
                    ) : (
                      <>
                        <form action={startStripeCheckoutAction}>
                          <input type="hidden" name="planId" value={plan.id} />
                          <input
                            type="hidden"
                            name="billingInterval"
                            value="monthly"
                          />
                          <button
                            type="submit"
                            className="primary-button"
                            disabled={!checkoutEnabled}
                          >
                            Assinar mensal
                          </button>
                        </form>

                        <form action={startStripeCheckoutAction}>
                          <input type="hidden" name="planId" value={plan.id} />
                          <input
                            type="hidden"
                            name="billingInterval"
                            value="yearly"
                          />
                          <button
                            type="submit"
                            className="secondary-button"
                            disabled={!checkoutEnabled}
                          >
                            Assinar anual
                          </button>
                        </form>
                      </>
                    )}
                  </div>

                  <p className="billing-plan-card__footnote">
                    {planChangesManagedInPortal
                      ? "Para evitar cobrança duplicada, trocas de plano, cartão e regularização seguem pela gestão da assinatura."
                      : checkoutEnabled
                      ? billingSnapshot.isLocked
                        ? "Ao concluir o pagamento, o painel completo é liberado automaticamente."
                        : "Ao assinar, o plano do painel é atualizado sem mexer no app das clientes."
                      : "Assim que a cobrança real for liberada, os botões passam a funcionar por aqui."}
                  </p>
                </article>
              );
            })}
          </div>
        </section>

        <section className="dashboard-panel billing-page__panel">
          <div className="dashboard-panel__header">
            <div className="dashboard-panel__title">
              <span className="eyebrow">Como funciona</span>
              <h2>Como a assinatura funciona</h2>
            </div>
          </div>

          <div className="billing-page__journey">
            <article className="billing-page__journey-step">
              <strong>1. O salão cria a conta</strong>
              <p>
                O cadastro cria a estrutura do salão e leva direto para a ativação da assinatura do painel.
              </p>
            </article>

            <article className="billing-page__journey-step">
              <strong>2. Salão escolhe o plano</strong>
              <p>
                A assinatura do painel é ativada em uma página segura de pagamento, sem mexer no app das clientes.
              </p>
            </article>

            <article className="billing-page__journey-step">
              <strong>3. Clientes do salão usam de graça</strong>
              <p>
                O app cliente continua liberado via código do salão. A cobrança
                fica só no estabelecimento.
              </p>
            </article>
          </div>

          {!portalEnabled && !checkoutEnabled ? (
            <EmptyStateCard
              eyebrow="Cobrança protegida"
              title="A assinatura fica protegida até a liberação final"
              description="Quando a cobrança estiver pronta, o salão ativa o plano e o painel completo é liberado automaticamente."
            />
          ) : null}
        </section>
      </div>
    );
  });
}
