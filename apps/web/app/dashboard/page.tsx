import Link from "next/link";

import { EmptyStateCard } from "@/components/EmptyStateCard";
import { FlashMessage } from "@/components/FlashMessage";
import {
  buildSmartScheduleTargetDayLabel,
  SmartScheduleSuggestion,
  SmartScheduleSuggestions,
} from "@/components/SmartScheduleSuggestions";
import { requireOwnerSalon } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/formatters";

type AppointmentListItem = {
  id: string;
  date: string;
  status: "pending" | "confirmed" | "cancelled" | "completed";
  customers: { name: string } | { name: string }[] | null;
  services: { category: string | null; name: string } | { category: string | null; name: string }[] | null;
  staff_members: { name: string } | { name: string }[] | null;
};

type DashboardPageProps = {
  searchParams?: {
    message?: string;
    tone?: string;
  };
};

type SmartScheduleResponse = {
  target_day: string;
  timezone: string;
  slot_step_minutes: number;
  suggestions: SmartScheduleSuggestion[];
};

type GrowthAutomationSettings = {
  is_active: boolean;
  winback_inactive_days: number;
  winback_discount_percent: number;
  winback_title: string;
  winback_body_template: string;
  smart_rebook_is_active: boolean;
  smart_rebook_window_days: number;
  smart_rebook_title: string;
  smart_rebook_body_template: string;
  updated_at: string | null;
};

type GrowthAutomationOverview = {
  at_risk_customers: number;
  due_now_customers: number;
  smart_rebook_due_customers: number;
  winbacks_sent_last_30d: number;
  smart_rebooks_sent_last_30d: number;
  recovered_customers_last_30d: number;
};

type GrowthAutomationDashboardResponse = {
  settings: GrowthAutomationSettings;
  overview: GrowthAutomationOverview;
  recent_runs: Array<{
    id: string;
    automation_type: "winback_offer" | "smart_rebook_prompt";
    customer_name: string;
    sent_at: string;
    inactive_days: number;
    discount_percent: number;
    service_name: string;
    target_weekday: string | null;
    target_period: string | null;
    recovered: boolean;
    recovered_appointment_at: string | null;
  }>;
};

function formatAppointmentStatus(status: AppointmentListItem["status"]) {
  switch (status) {
    case "confirmed":
      return "Confirmado";
    case "completed":
      return "Atendido";
    case "cancelled":
      return "Cancelado";
    default:
      return "Pendente";
  }
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const { salon } = await requireOwnerSalon();
  const supabase = createClient();

  const [
    { count: servicesCount },
    { count: customersCount },
    { count: pendingCount },
    recentAppointmentsResult,
    growthAutomationResult,
    smartScheduleResult,
  ] =
    await Promise.all([
      supabase.from("services").select("*", { count: "exact", head: true }).eq("salon_id", salon.id),
      supabase.from("customers").select("*", { count: "exact", head: true }).eq("salon_id", salon.id),
      supabase
        .from("appointments")
        .select("*", { count: "exact", head: true })
        .eq("salon_id", salon.id)
        .eq("status", "pending"),
      supabase
        .from("appointments")
        .select("*,customers(name),services(category,name),staff_members(name)")
        .eq("salon_id", salon.id)
        .order("date", { ascending: true })
        .limit(6),
      supabase.rpc("get_salon_growth_automation_dashboard"),
      supabase.rpc("get_smart_schedule_opportunities", {}),
    ]);
  const smartSchedule = (smartScheduleResult.data ?? {
    target_day: new Date().toISOString().slice(0, 10),
    timezone: "America/Sao_Paulo",
    slot_step_minutes: salon.slot_step_minutes ?? 30,
    suggestions: [],
  }) as SmartScheduleResponse;
  const growthAutomation = (growthAutomationResult.data ?? {
    settings: {
      is_active: true,
      winback_inactive_days: 30,
      winback_discount_percent: 10,
      winback_title: "Sentimos sua falta 😄",
      winback_body_template:
        "Já faz {inactive_days} dias desde seu último {service_name}. Volte esta semana e agende com {discount}% OFF pelo app.",
      smart_rebook_is_active: true,
      smart_rebook_window_days: 4,
      smart_rebook_title: "Você sempre agenda {service_name} {habit_weekday} 👀",
      smart_rebook_body_template:
        "Seu próximo {service_name} está chegando. Quer deixar para {target_weekday} {target_period}? Se quiser, ainda dá para encaixar {combo_service_name}.",
      updated_at: null,
    },
    overview: {
      at_risk_customers: 0,
      due_now_customers: 0,
      winbacks_sent_last_30d: 0,
      smart_rebook_due_customers: 0,
      smart_rebooks_sent_last_30d: 0,
      recovered_customers_last_30d: 0,
    },
    recent_runs: [],
  }) as GrowthAutomationDashboardResponse;

  const recentAppointments = (recentAppointmentsResult.data ?? []) as AppointmentListItem[];

  return (
    <div className="page-grid">
      {searchParams?.message ? <FlashMessage message={searchParams.message} tone={searchParams.tone} /> : null}

      <section className="stats-grid">
        <article className="card metric-card metric-card--warm">
          <span className="eyebrow">Serviços</span>
          <p className="stat-value">{servicesCount ?? 0}</p>
          <p className="metric-note">Mantenha sua vitrine de atendimentos sempre pronta.</p>
        </article>
        <article className="card metric-card metric-card--soft">
          <span className="eyebrow">Clientes</span>
          <p className="stat-value">{customersCount ?? 0}</p>
          <p className="metric-note">Acompanhe quem já entrou na rotina do seu salão.</p>
        </article>
        <article className="card metric-card metric-card--accent">
          <span className="eyebrow">Pendentes</span>
          <p className="stat-value">{pendingCount ?? 0}</p>
          <p className="metric-note">Pedidos que ainda precisam da sua confirmação.</p>
        </article>
        <article className="card metric-card metric-card--soft">
          <span className="eyebrow">Clientes em risco</span>
          <p className="stat-value">{growthAutomation.overview.at_risk_customers ?? 0}</p>
          <p className="metric-note">
            Clientes sem próxima agenda que já estão esfriando perto da janela de retorno.
          </p>
        </article>
        <article className="card metric-card metric-card--warm">
          <span className="eyebrow">Winbacks prontos</span>
          <p className="stat-value">{growthAutomation.overview.due_now_customers ?? 0}</p>
          <p className="metric-note">
            Clientes que já entraram na régua de reativação configurada para este salão.
          </p>
        </article>
        <article className="card metric-card metric-card--soft">
          <span className="eyebrow">Rebooks inteligentes</span>
          <p className="stat-value">{growthAutomation.overview.smart_rebook_due_customers ?? 0}</p>
          <p className="metric-note">
            Clientes com padrão claro de retorno e janela ideal abrindo para reservar antes de esfriar.
          </p>
        </article>
        <article className="card metric-card metric-card--accent">
          <span className="eyebrow">Recuperados em 30 dias</span>
          <p className="stat-value">{growthAutomation.overview.recovered_customers_last_30d ?? 0}</p>
          <p className="metric-note">
            Clientes que voltaram a agendar depois dos pushes automáticos mais recentes.
          </p>
        </article>
      </section>

      <section className="card content-card">
        <div className="section-heading">
          <div>
            <h2>Recuperação automática</h2>
            <p className="muted">
              O painel e o app já estão lendo a mesma regra comercial. Quando um cliente some, o sistema entra com incentivo automático e o resultado aparece aqui.
            </p>
          </div>

          <Link href="/dashboard/benefits/automations" className="secondary-button">
            Ajustar automação
          </Link>
        </div>

        <div className="stats-grid" style={{ marginTop: 18 }}>
          <article className="card metric-card metric-card--soft">
            <span className="eyebrow">Automação</span>
            <p className="stat-value">
              {growthAutomation.settings.is_active || growthAutomation.settings.smart_rebook_is_active ? "Ligada" : "Pausada"}
            </p>
            <p className="metric-note">
              Hoje o painel trabalha com rebook inteligente até {growthAutomation.settings.smart_rebook_window_days} dias antes da janela ideal e winback após {growthAutomation.settings.winback_inactive_days} dias com {growthAutomation.settings.winback_discount_percent}% de incentivo.
            </p>
          </article>
          <article className="card metric-card metric-card--soft">
            <span className="eyebrow">Rebooks enviados</span>
            <p className="stat-value">{growthAutomation.overview.smart_rebooks_sent_last_30d ?? 0}</p>
            <p className="metric-note">Clientes abordados com push comportamental antes do ciclo ideal vencer.</p>
          </article>
          <article className="card metric-card metric-card--warm">
            <span className="eyebrow">Winbacks enviados</span>
            <p className="stat-value">{growthAutomation.overview.winbacks_sent_last_30d ?? 0}</p>
            <p className="metric-note">Campanhas automáticas disparadas para clientes sem retorno nos últimos 30 dias.</p>
          </article>
          <article className="card metric-card metric-card--accent">
            <span className="eyebrow">Último ajuste</span>
            <p className="stat-value">
              {growthAutomation.settings.updated_at ? "Personalizada" : "Padrão"}
            </p>
            <p className="metric-note">
              {growthAutomation.settings.updated_at
                ? `Configurada em ${formatDateTime(growthAutomation.settings.updated_at)}.`
                : "Ainda está usando a regra padrão do sistema."}{" "}
              Se mudar no painel, o app do cliente passa a refletir a mesma regra.
            </p>
          </article>
        </div>

        <div className="row-list" style={{ marginTop: 18 }}>
          {!growthAutomation.recent_runs.length ? (
            <EmptyStateCard
              eyebrow="Sem disparos ainda"
              title="A régua ainda não acionou nenhum push comercial"
              description="Assim que algum cliente entrar na janela ideal de retorno ou virar winback, as campanhas automáticas aparecem aqui."
            />
          ) : (
            growthAutomation.recent_runs.slice(0, 4).map((run) => (
              <article key={run.id} className="list-row">
                <div className="list-row__content">
                  <div className="inline-actions" style={{ marginBottom: 8 }}>
                    <span className={run.recovered ? "badge badge--confirmed" : "badge badge--pending"}>
                      {run.recovered ? "Cliente recuperado" : "Aguardando retorno"}
                    </span>
                    <span className="badge badge--soft">
                      {run.automation_type === "smart_rebook_prompt" ? "Rebook inteligente" : `${run.discount_percent}% OFF`}
                    </span>
                  </div>
                  <h3>{run.customer_name}</h3>
                  <p className="muted list-description">
                    {run.automation_type === "smart_rebook_prompt"
                      ? `Disparo comportamental para remarcar ${run.service_name}${run.target_weekday ? ` em ${run.target_weekday}` : ""}${run.target_period ? ` ${run.target_period}` : ""}.`
                      : `Disparo automático para reativar ${run.customer_name} após ${run.inactive_days} dias sem voltar ao salão.`}
                  </p>
                  <small className="list-meta">
                    Baseado no serviço {run.service_name} • enviado em {formatDateTime(run.sent_at)}
                  </small>
                  {run.recovered_appointment_at ? (
                    <small className="list-meta">
                      Novo agendamento registrado para {formatDateTime(run.recovered_appointment_at)}
                    </small>
                  ) : null}
                </div>
              </article>
            ))
          )}
        </div>
      </section>

      <SmartScheduleSuggestions
        suggestions={smartSchedule.suggestions ?? []}
        targetDayLabel={buildSmartScheduleTargetDayLabel(smartSchedule.target_day)}
      />

      <section className="card content-card">
        <div className="section-heading">
          <div>
            <h2>Próximos agendamentos</h2>
            <p className="muted">Os pedidos entram como pendentes e podem ser confirmados no painel.</p>
          </div>
        </div>

        <div className="table-list" style={{ marginTop: 16 }}>
          {recentAppointments.length === 0 ? (
            <EmptyStateCard
              eyebrow="Agenda livre"
              title="Nenhum agendamento por enquanto"
              description="Assim que seus clientes começarem a marcar horários, os próximos atendimentos vão aparecer aqui."
            />
          ) : (
            recentAppointments.map((appointment) => {
              const customer = Array.isArray(appointment.customers)
                ? appointment.customers[0]
                : appointment.customers;
              const service = Array.isArray(appointment.services)
                ? appointment.services[0]
                : appointment.services;
              const staffMember = Array.isArray(appointment.staff_members)
                ? appointment.staff_members[0]
                : appointment.staff_members;

              return (
                <div key={appointment.id} className="list-row">
                  <div className="list-row__content">
                    <h3>{customer?.name ?? "Cliente"}</h3>
                    <small className="list-meta">
                      {service?.category ? `${service.category} • ` : ""}
                      {service?.name ?? "Serviço"} • {formatDateTime(appointment.date)}
                    </small>
                    <small className="list-meta">Profissional: {staffMember?.name ?? "Equipe do salão"}</small>
                  </div>
                  <div className="list-row__aside">
                    <span className={`badge badge--${appointment.status}`}>{formatAppointmentStatus(appointment.status)}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}
