import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { getAuthenticatedPanelEntryPath } from "@/lib/auth";
import { PUBLIC_BILLING_PATH } from "@/lib/billing";
import { createClient } from "@/lib/supabase/server";

import styles from "./page.module.css";

export const dynamic = "force-dynamic";

const HERO_SIGNALS = [
  {
    label: "Horários do dia",
    note: "Agenda e confirmações juntas",
  },
  {
    label: "Pedidos do app",
    note: "Responda rápido",
  },
  {
    label: "Receita do mês",
    note: "Faturamento real",
  },
  {
    label: "Clientes para chamar",
    note: "Base pronta para retorno",
  },
  {
    label: "Vagas para encaixe",
    note: "Horários livres",
  },
  {
    label: "Ticket médio",
    note: "Preço e oferta na mão",
  },
] as const;

const PRODUCT_PILLARS = [
  {
    title: "Responder rápido",
    description:
      "Agenda, pedidos e rotina no mesmo fluxo.",
  },
  {
    title: "Não perder cliente",
    description:
      "Veja quem sumiu, quem volta e quem vale chamar hoje.",
  },
  {
    title: "Vender com dado real",
    description:
      "Receita, ticket e agenda saem do uso real do salão.",
  },
  {
    title: "Sem complicação",
    description:
      "Menos cadastro. Mais ação.",
  },
] as const;

const ACTIVATION_FLOW = [
  "Crie a conta principal.",
  "Cadastre o salão e escolha o plano.",
  "Use agenda, pedidos e clientes em uma tela só.",
] as const;

function buildEntryHref() {
  const params = new URLSearchParams({
    message: "Crie a conta principal para montar o salão e liberar o painel.",
    tone: "info",
  });

  return `/comecar?${params.toString()}`;
}

export default async function HomePage() {
  const supabase = createClient();
  const headerStore = await headers();
  const host = headerStore
    .get("x-forwarded-host")
    ?.split(",")[0]
    ?.trim() || headerStore.get("host");
  const normalizedHost = host?.toLowerCase().replace(/:\d+$/, "") ?? null;

  if (normalizedHost) {
    const whiteLabelResult = await supabase.rpc(
      "get_public_salon_join_code_by_domain",
      {
        domain_input: normalizedHost,
      },
    );

    const whiteLabelJoinCode = String(whiteLabelResult.data ?? "").trim();
    if (whiteLabelJoinCode) {
      redirect(`/s/${whiteLabelJoinCode}`);
    }
  }

  const entryPath = await getAuthenticatedPanelEntryPath();

  if (entryPath) {
    redirect(entryPath);
  }

  const entryHref = buildEntryHref();

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerShell}>
          <Link href="/" className={styles.brand}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icon.png" alt="Logo Salon Fun" className={styles.brandLogo} />
            <div>
              <strong>Salon Fun</strong>
              <span>Painel para vender mais e perder menos clientes.</span>
            </div>
          </Link>

          <nav className={styles.nav} aria-label="Navegação pública">
            <Link href="/comecar">Começar</Link>
            <Link href={PUBLIC_BILLING_PATH}>Planos</Link>
            <Link href="/suporte">Suporte</Link>
            <Link href="/login">Entrar</Link>
          </nav>
        </div>
      </header>

      <main className={styles.shell}>
        <section className={styles.hero}>
          <div className={styles.heroCopy}>
            <span className={styles.eyebrow}>Feito para salão</span>
            <h1>
              Mais agenda. Menos enrolação.
              <span> Responda rápido e não perca cliente.</span>
            </h1>
            <p>
              Veja agenda, pedidos do app, receita e clientes para chamar em uma tela só.
            </p>

            <div className={styles.heroActions}>
              <Link href={entryHref} className={styles.primaryCta}>
                Criar conta
              </Link>
              <Link href={PUBLIC_BILLING_PATH} className={styles.secondaryCta}>
                Ver planos
              </Link>
            </div>

            <p className={styles.heroNote}>
              Simples, direto e pronto para usar.
            </p>
          </div>

          <aside className={styles.previewCard} aria-label="Leitura diária do produto">
            <div className={styles.previewHeader}>
              <span>Painel do dia</span>
              <strong>O que ver primeiro</strong>
            </div>

            <div className={styles.signalGrid}>
              {HERO_SIGNALS.map((signal) => (
                <article key={signal.label} className={styles.signalCard}>
                  <strong>{signal.label}</strong>
                  <p>{signal.note}</p>
                </article>
              ))}
            </div>

            <div className={styles.previewFoot}>
              <strong>Uma tela só</strong>
              <p>
                Agenda do dia, encaixes e clientes para chamar.
              </p>
            </div>
          </aside>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionIntro}>
            <span>O que importa</span>
            <h2>Salão pequeno quer vender e atender bem.</h2>
            <p>
              Por isso o sistema mostra o que fazer agora, sem tela demais.
            </p>
          </div>

          <div className={styles.pillarGrid}>
            {PRODUCT_PILLARS.map((pillar) => (
              <article key={pillar.title} className={styles.pillarCard}>
                <strong>{pillar.title}</strong>
                <p>{pillar.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.workflowSection}>
          <div className={styles.workflowIntro}>
            <span>Ativação simples</span>
            <h2>Criar conta, escolher plano e usar.</h2>
          </div>

          <div className={styles.workflowGrid}>
            {ACTIVATION_FLOW.map((step, index) => (
              <article key={step} className={styles.workflowCard}>
                <small>0{index + 1}</small>
                <p>{step}</p>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.ctaBand}>
          <div>
            <span className={styles.ctaEyebrow}>Pronto para usar</span>
            <h2>Comece sem enrolação.</h2>
            <p>
              Crie a conta, monte o salão e libere o painel.
            </p>
          </div>

          <div className={styles.ctaActions}>
            <Link href={entryHref} className={styles.primaryCta}>
              Criar conta
            </Link>
            <Link href="/suporte" className={styles.supportLink}>
              Falar com suporte
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
