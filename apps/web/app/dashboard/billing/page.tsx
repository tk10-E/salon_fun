import {
  startStripeBillingPortalAction,
  startStripeCheckoutAction,
} from "@/app/actions";
import { FlashMessage } from "@/components/FlashMessage";
import {
  formatBillingPrice,
  formatLimitLabel,
  getSalonBillingWorkspaceSnapshot,
} from "@/lib/billing";
import {
  getStripeBillingReadiness,
  getStripeOperationalStatus,
  type StripeOperationalStatus,
} from "@/lib/stripeBilling";

import { requireOwnerSalon } from "@/lib/auth";

export const dynamic = "force-dynamic";

type BillingPageProps = {
  searchParams?: {
    message?: string;
    tone?: string;
  };
};

function formatPlanFeature(value: boolean, enabledLabel: string, disabledLabel: string) {
  return value ? enabledLabel : disabledLabel;
}

function getAccessBadgeClass(accessState: "healthy" | "attention" | "locked") {
  switch (accessState) {
    case "healthy":
      return "badge badge--confirmed";
    case "attention":
      return "badge badge--pending";
    default:
      return "badge badge--cancelled";
  }
}

export default async function BillingPage({ searchParams }: BillingPageProps) {
  const { salon } = await requireOwnerSalon();
  const billingSnapshot = await getSalonBillingWorkspaceSnapshot(salon.id);
  const stripeReadiness = getStripeBillingReadiness();
  let stripeStatus: StripeOperationalStatus | null = null;
  let stripeStatusMessage: string | null = null;

  if (stripeReadiness.configured) {
    try {
      stripeStatus = await getStripeOperationalStatus();
    } catch (error) {
      stripeStatusMessage =
        error instanceof Error
          ? error.message
          : "Não foi possível validar o Stripe agora.";
    }
  }

  const currentPlan = billingSnapshot.currentPlan;
  const subscription = billingSnapshot.subscription;
  const hasStripeCustomer =
    subscription.paymentProvider === "stripe" &&
    Boolean(subscription.providerCustomerId);
  const canSellWithStripe =
    stripeStatus?.mode === "live" && stripeStatus.webhookConfigured;
  const canManageInStripe =
    hasStripeCustomer &&
    stripeStatus?.mode === "live" &&
    stripeStatus.portalConfigured;

  return (
    <div className="page-grid">
      {searchParams?.message ? (
        <FlashMessage message={searchParams.message} tone={searchParams.tone} />
      ) : null}

      <header className="simple-header">
        <div>
          <p className="eyebrow">Plano</p>
          <h1>Plano do salão</h1>
          <p className="muted">
            Acompanhe sua assinatura e escolha o plano ideal para o momento do salão.
          </p>
          <div className="inline-actions" style={{ marginTop: 8, flexWrap: "wrap" }}>
            <span className={getAccessBadgeClass(billingSnapshot.accessState)}>
              {billingSnapshot.statusLabel}
            </span>
            <span className="badge badge--soft">{currentPlan.displayName}</span>
            {billingSnapshot.nextBillingDateLabel ? (
              <span className="badge badge--accent">
                Próxima cobrança: {billingSnapshot.nextBillingDateLabel}
              </span>
            ) : null}
          </div>
        </div>

        <div className="simple-row__actions" style={{ flexWrap: "wrap" }}>
          {canManageInStripe ? (
            <form action={startStripeBillingPortalAction}>
              <button type="submit" className="primary-button">
                Gerenciar assinatura
              </button>
            </form>
          ) : null}
        </div>
      </header>

      <section className="card content-card">
        <div className="section-heading">
          <div>
            <h2>Seu plano atual</h2>
            <p className="muted">Resumo do acesso e da assinatura do salão.</p>
          </div>
        </div>

        <div className="simple-list">
          <article className="simple-row">
            <div className="inline-actions" style={{ marginBottom: 8, flexWrap: "wrap" }}>
              <span className={getAccessBadgeClass(billingSnapshot.accessState)}>
                Acesso {billingSnapshot.accessState === "healthy" ? "liberado" : billingSnapshot.accessState === "attention" ? "em atenção" : "pausado"}
              </span>
            </div>
            <h3>{currentPlan.displayName}</h3>
            <p className="muted">{billingSnapshot.statusDetail}</p>
            {billingSnapshot.bannerTitle ? (
              <p className="list-meta">
                {billingSnapshot.bannerTitle}: {billingSnapshot.bannerMessage}
              </p>
            ) : null}
            {billingSnapshot.nextBillingDateLabel ? (
              <p className="list-meta">
                Próxima cobrança em {billingSnapshot.nextBillingDateLabel}.
              </p>
            ) : null}
          </article>

          <article className="simple-row">
            <h3>Pagamento e renovação</h3>
            {!stripeReadiness.configured ? (
              <p className="muted">
                O gerenciamento automático da assinatura ainda está sendo preparado.
              </p>
            ) : stripeStatusMessage ? (
              <p className="muted">
                O gerenciamento da assinatura está temporariamente indisponível.
              </p>
            ) : (
              <>
                <p className="muted">
                  {canManageInStripe
                    ? "Sua assinatura já pode ser gerenciada por aqui."
                    : hasStripeCustomer
                    ? "Sua assinatura está vinculada e o gerenciamento pode levar alguns instantes para aparecer."
                    : canSellWithStripe
                    ? "Você já pode contratar ou trocar de plano quando quiser."
                    : "Novas assinaturas ficam disponíveis assim que o pagamento online estiver pronto."}
                </p>
                {billingSnapshot.nextBillingDateLabel ? (
                  <p className="list-meta">
                    {billingSnapshot.statusLabel} • referência em{" "}
                    {billingSnapshot.nextBillingDateLabel}.
                  </p>
                ) : null}
              </>
            )}
          </article>
        </div>
      </section>

      <section className="card content-card">
        <div className="section-heading">
          <div>
            <h2>Planos disponíveis</h2>
            <p className="muted">Escolha um plano novo ou mantenha o atual.</p>
          </div>
        </div>

        <div className="simple-list">
          {billingSnapshot.plans.map((plan) => {
            const isCurrentPlan = plan.id === currentPlan.id;

            return (
              <article key={plan.id} className="simple-row">
                <div className="inline-actions" style={{ marginBottom: 8, flexWrap: "wrap" }}>
                  {isCurrentPlan ? (
                    <span className="badge badge--confirmed">Plano atual</span>
                  ) : null}
                  {plan.highlight ? <span className="badge badge--soft">{plan.highlight}</span> : null}
                  {plan.isDefault ? <span className="badge badge--accent">Plano base</span> : null}
                </div>
                <h3>{plan.displayName}</h3>
                <p className="muted">{plan.description}</p>
                <p className="list-meta">
                  {formatBillingPrice(plan.monthlyPrice, plan.currencyCode)}/mês •{" "}
                  {formatBillingPrice(plan.yearlyPrice, plan.currencyCode)}/ano
                </p>
                <p className="list-meta">
                  {formatLimitLabel(plan.maxStaffMembers, "profissional", "profissionais")} •{" "}
                  {formatLimitLabel(plan.maxServices, "serviço", "serviços")} •{" "}
                  {formatLimitLabel(plan.maxMonthlyNotifications, "notificação", "notificações")}
                </p>
                <p className="list-meta">
                  {formatPlanFeature(plan.includesGrowthAutomation, "Automação incluída", "Sem automação")} •{" "}
                  {formatPlanFeature(plan.includesFeedVideo, "Vídeo no feed", "Sem vídeo no feed")} •{" "}
                  {formatPlanFeature(plan.includesPrioritySupport, "Suporte prioritário", "Suporte padrão")}
                </p>

                {hasStripeCustomer ? (
                  canManageInStripe ? (
                    <form action={startStripeBillingPortalAction} style={{ marginTop: 12 }}>
                      <button type="submit" className={isCurrentPlan ? "primary-button" : "secondary-button"}>
                        Gerenciar assinatura
                      </button>
                    </form>
                  ) : (
                    <p className="muted" style={{ marginTop: 12 }}>
                      O gerenciamento da assinatura aparece assim que a conta terminar de sincronizar.
                    </p>
                  )
                ) : canSellWithStripe ? (
                  <div className="inline-actions" style={{ marginTop: 12, flexWrap: "wrap" }}>
                    <form action={startStripeCheckoutAction}>
                      <input type="hidden" name="planId" value={plan.id} />
                      <input type="hidden" name="billingInterval" value="monthly" />
                      <button type="submit" className={isCurrentPlan ? "secondary-button" : "primary-button"}>
                        Assinar mensal
                      </button>
                    </form>
                    <form action={startStripeCheckoutAction}>
                      <input type="hidden" name="planId" value={plan.id} />
                      <input type="hidden" name="billingInterval" value="yearly" />
                      <button type="submit" className="secondary-button">
                        Assinar anual
                      </button>
                    </form>
                  </div>
                ) : (
                  <p className="muted" style={{ marginTop: 12 }}>
                    As novas assinaturas ficam disponíveis em breve.
                  </p>
                )}
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
