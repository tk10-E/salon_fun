import Link from "next/link";
import { redirect } from "next/navigation";

import { startStripeCheckoutAction } from "@/app/actions";
import { FlashMessage } from "@/components/FlashMessage";
import { getOwnerSalon } from "@/lib/auth";
import {
  BILLING_DISABLED,
  BILLING_PATH,
  PUBLIC_BILLING_PATH,
  formatBillingPrice,
  formatLimitLabel,
  getPublicBillingPlans,
  getSalonBillingWorkspaceSnapshot,
  type SalonBillingPlan,
} from "@/lib/billing";
import { measureServerRender } from "@/lib/serverPerformance";
import {
  getStripeBillingReadiness,
  getStripeOperationalStatus,
} from "@/lib/stripeBilling";
import { createClient } from "@/lib/supabase/server";
import jc7BrandLogo from "@/assets/minha_empresa.png";

import styles from "./page.module.css";

export const dynamic = "force-dynamic";

const jc7BrandLogoAsset = jc7BrandLogo as { src?: string } | string;
const jc7BrandLogoSrc =
  typeof jc7BrandLogoAsset === "string"
    ? jc7BrandLogoAsset
    : jc7BrandLogoAsset.src ?? "";

type PublicBillingPageProps = {
  searchParams?: Promise<{
    message?: string;
    tone?: string;
  }>;
};

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

function buildCommercialStatus(args: {
  isAuthenticated: boolean;
  salonName: string | null;
  checkoutEnabled: boolean;
}) {
  if (args.salonName) {
    return {
      badge: "Conta criada",
      kicker: "Ativação comercial",
      title: `Escolha o plano para liberar ${args.salonName}.`,
      summary:
        "Assim que o pagamento for aprovado, agenda, clientes, equipe, caixa e as demais áreas do painel são liberadas automaticamente.",
      note: args.checkoutEnabled
        ? "Pagamento seguro em ambiente hospedado pela Stripe, sem expor dados do salão no painel."
        : "Os planos já estão definidos. Assim que a cobrança ficar disponível, a liberação acontece por aqui.",
    };
  }

  return {
    badge: "Planos do sistema",
    kicker: "Entrada comercial",
    title: "Planos do painel para salões profissionais.",
    summary:
      "Conheça os planos antes de entrar no painel. A assinatura libera o uso do sistema e mantém a gestão da cobrança em um fluxo profissional.",
    note:
      "Depois da assinatura, o salão gerencia cartão, faturas e cancelamento dentro da área de assinatura do painel.",
  };
}

export default async function PublicBillingPage({
  searchParams: searchParamsPromise,
}: PublicBillingPageProps) {
  return measureServerRender("public.billing", async () => {
    const [searchParams, plans, operationalStatus] = await Promise.all([
      searchParamsPromise,
      getPublicBillingPlans(),
      getStripeOperationalStatus(),
    ]);

    const readiness = getStripeBillingReadiness();
    const checkoutEnabled = !BILLING_DISABLED && operationalStatus.liveReady;
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    let salonName: string | null = null;
    let currentPlanId: string | null = null;

    if (user) {
      const salon = await getOwnerSalon(user.id);

      if (!salon) {
        redirect("/onboarding");
      }

      const billingSnapshot = await getSalonBillingWorkspaceSnapshot(salon.id);

      if (!billingSnapshot.isLocked) {
        redirect(BILLING_PATH);
      }

      salonName = salon.name;
      currentPlanId = billingSnapshot.currentPlan.id;
    }

    const content = buildCommercialStatus({
      isAuthenticated: Boolean(user),
      salonName,
      checkoutEnabled,
    });

    const readinessNotes = checkoutEnabled
      ? [
          "Assinatura recorrente com cobrança automática.",
          "Pagamento processado no checkout seguro da Stripe.",
          "Depois do pagamento, a gestão da assinatura segue dentro do painel.",
        ]
      : readiness.configured
        ? [
            "Os planos já estão organizados para venda.",
            "A cobrança online está em revisão final antes de ser liberada.",
            "Assim que estiver pronta, esta mesma página passa a ativar o painel.",
          ]
        : [
            "Os planos já podem ser apresentados para o salão.",
            "A cobrança online ainda está sendo finalizada.",
            "A ativação completa entra assim que a configuração comercial for concluída.",
          ];

    return (
      <div className={`${styles.page} setup-page public-billing-page`}>
        <div className={styles.backdrop} aria-hidden="true">
          <span className={styles.backdropOrbPrimary} />
          <span className={styles.backdropOrbSecondary} />
          <span className={styles.backdropGrid} />
        </div>

        <div className={`${styles.shell} public-billing-shell`}>
          {searchParams?.message ? (
            <FlashMessage
              message={searchParams.message}
              tone={searchParams.tone}
            />
          ) : null}

          <section className={`${styles.hero} hero-card auth-hero-panel public-billing-hero`}>
            <span className={styles.heroHalo} aria-hidden="true" />
            <div className={`${styles.heroGrid} public-billing-hero__grid`}>
              <div className={`${styles.heroCopy} auth-hero-copy`}>
                <div className={`${styles.heroBadges} hero-badges`}>
                  <span className={`${styles.eyebrow} eyebrow`}>{content.badge}</span>
                  <span className={`${styles.heroNote} hero-note`}>
                    {user ? "Assinatura antes do uso" : "Venda com checkout seguro"}
                  </span>
                </div>

                <p className="auth-hero-kicker">{content.kicker}</p>
                <h1>{content.title}</h1>
                <p className="auth-hero-summary">{content.summary}</p>

                <div className={styles.heroActions}>
                  <a href="#public-billing-plans" className={styles.heroCta}>
                    Escolher plano
                  </a>
                  <span className={styles.secureNote}>
                    {checkoutEnabled
                      ? "Stripe Checkout, portal e webhook ativos"
                      : "Checkout será liberado após a revisão final"}
                  </span>
                </div>
              </div>

              <div className={`${styles.heroStatus} auth-capability-grid public-billing-hero__status`}>
                <article className={`${styles.statusCard} auth-capability-card`}>
                  <strong>{salonName ? "Painel bloqueado até a assinatura" : "Planos fora do painel"}</strong>
                  <span>
                    {salonName
                      ? "A conta do salão já existe, mas o uso operacional só é liberado depois do plano ativo."
                      : "Novas contas podem conhecer os planos antes de entrar nas áreas operacionais do sistema."}
                  </span>
                </article>

                <article className={`${styles.statusCard} auth-capability-card`}>
                  <strong>{checkoutEnabled ? "Cobrança pronta para vender" : "Cobrança em preparação"}</strong>
                  <span>
                    {checkoutEnabled
                      ? "O pagamento segue para o Stripe Checkout e volta ao painel com a assinatura ativa."
                      : "A página já está pronta. Assim que a cobrança online estiver concluída, o fluxo ativa o painel automaticamente."}
                  </span>
                </article>

                <article className={styles.activationCard}>
                  <div className={styles.activationOrbit} aria-hidden="true">
                    <span />
                    <span />
                  </div>
                  <div>
                    <span className={styles.activationLabel}>
                      {checkoutEnabled ? "Operação live" : "Modo vitrine"}
                    </span>
                    <strong>
                      {checkoutEnabled ? "Checkout pronto para receber" : "Planos preparados"}
                    </strong>
                    <p>
                      A assinatura volta para o painel e libera as áreas operacionais depois da confirmação.
                    </p>
                  </div>
                </article>
              </div>
            </div>

            <div className={`${styles.proofStrip} auth-proof-strip`}>
              {readinessNotes.map((item, index) => (
                <article key={item} className={`${styles.proofItem} auth-proof-item`}>
                  <span className="auth-proof-label">Etapa {index + 1}</span>
                  <strong>{item}</strong>
                </article>
              ))}
            </div>

            <p className={`${styles.heroCaption} auth-hero-caption`}>{content.note}</p>
          </section>

          <section
            id="public-billing-plans"
            className={`${styles.panel} panel-card public-billing-panel`}
          >
            <div className={`${styles.panelHeader} public-billing-panel__header`}>
              <div>
                <span className={`${styles.eyebrow} eyebrow`}>Escolha do plano</span>
                <h2>Ative o painel do jeito certo</h2>
                <p className="muted">
                  {salonName
                    ? `O plano libera o painel de ${salonName} e mantém o app das clientes funcionando sem cobrança separada.`
                    : "Os valores abaixo liberam o painel por estabelecimento. O app cliente continua sem cobrança para a pessoa final."}
                </p>
              </div>
              <div className="public-billing-panel__aside">
                <strong>{checkoutEnabled ? "Pagamento com Stripe Checkout" : "Ativação comercial em revisão"}</strong>
                <span>
                  {checkoutEnabled
                    ? "A assinatura é processada fora do painel, em ambiente seguro, e depois volta para a gestão pós-venda."
                    : "A vitrine de planos já está pronta. A liberação do pagamento online entra assim que a cobrança terminar a configuração."}
                </span>
              </div>
            </div>

            <div className={`${styles.planGrid} billing-page__plans subscriptions-plan-grid`}>
              {plans.map((plan) => {
                const isCurrentPlan = currentPlanId === plan.id;
                const cardClassName = isCurrentPlan
                  ? `${styles.planCard} ${styles.planCardCurrent} subscription-plan-card billing-plan-card billing-plan-card--current`
                  : `${styles.planCard} subscription-plan-card billing-plan-card`;

                return (
                  <article key={plan.id} className={cardClassName}>
                    <div className={`${styles.planHeader} billing-plan-card__header`}>
                      <div>
                        <span className={`${styles.planName} eyebrow`}>{plan.displayName}</span>
                        <h3>{plan.tagline ?? plan.description}</h3>
                      </div>
                      {isCurrentPlan ? (
                        <span className="badge badge--success">Plano inicial</span>
                      ) : plan.isDefault ? (
                        <span className="badge badge--soft">Mais escolhido</span>
                      ) : null}
                    </div>

                    <p className={`${styles.planHighlight} billing-plan-card__highlight`}>
                      {plan.highlight ?? plan.description}
                    </p>

                    <div className={`${styles.planPrices} billing-plan-card__prices`}>
                      <div>
                        <span>Mensal</span>
                        <strong className="subscription-plan-card__price">
                          {formatBillingPrice(plan.monthlyPrice, plan.currencyCode)}
                        </strong>
                      </div>
                      <div>
                        <span>Anual</span>
                        <strong className="subscription-plan-card__price">
                          {formatBillingPrice(plan.yearlyPrice, plan.currencyCode)}
                        </strong>
                      </div>
                    </div>

                    <div className={`${styles.planLimits} billing-plan-card__limits`}>
                      {buildPlanHighlights(plan).map((item) => (
                        <span key={item} className="badge badge--soft">
                          {item}
                        </span>
                      ))}
                    </div>

                    <div className={`${styles.planActions} billing-plan-card__actions`}>
                      {user && salonName ? (
                        <>
                          <form action={startStripeCheckoutAction}>
                            <input type="hidden" name="planId" value={plan.id} />
                            <input
                              type="hidden"
                              name="billingInterval"
                              value="monthly"
                            />
                            <input
                              type="hidden"
                              name="returnPath"
                              value={PUBLIC_BILLING_PATH}
                            />
                            <button
                              type="submit"
                              className={`${styles.actionButton} primary-button`}
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
                            <input
                              type="hidden"
                              name="returnPath"
                              value={PUBLIC_BILLING_PATH}
                            />
                            <button
                              type="submit"
                              className={`${styles.actionButton} ${styles.secondaryAction} secondary-button`}
                              disabled={!checkoutEnabled}
                            >
                              Assinar anual
                            </button>
                          </form>
                        </>
                      ) : (
                        <Link href="/login" className={`${styles.actionButton} primary-button`}>
                          Entrar para assinar
                        </Link>
                      )}
                    </div>

                    <p className={`${styles.planFootnote} billing-plan-card__footnote`}>
                      {user && salonName
                        ? checkoutEnabled
                          ? "Ao concluir o pagamento, o painel completo é liberado automaticamente."
                          : "A cobrança online está em preparação. Assim que for liberada, esta página ativa o painel sem precisar voltar para o menu."
                        : "Entre com a conta principal do salão para concluir a assinatura e liberar o painel."}
                    </p>
                  </article>
                );
              })}
            </div>
          </section>

          <footer
            className={styles.brandSignature}
            aria-label="Desenvolvido por JC7 Desenvolvimentos"
          >
            <div className={styles.brandLogoFrame}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={jc7BrandLogoSrc}
                alt="Marca JC7 Desenvolvimentos"
                className={styles.brandLogo}
              />
            </div>

            <div className={styles.brandSignatureCopy}>
              <span>Projeto, tecnologia e automação</span>
              <strong>Desenvolvido por JC7 Desenvolvimentos</strong>
              <p>
                Arquitetura, programação e operação digital para o Salon Fun.
              </p>
            </div>
          </footer>
        </div>
      </div>
    );
  });
}
