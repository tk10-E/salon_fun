import Link from "next/link";

import { EmptyStateCard } from "@/components/EmptyStateCard";
import type { SmartScheduleSuggestion } from "@/components/SmartScheduleSuggestions";
import { formatCurrency, formatDateTime } from "@/lib/formatters";

type DashboardIntelligenceOverview = {
  tracked_due_now_customers: number;
  tracked_lapsed_customers: number;
  tracked_top_customers: number;
  tracked_top_services: number;
};

type LapsedCustomerInsight = {
  completed_visits: number;
  id: string;
  inactive_days: number;
  last_service_category: string | null;
  last_service_name: string;
  last_visit_at: string;
  name: string;
  status: "at_risk" | "due_now";
  total_spent: number | string;
};

type TopCustomerInsight = {
  completed_visits: number;
  id: string;
  last_visit_at: string | null;
  name: string;
  next_appointment_at: string | null;
  total_spent: number | string;
  upcoming_appointments: number;
};

type TopServiceInsight = {
  category: string | null;
  completed_appointments: number;
  id: string;
  last_booked_at: string | null;
  name: string;
  total_revenue: number | string;
  unique_customers: number;
};

type SalonIntelligencePanelProps = {
  lapsedCustomers: LapsedCustomerInsight[];
  overview: DashboardIntelligenceOverview;
  smartScheduleSuggestions: SmartScheduleSuggestion[];
  topCustomers: TopCustomerInsight[];
  topServices: TopServiceInsight[];
};

function formatMoney(value: number | string) {
  return formatCurrency(Number(value ?? 0));
}

function formatTimeRange(start: string, end: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(start))
    .concat(" - ")
    .concat(
      new Intl.DateTimeFormat("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(end)),
    );
}

export function SalonIntelligencePanel({
  lapsedCustomers,
  overview,
  smartScheduleSuggestions,
  topCustomers,
  topServices,
}: SalonIntelligencePanelProps) {
  const totalIdleMinutes = smartScheduleSuggestions.reduce(
    (accumulator, suggestion) => accumulator + suggestion.gap_minutes,
    0,
  );

  return (
    <section className="card content-card">
      <div className="section-heading">
        <div>
          <h2>Inteligência do salão</h2>
          <p className="muted">
            Um resumo realmente útil da operação: onde a agenda está vazando receita, quem esfriou,
            quem mais sustenta o caixa e o que mais gira no salão.
          </p>
        </div>
      </div>

      <div className="insights-grid" style={{ marginTop: 18 }}>
        <article className="card insight-card">
          <div className="insight-card__header">
            <div>
              <span className="eyebrow">Horários vazios</span>
              <h3>Janelas com chance real de venda</h3>
            </div>
            <div className="inline-actions">
              <span className="badge badge--pending">{smartScheduleSuggestions.length} encaixes</span>
              <span className="badge badge--soft">{totalIdleMinutes} min livres</span>
            </div>
          </div>

          {smartScheduleSuggestions.length === 0 ? (
            <EmptyStateCard
              eyebrow="Agenda encaixada"
              title="Nenhum horário estratégico vazio agora"
              description="Assim que surgir uma janela livre com serviço compatível, ela entra aqui."
            />
          ) : (
            <div className="row-list">
              {smartScheduleSuggestions.slice(0, 3).map((suggestion) => (
                <article key={`${suggestion.staff_member_id}-${suggestion.suggested_start}`} className="list-row">
                  <div className="list-row__content">
                    <h3>{suggestion.headline}</h3>
                    <p className="muted list-description">{suggestion.detail}</p>
                    <small className="list-meta">
                      {suggestion.staff_member_name} • {formatTimeRange(suggestion.suggested_start, suggestion.suggested_end)}
                    </small>
                    <small className="list-meta">
                      Serviço sugerido: {suggestion.suggested_service.name}
                      {suggestion.suggested_service.price != null
                        ? ` • ${formatMoney(suggestion.suggested_service.price)}`
                        : ""}
                    </small>
                  </div>
                  <div className="list-row__aside">
                    <span className="badge badge--soft">{suggestion.gap_minutes} min</span>
                  </div>
                </article>
              ))}
            </div>
          )}

          <div className="insight-card__footer">
            <Link href="/dashboard/appointments" className="secondary-button">
              Abrir agenda
            </Link>
          </div>
        </article>

        <article className="card insight-card">
          <div className="insight-card__header">
            <div>
              <span className="eyebrow">Clientes que não voltaram</span>
              <h3>Base esfriando sem agenda futura</h3>
            </div>
            <div className="inline-actions">
              <span className="badge badge--pending">{overview.tracked_lapsed_customers} clientes</span>
              <span className="badge badge--soft">{overview.tracked_due_now_customers} em winback</span>
            </div>
          </div>

          {lapsedCustomers.length === 0 ? (
            <EmptyStateCard
              eyebrow="Retenção em dia"
              title="Nenhum cliente crítico sem retorno"
              description="Quando alguém esfriar sem próxima agenda, o nome aparece aqui com contexto do último atendimento."
            />
          ) : (
            <div className="row-list">
              {lapsedCustomers.map((customer) => (
                <article key={customer.id} className="list-row">
                  <div className="list-row__content">
                    <h3>{customer.name}</h3>
                    <small className="list-meta">
                      Último atendimento: {customer.last_service_category ? `${customer.last_service_category} • ` : ""}
                      {customer.last_service_name}
                    </small>
                    <small className="list-meta">
                      {customer.inactive_days} dias sem voltar • {customer.completed_visits} visita
                      {customer.completed_visits === 1 ? "" : "s"} • última em {formatDateTime(customer.last_visit_at)}
                    </small>
                  </div>
                  <div className="list-row__aside">
                    <span className={customer.status === "due_now" ? "badge badge--pending" : "badge badge--soft"}>
                      {customer.status === "due_now" ? "Winback agora" : "Em risco"}
                    </span>
                    <span className="badge badge--confirmed">{formatMoney(customer.total_spent)}</span>
                  </div>
                </article>
              ))}
            </div>
          )}

          <div className="insight-card__footer">
            <Link href="/dashboard/benefits/automations" className="secondary-button">
              Ver retenção
            </Link>
          </div>
        </article>

        <article className="card insight-card">
          <div className="insight-card__header">
            <div>
              <span className="eyebrow">Top clientes</span>
              <h3>Quem mais sustenta o salão</h3>
            </div>
            <div className="inline-actions">
              <span className="badge badge--soft">{overview.tracked_top_customers} no ranking</span>
            </div>
          </div>

          {topCustomers.length === 0 ? (
            <EmptyStateCard
              eyebrow="Sem histórico ainda"
              title="O ranking aparece depois das primeiras visitas"
              description="Assim que o salão concluir atendimentos, os clientes mais valiosos entram neste painel."
            />
          ) : (
            <div className="row-list">
              {topCustomers.map((customer) => (
                <article key={customer.id} className="list-row">
                  <div className="list-row__content">
                    <h3>{customer.name}</h3>
                    <small className="list-meta">
                      {customer.completed_visits} visita{customer.completed_visits === 1 ? "" : "s"} concluída
                      {customer.completed_visits === 1 ? "" : "s"}
                      {customer.last_visit_at ? ` • última em ${formatDateTime(customer.last_visit_at)}` : ""}
                    </small>
                    <small className="list-meta">
                      {customer.upcoming_appointments > 0 && customer.next_appointment_at
                        ? `Já voltou a agendar para ${formatDateTime(customer.next_appointment_at)}`
                        : "Sem próxima agenda confirmada"}
                    </small>
                  </div>
                  <div className="list-row__aside">
                    {customer.upcoming_appointments > 0 ? (
                      <span className="badge badge--confirmed">Retorno marcado</span>
                    ) : null}
                    <span className="badge badge--soft">{formatMoney(customer.total_spent)}</span>
                  </div>
                </article>
              ))}
            </div>
          )}

          <div className="insight-card__footer">
            <Link href="/dashboard/customers?sort=spent" className="secondary-button">
              Abrir CRM
            </Link>
          </div>
        </article>

        <article className="card insight-card">
          <div className="insight-card__header">
            <div>
              <span className="eyebrow">Serviços mais vendidos</span>
              <h3>O que mais gira no caixa</h3>
            </div>
            <div className="inline-actions">
              <span className="badge badge--soft">{overview.tracked_top_services} destaques</span>
            </div>
          </div>

          {topServices.length === 0 ? (
            <EmptyStateCard
              eyebrow="Sem vendas concluídas"
              title="Os serviços entram aqui quando começarem a finalizar atendimentos"
              description="Quando houver histórico concluído, o ranking mostra volume, receita e clientes únicos por serviço."
            />
          ) : (
            <div className="row-list">
              {topServices.map((service) => (
                <article key={service.id} className="list-row">
                  <div className="list-row__content">
                    <h3>{service.name}</h3>
                    <small className="list-meta">
                      {service.category ? `${service.category} • ` : ""}
                      {service.completed_appointments} venda{service.completed_appointments === 1 ? "" : "s"} concluída
                      {service.completed_appointments === 1 ? "" : "s"}
                    </small>
                    <small className="list-meta">
                      {service.unique_customers} cliente{service.unique_customers === 1 ? "" : "s"} atendido
                      {service.unique_customers === 1 ? "" : "s"}
                      {service.last_booked_at ? ` • última em ${formatDateTime(service.last_booked_at)}` : ""}
                    </small>
                  </div>
                  <div className="list-row__aside">
                    <span className="badge badge--confirmed">{formatMoney(service.total_revenue)}</span>
                  </div>
                </article>
              ))}
            </div>
          )}

          <div className="insight-card__footer">
            <Link href="/dashboard/services" className="secondary-button">
              Ver catálogo
            </Link>
          </div>
        </article>
      </div>
    </section>
  );
}
