import Link from "next/link";
import { redirect } from "next/navigation";

import { startStripeCheckoutAction } from "@/app/actions";
import { getOwnerSalon } from "@/lib/auth";
import {
  BILLING_DISABLED,
  BILLING_PATH,
  PUBLIC_BILLING_PATH,
  formatBillingPrice,
  getPublicBillingPlans,
  getSalonBillingWorkspaceSnapshot,
  SINGLE_BILLING_PLAN_YEARLY_COMPARE_AT_PRICE,
  SINGLE_BILLING_PLAN_YEARLY_SAVINGS,
  type SalonBillingPlan,
} from "@/lib/billing";
import { measureServerRender } from "@/lib/serverPerformance";
import { getStripeOperationalStatus } from "@/lib/stripeBilling";
import { createClient } from "@/lib/supabase/server";

import styles from "./page.module.css";

export const dynamic = "force-dynamic";

type PublicBillingPageProps = {
  searchParams?: Promise<{
    message?: string;
    tone?: string;
    interval?: string;
  }>;
};

type IconName =
  | "calendar"
  | "clients"
  | "team"
  | "finance"
  | "gift"
  | "shield"
  | "cancel"
  | "support"
  | "refresh"
  | "lock"
  | "check";

function DashboardIcon({ name, className }: { name: IconName; className?: string }) {
  const stroke = {
    className,
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeWidth: 1.9,
    viewBox: "0 0 24 24",
  };

  switch (name) {
    case "calendar":
      return (
        <svg {...stroke}>
          <rect x="3.5" y="5" width="17" height="15.5" rx="3" />
          <path d="M7 3.5v4M17 3.5v4M3.5 9.5h17" />
        </svg>
      );
    case "clients":
      return (
        <svg {...stroke}>
          <path d="M12 12.5a3.75 3.75 0 1 0 0-7.5 3.75 3.75 0 0 0 0 7.5Z" />
          <path d="M5 20a7 7 0 0 1 14 0" />
        </svg>
      );
    case "team":
      return (
        <svg {...stroke}>
          <path d="M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM16 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" />
          <path d="M2.5 20a5.5 5.5 0 0 1 11 0M13 20a4.5 4.5 0 0 1 9 0" />
        </svg>
      );
    case "finance":
      return (
        <svg {...stroke}>
          <circle cx="12" cy="12" r="8.5" />
          <path d="M12 7v10M15 9.3c-.4-.8-1.5-1.3-3-1.3-1.8 0-3 .8-3 2.1 0 3.2 6 1.4 6 4.5 0 1.3-1.2 2.1-3 2.1-1.4 0-2.5-.5-3-1.3" />
        </svg>
      );
    case "gift":
      return (
        <svg {...stroke}>
          <path d="M4 10h16v10H4zM12 10v10M4 14h16" />
          <path d="M12 10H8.8A2.3 2.3 0 1 1 12 6.5Zm0 0h3.2A2.3 2.3 0 1 0 12 6.5Z" />
        </svg>
      );
    case "shield":
      return (
        <svg {...stroke}>
          <path d="M12 3.5 5.5 6v5.5c0 4.2 2.7 7.9 6.5 9 3.8-1.1 6.5-4.8 6.5-9V6Z" />
          <path d="m9.4 12 1.8 1.8 3.4-3.6" />
        </svg>
      );
    case "cancel":
      return (
        <svg {...stroke}>
          <circle cx="12" cy="12" r="8.5" />
          <path d="M8.5 8.5 15.5 15.5M15.5 8.5l-7 7" />
        </svg>
      );
    case "support":
      return (
        <svg {...stroke}>
          <path d="M4.5 12a7.5 7.5 0 0 1 15 0v3a2 2 0 0 1-2 2H15" />
          <path d="M4.5 12v3a2 2 0 0 0 2 2H9" />
          <path d="M9.5 18.5h5" />
        </svg>
      );
    case "refresh":
      return (
        <svg {...stroke}>
          <path d="M20 7.5V4h-3.5M4 16.5V20h3.5" />
          <path d="M6.6 8.2a7 7 0 0 1 11.5-1.7L20 7.5M17.4 15.8a7 7 0 0 1-11.5 1.7L4 16.5" />
        </svg>
      );
    case "lock":
      return (
        <svg {...stroke}>
          <rect x="5.5" y="10.5" width="13" height="10" rx="2.5" />
          <path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" />
        </svg>
      );
    default:
      return (
        <svg {...stroke}>
          <path d="m5 12 4 4 10-10" />
        </svg>
      );
  }
}

function buildVisitorPlanActivationHref(
  plan: Pick<SalonBillingPlan, "displayName">,
  billingInterval: "monthly" | "yearly",
) {
  const activationParams = new URLSearchParams({
    message: `Crie a conta principal para ativar a assinatura ${plan.displayName} ${
      billingInterval === "yearly" ? "anual" : "mensal"
    }.`,
    returnPath: `${PUBLIC_BILLING_PATH}?interval=${billingInterval}`,
    tone: "info",
  });

  return `/comecar?${activationParams.toString()}`;
}

function getPlanCtaLabel(
  plan: SalonBillingPlan,
  billingInterval: "monthly" | "yearly",
) {
  if (billingInterval === "yearly") {
    return `Ativar anual por ${formatBillingPrice(plan.yearlyPrice, plan.currencyCode)}`;
  }

  return `Ativar mensal por ${formatBillingPrice(plan.monthlyPrice, plan.currencyCode)}`;
}

function buildCommercialStatus(args: {
  salonName: string | null;
  checkoutEnabled: boolean;
}) {
  if (args.salonName) {
    return {
      checkoutTitle: `Escolha o plano ideal para ${args.salonName}`,
      checkoutDescription: args.checkoutEnabled
        ? `A conta de ${args.salonName} já está pronta. Confirmou o pagamento, o painel abre na hora.`
        : `A conta de ${args.salonName} já está pronta. Falta só confirmar o pagamento para liberar o painel.`,
    };
  }

  return {
    checkoutTitle: "Escolha o plano ideal para o seu salão",
    checkoutDescription:
      "Uma assinatura libera agenda, clientes, equipe e caixa em um só lugar.",
  };
}

function formatYearlyInstallmentLabel(plan: SalonBillingPlan) {
  const installment = plan.yearlyPrice / 12;
  const formatted = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: plan.currencyCode,
    minimumFractionDigits: 2,
  }).format(installment);

  return `equivale a ${formatted} por mês`;
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

    const checkoutEnabled = !BILLING_DISABLED && operationalStatus.liveReady;
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    let salonName: string | null = null;

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
    }

    const singlePlan = plans[0];
    const selectedInterval =
      searchParams?.interval === "yearly" ? "yearly" : "monthly";

    if (!singlePlan) {
          return (
        <div className={styles.page}>
          <header className={styles.header}>
            <div className={styles.headerShell}>
              <div className={styles.brand}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/icon.png" alt="Logo Salon Fun" className={styles.brandLogo} />
                <div>
                  <strong>Salon Fun</strong>
                  <span>Painel do salão</span>
                </div>
              </div>
            </div>
          </header>
          <main className={styles.shell}>
            <section className={styles.emptyState}>
              <span className={styles.emptyEyebrow}>Assinatura indisponível</span>
              <h1>Não há plano público configurado no momento.</h1>
              <p>Volte em instantes ou revise a configuração comercial do sistema.</p>
            </section>
          </main>
        </div>
      );
    }

    const content = buildCommercialStatus({
      salonName,
      checkoutEnabled,
    });
    const yearlyCompareAtPrice = formatBillingPrice(
      SINGLE_BILLING_PLAN_YEARLY_COMPARE_AT_PRICE,
      singlePlan.currencyCode,
    );
    const yearlySavings = formatBillingPrice(
      SINGLE_BILLING_PLAN_YEARLY_SAVINGS,
      singlePlan.currencyCode,
    );

    return (
      <div className={`${styles.page} public-billing-page`}>
        <header className={styles.header}>
          <div className={styles.headerShell}>
            <div className={styles.brand}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/icon.png" alt="Logo Salon Fun" className={styles.brandLogo} />
              <div>
                <strong>Salon Fun</strong>
                <span>Painel do salão</span>
              </div>
            </div>

            <div className={styles.headerSecurity}>
              <span className={styles.headerSecurityIcon}>
                <DashboardIcon name="lock" />
              </span>
              <div>
                <strong>Pagamento 100% seguro</strong>
                <span>Seus dados protegidos</span>
              </div>
            </div>
          </div>
        </header>

        <main className={styles.shell}>
          <section className={styles.layout}>
            <div className={styles.marketingColumn}>
              <nav className={styles.steps} aria-label="Etapas da assinatura">
                <span className={`${styles.step} ${styles.stepActive}`}>
                  <strong>1</strong>
                  <span>Escolha do plano</span>
                </span>
                <span className={styles.step}>
                  <strong>2</strong>
                  <span>Dados de pagamento</span>
                </span>
                <span className={styles.step}>
                  <strong>3</strong>
                  <span>Confirmação</span>
                </span>
              </nav>

              <div className={styles.heroBlock}>
                <h1>
                  Mais agenda.
                  <br />
                  Menos
                  <br />
                  <span>enrolação.</span>
                </h1>
                <p>
                  Agenda, pedidos, clientes para chamar e receita em uma tela só.
                </p>
              </div>

              <div className={styles.featureGrid}>
                <article className={styles.featureCard}>
                  <span className={styles.featureIcon}>
                    <DashboardIcon name="calendar" />
                  </span>
                  <div>
                    <strong>Agenda do dia</strong>
                    <p>Horários, confirmações e encaixes.</p>
                  </div>
                </article>

                <article className={styles.featureCard}>
                  <span className={styles.featureIcon}>
                    <DashboardIcon name="clients" />
                  </span>
                  <div>
                    <strong>Respostas rápidas</strong>
                    <p>Pedidos do app no mesmo fluxo.</p>
                  </div>
                </article>

                <article className={styles.featureCard}>
                  <span className={styles.featureIcon}>
                    <DashboardIcon name="team" />
                  </span>
                  <div>
                    <strong>Clientes para chamar</strong>
                    <p>Retorno, aniversário e reativação.</p>
                  </div>
                </article>

                <article className={styles.featureCard}>
                  <span className={styles.featureIcon}>
                    <DashboardIcon name="finance" />
                  </span>
                  <div>
                    <strong>Receita na tela</strong>
                    <p>Faturamento e ticket sem planilha.</p>
                  </div>
                </article>
              </div>

              <article className={styles.proofCard}>
                <strong>O salão acompanha tudo no mesmo lugar.</strong>
                <p>Agenda, pedidos do app, clientes e caixa em uma rotina simples para operar.</p>
              </article>
            </div>

            <section className={styles.checkoutPanel} id="public-billing-plans">
              <div className={styles.trialBanner}>
                <span className={styles.trialBannerIcon}>
                  <DashboardIcon name="gift" />
                </span>
                <div className={styles.trialBannerCopy}>
                  <strong>Teste grátis por 3 dias</strong>
                  <p>Cancele quando quiser. Sem burocracia.</p>
                </div>
                <div className={styles.trialBannerTag}>
                  <strong>Sem cobrança</strong>
                  <span>nos 3 primeiros dias</span>
                </div>
              </div>

              {searchParams?.message ? (
                <div
                  className={`${styles.contextBanner} ${
                    searchParams.tone === "error" ? styles.contextBannerError : ""
                  }`}
                >
                  <strong>{salonName ? `Conta criada para ${salonName}` : "Informação da assinatura"}</strong>
                  <span>{searchParams.message}</span>
                </div>
              ) : salonName ? (
                <div className={styles.contextBanner}>
                  <strong>{salonName} pronto para ativação</strong>
                  <span>{content.checkoutDescription}</span>
                </div>
              ) : null}

              <div className={styles.checkoutHeader}>
                <h2>{content.checkoutTitle}</h2>
                <p>{content.checkoutDescription}</p>
              </div>

              <div className={styles.intervalSwitch} aria-label="Ciclos da assinatura">
                <a
                  href={`${PUBLIC_BILLING_PATH}?interval=monthly`}
                  className={`${styles.intervalOption} ${
                    selectedInterval === "monthly" ? styles.intervalOptionActive : ""
                  }`}
                >
                  <strong>Mensal</strong>
                  <span>Cobrança mensal</span>
                </a>
                <a
                  href={`${PUBLIC_BILLING_PATH}?interval=yearly`}
                  className={`${styles.intervalOption} ${
                    selectedInterval === "yearly" ? styles.intervalOptionActive : ""
                  }`}
                >
                  <div className={styles.intervalOptionTop}>
                    <strong>Anual</strong>
                    <span className={styles.discountBadge}>17% OFF</span>
                  </div>
                  <span>Cobrança anual</span>
                </a>
              </div>

              <div className={styles.planGrid}>
                <article
                  className={`${styles.planCard} ${styles.monthlyCard} ${
                    selectedInterval === "monthly" ? styles.planCardActive : ""
                  }`}
                >
                  <div className={styles.planCardHeader}>
                    <span className={styles.planLabel}>Plano mensal</span>
                  </div>

                  <div className={styles.priceRow}>
                    <strong>{formatBillingPrice(singlePlan.monthlyPrice, singlePlan.currencyCode)}</strong>
                    <span>/mês</span>
                  </div>

                  <p className={styles.priceSubline}>1 cobrança após o teste grátis</p>

                  <ul className={styles.benefitList}>
                    {[
                      "Todos os recursos do sistema",
                      "Suporte prioritário",
                      "Atualizações inclusas",
                      "Acesso ao aplicativo",
                    ].map((item) => (
                      <li key={item}>
                        <DashboardIcon name="check" className={styles.checkIcon} />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>

                  {user && salonName ? (
                    <form action={startStripeCheckoutAction}>
                      <input
                        type="hidden"
                        name="returnPath"
                        value={`${PUBLIC_BILLING_PATH}?interval=monthly`}
                      />
                      <input type="hidden" name="billingInterval" value="monthly" />
                      <button
                        type="submit"
                        className={styles.primaryCta}
                        aria-label={getPlanCtaLabel(singlePlan, "monthly")}
                        disabled={!checkoutEnabled}
                      >
                        Começar teste grátis
                      </button>
                    </form>
                  ) : (
                    <Link
                      href={buildVisitorPlanActivationHref(singlePlan, "monthly")}
                      className={styles.primaryCta}
                      aria-label={getPlanCtaLabel(singlePlan, "monthly")}
                    >
                      Começar teste grátis
                    </Link>
                  )}

                  <div className={styles.secureFoot}>
                    <DashboardIcon name="lock" className={styles.secureIcon} />
                    <span>Pagamento seguro</span>
                  </div>
                </article>

                <article
                  className={`${styles.planCard} ${
                    selectedInterval === "yearly" ? styles.planCardActive : ""
                  }`}
                >
                  <div className={styles.planCardHeader}>
                    <span className={styles.planLabel}>Plano anual</span>
                    <span className={styles.economyBadge}>Mais econômico</span>
                  </div>

                  <div className={styles.priceRow}>
                    <strong>{formatBillingPrice(singlePlan.yearlyPrice, singlePlan.currencyCode)}</strong>
                    <span>/ano</span>
                  </div>

                  <p className={styles.priceSubline}>
                    de <s>{yearlyCompareAtPrice}</s> por ano
                  </p>

                  <ul className={styles.benefitList}>
                    {[
                      "Todos os recursos do sistema",
                      "Suporte prioritário",
                      "Atualizações inclusas",
                      "Acesso ao aplicativo",
                    ].map((item) => (
                      <li key={item}>
                        <DashboardIcon name="check" className={styles.checkIcon} />
                        <span>{item}</span>
                      </li>
                    ))}
                    <li className={styles.savingsLine}>
                      <DashboardIcon name="check" className={styles.savingsIcon} />
                      <span>Você economiza {yearlySavings} no ano</span>
                    </li>
                  </ul>

                  <div className={styles.annualNote}>{formatYearlyInstallmentLabel(singlePlan)}</div>

                  {user && salonName ? (
                    <form action={startStripeCheckoutAction}>
                      <input
                        type="hidden"
                        name="returnPath"
                        value={`${PUBLIC_BILLING_PATH}?interval=yearly`}
                      />
                      <input type="hidden" name="billingInterval" value="yearly" />
                      <button
                        type="submit"
                        className={styles.secondaryCta}
                        aria-label={getPlanCtaLabel(singlePlan, "yearly")}
                        disabled={!checkoutEnabled}
                      >
                        Começar teste grátis
                      </button>
                    </form>
                  ) : (
                    <Link
                      href={buildVisitorPlanActivationHref(singlePlan, "yearly")}
                      className={styles.secondaryCta}
                      aria-label={getPlanCtaLabel(singlePlan, "yearly")}
                    >
                      Começar teste grátis
                    </Link>
                  )}

                  <div className={styles.secureFoot}>
                    <DashboardIcon name="lock" className={styles.secureIcon} />
                    <span>Pagamento seguro</span>
                  </div>
                </article>
              </div>

              <div className={styles.assuranceRow}>
                <article className={styles.assuranceItem}>
                  <DashboardIcon name="shield" className={styles.assuranceIcon} />
                  <div>
                    <strong>Checkout protegido</strong>
                    <span>Pagamento processado com segurança e ativação após confirmação.</span>
                  </div>
                </article>

                <article className={styles.assuranceItem}>
                  <DashboardIcon name="lock" className={styles.assuranceIcon} />
                  <div>
                    <strong>Dados reais no painel</strong>
                    <span>Agenda, pedidos e receita aparecem com a leitura do próprio salão.</span>
                  </div>
                </article>

                <article className={styles.assuranceItem}>
                  <DashboardIcon name="cancel" className={styles.assuranceIcon} />
                  <div>
                    <strong>Cancele quando quiser</strong>
                    <span>Sem multa e sem contrato longo para continuar operando.</span>
                  </div>
                </article>

                <article className={styles.assuranceItem}>
                  <DashboardIcon name="refresh" className={styles.assuranceIcon} />
                  <div>
                    <strong>Produto em evolução</strong>
                    <span>Melhorias contínuas sem mudar o fluxo principal do salão.</span>
                  </div>
                </article>
              </div>
            </section>
          </section>

          <footer className={styles.footer}>
            <span>Dúvidas sobre ativação, operação ou cobrança?</span>
            <Link href="/suporte">Abrir suporte</Link>
            <Link href="/privacidade">Privacidade</Link>
            <Link href="/termos">Termos</Link>
          </footer>
        </main>
      </div>
    );
  });
}
