import Link from "next/link";

import {
  cancelSalonSubscriptionAction,
  changeSalonPlanAction,
  resumeSalonSubscriptionAction,
  startStripeBillingPortalAction,
  startStripeCheckoutAction,
} from "@/app/actions";
import { DashboardWorkspaceHero } from "@/components/DashboardWorkspaceHero";
import { FlashMessage } from "@/components/FlashMessage";
import {
  formatBillingPrice,
  formatLimitLabel,
  getSalonBillingSnapshot,
  type BillingInterval,
  type SalonBillingPlan,
} from "@/lib/billing";
import { requireOwnerSalon } from "@/lib/auth";
import { getStripeBillingReadiness, getStripeOperationalStatus } from "@/lib/stripeBilling";
import { createClient } from "@/lib/supabase/server";

type BillingPageProps = {
  searchParams?: {
    message?: string;
    tone?: string;
  };
};

function describePlanAction(args: {
  plan: SalonBillingPlan;
  currentPlanId: string;
  currentInterval: BillingInterval;
  selectedInterval: BillingInterval;
  currentStatus: string;
}) {
  const isCurrentPlan = args.plan.id === args.currentPlanId;
  const isCurrentInterval = args.currentInterval === args.selectedInterval;

  if (isCurrentPlan && isCurrentInterval && (args.currentStatus === "active" || args.currentStatus === "trialing")) {
    return "Plano atual";
  }

  if (isCurrentPlan && args.currentStatus !== "active" && args.currentStatus !== "trialing") {
    return args.selectedInterval === "yearly" ? "Reativar anual" : "Reativar mensal";
  }

  return args.selectedInterval === "yearly" ? "Trocar para anual" : "Trocar para mensal";
}

function getUsageState(used: number, limit: number | null) {
  if (limit === null) {
    return {
      label: "Sem teto operacional",
      tone: "success" as const,
    };
  }

  if (used >= limit) {
    return {
      label: `Limite atingido (${used}/${limit})`,
      tone: "danger" as const,
    };
  }

  if (used >= Math.ceil(limit * 0.8)) {
    return {
      label: `Perto do limite (${used}/${limit})`,
      tone: "warm" as const,
    };
  }

  return {
    label: `Dentro do plano (${used}/${limit})`,
    tone: "success" as const,
  };
}

export default async function BillingPage({ searchParams }: BillingPageProps) {
  const { salon } = await requireOwnerSalon();
  const supabase = createClient();
  const billingSnapshot = await getSalonBillingSnapshot(salon.id);
  const stripeReadiness = getStripeBillingReadiness();
  const stripeOperationalStatus = await getStripeOperationalStatus();
  const recentWindowStart = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [activeStaffResult, servicesResult, notificationsResult] = await Promise.all([
    supabase
      .from("staff_members")
      .select("id", { count: "exact", head: true })
      .eq("salon_id", salon.id)
      .eq("is_active", true),
    supabase
      .from("services")
      .select("id", { count: "exact", head: true })
      .eq("salon_id", salon.id),
    supabase
      .from("salon_customer_notifications")
      .select("id", { count: "exact", head: true })
      .eq("salon_id", salon.id)
      .gte("created_at", recentWindowStart),
  ]);

  const activeStaffCount = activeStaffResult.count ?? 0;
  const servicesCount = servicesResult.count ?? 0;
  const monthlyNotificationsCount = notificationsResult.count ?? 0;
  const staffUsage = getUsageState(activeStaffCount, billingSnapshot.currentPlan.maxStaffMembers);
  const servicesUsage = getUsageState(servicesCount, billingSnapshot.currentPlan.maxServices);
  const notificationsUsage = getUsageState(
    monthlyNotificationsCount,
    billingSnapshot.currentPlan.maxMonthlyNotifications,
  );

  return (
    <div className="workspace-page billing-page">
      <DashboardWorkspaceHero
        eyebrow="Billing"
        title="Plano, cobrança e regras de acesso do salão"
        description="Esta camada transforma o painel em SaaS de verdade: trial, assinatura, limites operacionais e bloqueio elegante quando a cobrança pede atenção."
        highlight={{
          label: "Plano atual",
          value: billingSnapshot.currentPlan.displayName,
          note: billingSnapshot.statusDetail,
        }}
        signals={[
          { label: "Status", value: billingSnapshot.statusLabel, tone: billingSnapshot.bannerTone },
          {
            label: "Próximo marco",
            value: billingSnapshot.nextBillingDateLabel ?? "Sem data definida",
            tone: billingSnapshot.accessState === "locked" ? "danger" : "soft",
          },
          {
            label: "Recursos premium",
            value: billingSnapshot.currentPlan.includesGrowthAutomation ? "Liberados" : "Parciais",
            tone: billingSnapshot.currentPlan.includesGrowthAutomation ? "success" : "warm",
          },
        ]}
        stats={[
          {
            label: "Equipe ativa",
            value: activeStaffCount,
            note: staffUsage.label,
            tone: staffUsage.tone,
          },
          {
            label: "Serviços publicados",
            value: servicesCount,
            note: servicesUsage.label,
            tone: servicesUsage.tone,
          },
          {
            label: "Notificações 30d",
            value: monthlyNotificationsCount,
            note: notificationsUsage.label,
            tone: notificationsUsage.tone,
          },
        ]}
        actions={
          <Link href="/dashboard/settings" className="secondary-button">
            Ajustar app do cliente
          </Link>
        }
        aside={
          <>
            <span className="workspace-panel__eyebrow">Operação comercial</span>
            <h3>Upgrade, retomada e ciclo atual</h3>
            <p>
              O dono consegue escolher o plano, retomar acesso e cancelar ao fim do ciclo sem
              depender de operação manual fora do painel.
            </p>
          </>
        }
      />

      {searchParams?.message ? <FlashMessage message={searchParams.message} tone={searchParams.tone} /> : null}

      {billingSnapshot.isUsingFallback ? (
        <section className="empty-state">
          <div className="empty-state__content">
            <h3>Billing em modo de compatibilidade</h3>
            <p>
              O painel continua funcional, mas a camada persistida de assinatura ainda não foi
              encontrada neste ambiente. Aplique a migration `0048_salon_saas_billing.sql` para
              liberar cobrança persistente e regras completas.
            </p>
          </div>
        </section>
      ) : null}

      {stripeReadiness.configured && !stripeOperationalStatus.liveReady ? (
        <section className="empty-state">
          <div className="empty-state__content">
            <h3>Billing ainda não está em go-live comercial</h3>
            <p>
              O checkout já funciona, mas o ambiente ainda não está pronto para venda aberta sem
              supervisão. Ajuste os pontos abaixo antes de ligar cobrança em produção.
            </p>
            <ul className="billing-feature-list">
              {stripeOperationalStatus.issues.map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      <section className="workspace-subgrid">
        <article className="card content-card billing-overview-card">
          <span className="workspace-panel__eyebrow">Ciclo atual</span>
          <h3>Assinatura {billingSnapshot.statusLabel.toLowerCase()}</h3>
          <p>
            {billingSnapshot.nextBillingDateLabel
              ? `Próximo marco financeiro em ${billingSnapshot.nextBillingDateLabel}.`
              : "Assim que um plano for ativado, o próximo ciclo financeiro aparece aqui."}
          </p>

          <div className="billing-overview-card__actions">
            {stripeReadiness.configured ? (
              billingSnapshot.subscription.providerCustomerId ? (
                <form action={startStripeBillingPortalAction}>
                  <button type="submit" className="primary-button">
                    Abrir portal Stripe
                  </button>
                </form>
              ) : (
                <p className="metric-note">
                  Escolha um plano abaixo para iniciar a primeira assinatura no Stripe.
                </p>
              )
            ) : (
              <>
                {billingSnapshot.subscription.status === "active" || billingSnapshot.subscription.status === "trialing" ? (
                  <form action={cancelSalonSubscriptionAction}>
                    <button type="submit" className="secondary-button" disabled={billingSnapshot.isUsingFallback}>
                      Cancelar ao fim do ciclo
                    </button>
                  </form>
                ) : (
                  <form action={resumeSalonSubscriptionAction}>
                    <button type="submit" className="primary-button" disabled={billingSnapshot.isUsingFallback}>
                      Retomar assinatura
                    </button>
                  </form>
                )}
              </>
            )}

            <Link href="/dashboard" className="secondary-button">
              Voltar ao dashboard
            </Link>
          </div>
        </article>

        <article className="card content-card billing-overview-card">
          <span className="workspace-panel__eyebrow">Gateway de cobrança</span>
          <h3>
            {!stripeReadiness.configured
              ? "Stripe ainda não configurado"
              : stripeOperationalStatus.liveReady
              ? "Stripe pronto para produção"
              : stripeOperationalStatus.mode === "test"
              ? "Stripe em modo de teste"
              : "Stripe precisa de ajustes finais"}
          </h3>
          <p>
            {!stripeReadiness.configured
              ? `Para ligar cobrança real, configure: ${stripeReadiness.missing.join(", ")}.`
              : stripeOperationalStatus.liveReady
              ? "Checkout, portal e webhook já podem atualizar a assinatura automaticamente em modo live."
              : "O Stripe está conectado, mas ainda falta fechar o modo live, o portal ou o webhook do domínio ativo."}
          </p>

          <ul className="billing-feature-list">
            <li>
              Modo atual:{" "}
              {stripeOperationalStatus.mode === "live"
                ? "Live"
                : stripeOperationalStatus.mode === "test"
                ? "Teste"
                : stripeOperationalStatus.mode === "mixed"
                ? "Misto"
                : "Indefinido"}
            </li>
            <li>
              Portal do cliente:{" "}
              {stripeOperationalStatus.portalConfigured
                ? "configurado"
                : `${stripeOperationalStatus.activePortalConfigCount} config(s) ativa(s), mas sem retorno para o billing atual`}
            </li>
            <li>
              Webhook comercial: {stripeOperationalStatus.webhookConfigured ? "ativo" : "não encontrado"}
            </li>
            <li>
              Retorno do portal: {stripeOperationalStatus.billingPortalReturnUrl ?? "APP_URL pendente"}
            </li>
          </ul>
        </article>

        <article className="card content-card billing-overview-card">
          <span className="workspace-panel__eyebrow">Recursos liberados</span>
          <h3>Entitlements do plano</h3>
          <ul className="billing-feature-list">
            <li>{billingSnapshot.currentPlan.includesCustomBranding ? "Branding customizado ativo" : "Branding básico ativo"}</li>
            <li>{billingSnapshot.currentPlan.includesFeedVideo ? "Vídeo no feed habilitado" : "Vídeo no feed bloqueado"}</li>
            <li>
              {billingSnapshot.currentPlan.includesGrowthAutomation
                ? "Automações de growth liberadas"
                : "Automação comercial indisponível"}
            </li>
            <li>
              {billingSnapshot.currentPlan.includesPrioritySupport
                ? "Suporte prioritário disponível"
                : "Suporte padrão do produto"}
            </li>
          </ul>
        </article>
      </section>

      <section className="billing-plan-grid" aria-label="Planos disponíveis">
        {billingSnapshot.plans.map((plan) => {
          const isCurrentPlan = plan.id === billingSnapshot.currentPlan.id;
          const monthlyActionLabel = describePlanAction({
            plan,
            currentPlanId: billingSnapshot.currentPlan.id,
            currentInterval: billingSnapshot.subscription.billingInterval,
            selectedInterval: "monthly",
            currentStatus: billingSnapshot.subscription.status,
          });
          const yearlyActionLabel = describePlanAction({
            plan,
            currentPlanId: billingSnapshot.currentPlan.id,
            currentInterval: billingSnapshot.subscription.billingInterval,
            selectedInterval: "yearly",
            currentStatus: billingSnapshot.subscription.status,
          });

          return (
            <article
              key={plan.id}
              className={isCurrentPlan ? "card content-card billing-plan-card billing-plan-card--active" : "card content-card billing-plan-card"}
            >
              <div className="billing-plan-card__header">
                <div>
                  <span className="workspace-panel__eyebrow">{plan.highlight ?? "Plano"}</span>
                  <h3>{plan.displayName}</h3>
                </div>
                {isCurrentPlan ? <span className="billing-plan-card__tag">Em uso</span> : null}
              </div>

              <p>{plan.description}</p>

              <div className="billing-plan-card__price-row">
                <div>
                  <span>Mensal</span>
                  <strong>{formatBillingPrice(plan.monthlyPrice, plan.currencyCode)}</strong>
                </div>
                <div>
                  <span>Anual</span>
                  <strong>{formatBillingPrice(plan.yearlyPrice, plan.currencyCode)}</strong>
                </div>
              </div>

              <ul className="billing-feature-list">
                <li>{formatLimitLabel(plan.maxStaffMembers, "profissional", "profissionais")}</li>
                <li>{formatLimitLabel(plan.maxServices, "serviço", "serviços")}</li>
                <li>{formatLimitLabel(plan.maxMonthlyNotifications, "notificação", "notificações")} por 30 dias</li>
                <li>{plan.includesFeedVideo ? "Reels e vídeo no feed" : "Feed em foto e antes/depois"}</li>
                <li>{plan.includesGrowthAutomation ? "Winback e rebook inteligentes" : "Growth manual"}</li>
              </ul>

              <form action={changeSalonPlanAction} className="billing-plan-card__actions">
                <input type="hidden" name="planId" value={plan.id} />
                {stripeReadiness.configured ? (
                  <>
                    <button
                      type="submit"
                      formAction={startStripeCheckoutAction}
                      name="billingInterval"
                      value="monthly"
                      className="primary-button"
                      disabled={monthlyActionLabel === "Plano atual"}
                    >
                      {monthlyActionLabel === "Plano atual" ? "Plano atual" : "Checkout mensal"}
                    </button>
                    <button
                      type="submit"
                      formAction={startStripeCheckoutAction}
                      name="billingInterval"
                      value="yearly"
                      className="secondary-button"
                      disabled={yearlyActionLabel === "Plano atual"}
                    >
                      {yearlyActionLabel === "Plano atual" ? "Plano atual" : "Checkout anual"}
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="submit"
                      name="billingInterval"
                      value="monthly"
                      className="primary-button"
                      disabled={billingSnapshot.isUsingFallback || monthlyActionLabel === "Plano atual"}
                    >
                      {monthlyActionLabel}
                    </button>
                    <button
                      type="submit"
                      name="billingInterval"
                      value="yearly"
                      className="secondary-button"
                      disabled={billingSnapshot.isUsingFallback || yearlyActionLabel === "Plano atual"}
                    >
                      {yearlyActionLabel}
                    </button>
                  </>
                )}
              </form>
            </article>
          );
        })}
      </section>
    </div>
  );
}
