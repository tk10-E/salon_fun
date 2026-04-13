import { EmptyStateCard } from "@/components/EmptyStateCard";
import { FlashMessage } from "@/components/FlashMessage";
import { DashboardWorkspaceHero } from "@/components/DashboardWorkspaceHero";
import { sendAppointmentWhatsAppAction } from "@/app/actions";
import {
  createManagementAppointmentAction,
  updateManagementAppointmentAction,
  updateManagementAppointmentStatusAction,
} from "@/app/_actions/management";
import { requireOwnerSalon } from "@/lib/auth";
import {
  APPOINTMENT_STATUS_OPTIONS,
  buildFilterHref,
  formatAppointmentStatusLabel,
  formatDateInput,
  formatPaymentMethodLabel,
  formatTimeInput,
  getAppointmentStatusBadgeClass,
  getLocalDateKey,
  loadManagementAppointments,
  loadManagementSelectOptions,
} from "@/lib/management";
import { formatCurrency } from "@/lib/formatters";

type AgendamentosPageProps = {
  searchParams?: Promise<{
    day?: string;
    professionalId?: string;
    status?: string;
    message?: string;
    tone?: string;
  }>;
};

export default async function AgendamentosPage({
  searchParams: searchParamsPromise,
}: AgendamentosPageProps) {
  const searchParams = await searchParamsPromise;
  const { salon } = await requireOwnerSalon();
  const whatsappAutomationReady = salon.whatsapp_dispatch_enabled === true;
  const timeZone = salon.timezone ?? "America/Sao_Paulo";
  const selectedDay =
    searchParams?.day && /^\d{4}-\d{2}-\d{2}$/.test(searchParams.day)
      ? searchParams.day
      : getLocalDateKey(new Date(), timeZone);
  const selectedProfessionalId = searchParams?.professionalId ?? "";
  const selectedStatus = searchParams?.status ?? "";
  const currentPath = buildFilterHref(
    "/dashboard/gestao/agendamentos",
    searchParams,
    {},
  );

  const [appointmentsData, options] = await Promise.all([
    loadManagementAppointments({
      salonId: salon.id,
      timeZone,
      dayKey: selectedDay,
      professionalId: selectedProfessionalId || undefined,
      status: selectedStatus || undefined,
    }),
    loadManagementSelectOptions(salon.id),
  ]);

  const selectedProfessionalLabel =
    options.professionals.find((item) => item.id === selectedProfessionalId)
      ?.label ?? "Toda a equipe";
  const selectedStatusLabel =
    APPOINTMENT_STATUS_OPTIONS.find((item) => item.value === selectedStatus)
      ?.label ?? "Todos os status";
  const selectedDayLabel = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    timeZone,
  }).format(new Date(`${selectedDay}T12:00:00.000Z`));
  const projectedRevenue = appointmentsData.items.reduce(
    (total, appointment) =>
      appointment.status === "cancelled" || appointment.status === "no_show"
        ? total
        : total + appointment.servicePrice,
    0,
  );
  const paidRevenue = appointmentsData.items.reduce(
    (total, appointment) => total + (appointment.payment?.amount ?? 0),
    0,
  );
  const nextOpenAppointment =
    appointmentsData.items.find(
      (appointment) =>
        appointment.status === "pending" || appointment.status === "confirmed",
    ) ?? null;

  return (
    <div className="page-grid workspace-page management-page management-page--appointments">
      {searchParams?.message ? (
        <FlashMessage message={searchParams.message} tone={searchParams.tone} />
      ) : null}

      <DashboardWorkspaceHero
        eyebrow="Agenda do salão"
        title={`Agenda de ${selectedDayLabel}`}
        description="Organize encaixes, confirme horários e feche o dia com leitura clara da operação."
        highlight={{
          label: "Movimento previsto",
          value: formatCurrency(projectedRevenue),
          note: appointmentsData.items.length
            ? `${appointmentsData.items.length} horário(s) no recorte atual.`
            : "Nenhum horário no recorte atual.",
        }}
        signals={[
          {
            label: "Profissional",
            value: selectedProfessionalLabel,
            tone: "soft",
          },
          {
            label: "Status",
            value: selectedStatusLabel,
            tone: selectedStatus ? "accent" : "soft",
          },
          {
            label: "Recebido",
            value: formatCurrency(paidRevenue),
            tone: paidRevenue > 0 ? "success" : "soft",
          },
        ]}
        stats={[
          {
            label: "Agendados",
            value: appointmentsData.counts.pending,
            note: "Aguardando confirmação.",
            tone: appointmentsData.counts.pending ? "warm" : "soft",
          },
          {
            label: "Confirmados",
            value: appointmentsData.counts.confirmed,
            note: "Horários prontos para atender.",
            tone: appointmentsData.counts.confirmed ? "accent" : "soft",
          },
          {
            label: "Concluídos",
            value: appointmentsData.counts.completed,
            note: "Atendimentos fechados no dia.",
            tone: appointmentsData.counts.completed ? "success" : "soft",
          },
          {
            label: "Faltas + cancelados",
            value:
              appointmentsData.counts.no_show + appointmentsData.counts.cancelled,
            note: "Perdas do recorte atual.",
            tone:
              appointmentsData.counts.no_show + appointmentsData.counts.cancelled
                ? "danger"
                : "soft",
          },
        ]}
        aside={
          <div className="management-hero-summary">
            <h3>Leitura rápida</h3>
            <p>
              {nextOpenAppointment
                ? `Próximo horário: ${formatTimeInput(
                    nextOpenAppointment.date,
                    timeZone,
                  )} com ${nextOpenAppointment.customerName}.`
                : "Sem próximo horário pendente ou confirmado neste recorte."}
            </p>

            <div className="management-hero-summary__grid">
              <article>
                <span>Receita prevista</span>
                <strong>{formatCurrency(projectedRevenue)}</strong>
              </article>
              <article>
                <span>Receita recebida</span>
                <strong>{formatCurrency(paidRevenue)}</strong>
              </article>
              <article>
                <span>Equipe no filtro</span>
                <strong>{selectedProfessionalLabel}</strong>
              </article>
              <article>
                <span>Recorte ativo</span>
                <strong>{selectedStatusLabel}</strong>
              </article>
            </div>
          </div>
        }
      />

      <section className="management-grid management-grid--two">
        <article className="card content-card management-card">
          <div className="section-heading">
            <div>
              <h2>Novo agendamento</h2>
              <p className="muted">Cadastro rápido com cliente, profissional e serviço.</p>
            </div>
          </div>

          <form action={createManagementAppointmentAction} className="simple-form">
            <input type="hidden" name="returnPath" value={currentPath} />

            <div className="field">
              <label htmlFor="appointment-client">Cliente</label>
              <select id="appointment-client" name="clientId" required>
                <option value="">Selecione</option>
                {options.clients.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                    {item.secondary ? ` • ${item.secondary}` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="split-grid">
              <div className="field">
                <label htmlFor="appointment-professional">Profissional</label>
                <select id="appointment-professional" name="professionalId" required>
                  <option value="">Selecione</option>
                  {options.professionals.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label htmlFor="appointment-service">Serviço</label>
                <select id="appointment-service" name="serviceId" required>
                  <option value="">Selecione</option>
                  {options.services.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="split-grid">
              <div className="field">
                <label htmlFor="appointment-date">Data</label>
                <input
                  id="appointment-date"
                  name="date"
                  type="date"
                  defaultValue={selectedDay}
                  required
                />
              </div>

              <div className="field">
                <label htmlFor="appointment-time">Horário</label>
                <input id="appointment-time" name="time" type="time" required />
              </div>
            </div>

            <div className="field">
              <label htmlFor="appointment-notes">Observações</label>
              <textarea
                id="appointment-notes"
                name="notes"
                rows={3}
                placeholder="Informações rápidas sobre o atendimento."
              />
            </div>

            <button type="submit" className="primary-button">
              Salvar agendamento
            </button>
          </form>
        </article>

        <article className="card content-card management-card">
          <div className="section-heading">
            <div>
              <h2>Filtro da agenda</h2>
              <p className="muted">Recorte por dia, profissional e status.</p>
            </div>
          </div>

          <form method="get" className="simple-form">
            <div className="field">
              <label htmlFor="filter-day">Dia</label>
              <input
                id="filter-day"
                name="day"
                type="date"
                defaultValue={selectedDay}
                required
              />
            </div>

            <div className="field">
              <label htmlFor="filter-professional">Profissional</label>
              <select
                id="filter-professional"
                name="professionalId"
                defaultValue={selectedProfessionalId}
              >
                <option value="">Todos</option>
                {options.professionals.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label htmlFor="filter-status">Status</label>
              <select id="filter-status" name="status" defaultValue={selectedStatus}>
                <option value="">Todos</option>
                {APPOINTMENT_STATUS_OPTIONS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="inline-actions">
              <button type="submit" className="secondary-button">
                Aplicar filtro
              </button>
              <a href="/dashboard/gestao/agendamentos" className="secondary-button">
                Limpar
              </a>
            </div>
          </form>
        </article>
      </section>

      <section className="card content-card management-card">
        <div className="section-heading">
          <div>
            <h2>Agenda do dia</h2>
            <p className="muted">
              {appointmentsData.items.length
                ? `${appointmentsData.items.length} horário(s) encontrados`
                : "Nenhum horário encontrado"}
            </p>
          </div>
        </div>

        {!appointmentsData.items.length ? (
          <EmptyStateCard
            eyebrow="Agenda vazia"
            title="Nenhum agendamento nesse recorte"
            description="Ajuste o filtro ou cadastre um novo horário para começar."
          />
        ) : (
          <div className="management-appointment-list">
            {appointmentsData.items.map((appointment) => (
              <article key={appointment.id} className="management-appointment-card">
                <div className="management-appointment-card__header">
                  <div>
                    <strong>
                      {formatTimeInput(appointment.date, timeZone)} •{" "}
                      {appointment.customerName}
                    </strong>
                    <p className="muted">
                      {appointment.serviceName} com {appointment.professionalName}
                    </p>
                  </div>
                  <span
                    className={`badge ${getAppointmentStatusBadgeClass(
                      appointment.status,
                    )}`}
                  >
                    {formatAppointmentStatusLabel(appointment.status)}
                  </span>
                </div>

                <div className="management-appointment-card__meta">
                  <span>Duração prevista até {formatTimeInput(appointment.ends_at, timeZone)}</span>
                  <span>Valor base {formatCurrency(appointment.servicePrice)}</span>
                  <span>
                    {appointment.payment
                      ? `Pago via ${formatPaymentMethodLabel(
                          appointment.payment.paymentMethod,
                        )}`
                      : "Sem pagamento registrado"}
                  </span>
                </div>

                {appointment.notes ? (
                  <p className="management-inline-note">{appointment.notes}</p>
                ) : null}

                {appointment.status === "pending" ||
                appointment.status === "confirmed" ? (
                  <section className="management-appointment-card__whatsapp">
                    <div className="management-appointment-card__whatsapp-copy">
                      <strong>WhatsApp do atendimento</strong>
                      <p className="muted">
                        {whatsappAutomationReady
                          ? "Envie confirmação, lembrete ou reagendamento sem sair da agenda."
                          : "Ative o canal técnico do WhatsApp nas configurações para usar os envios automáticos da agenda."}
                      </p>
                    </div>

                    {whatsappAutomationReady ? (
                      <div className="inline-actions">
                        {appointment.status === "pending" ? (
                          <form action={sendAppointmentWhatsAppAction}>
                            <input
                              type="hidden"
                              name="appointmentId"
                              value={appointment.id}
                            />
                            <input
                              type="hidden"
                              name="mode"
                              value="confirmation"
                            />
                            <button type="submit" className="secondary-button">
                              Enviar confirmação
                            </button>
                          </form>
                        ) : null}

                        {appointment.status === "confirmed" ? (
                          <form action={sendAppointmentWhatsAppAction}>
                            <input
                              type="hidden"
                              name="appointmentId"
                              value={appointment.id}
                            />
                            <input
                              type="hidden"
                              name="mode"
                              value="reminder"
                            />
                            <button type="submit" className="secondary-button">
                              Enviar lembrete
                            </button>
                          </form>
                        ) : null}

                        <form action={sendAppointmentWhatsAppAction}>
                          <input
                            type="hidden"
                            name="appointmentId"
                            value={appointment.id}
                          />
                          <input
                            type="hidden"
                            name="mode"
                            value="reschedule"
                          />
                          <button type="submit" className="secondary-button">
                            Pedir reagendamento
                          </button>
                        </form>
                      </div>
                    ) : (
                      <div className="inline-actions">
                        <a
                          href="/dashboard/whatsapp"
                          className="secondary-button"
                        >
                          Configurar WhatsApp
                        </a>
                      </div>
                    )}
                  </section>
                ) : null}

                <div className="inline-actions">
                  {appointment.status === "pending" ? (
                    <form action={updateManagementAppointmentStatusAction}>
                      <input type="hidden" name="returnPath" value={currentPath} />
                      <input type="hidden" name="appointmentId" value={appointment.id} />
                      <input type="hidden" name="status" value="confirmed" />
                      <button type="submit" className="secondary-button">
                        Confirmar
                      </button>
                    </form>
                  ) : null}

                  {appointment.status !== "completed" &&
                  appointment.status !== "cancelled" ? (
                    <form action={updateManagementAppointmentStatusAction}>
                      <input type="hidden" name="returnPath" value={currentPath} />
                      <input type="hidden" name="appointmentId" value={appointment.id} />
                      <input type="hidden" name="status" value="completed" />
                      <button type="submit" className="success-button">
                        Concluir
                      </button>
                    </form>
                  ) : null}

                  {appointment.status !== "completed" &&
                  appointment.status !== "cancelled" &&
                  appointment.status !== "no_show" ? (
                    <form action={updateManagementAppointmentStatusAction}>
                      <input type="hidden" name="returnPath" value={currentPath} />
                      <input type="hidden" name="appointmentId" value={appointment.id} />
                      <input type="hidden" name="status" value="no_show" />
                      <button type="submit" className="secondary-button">
                        Marcar falta
                      </button>
                    </form>
                  ) : null}
                </div>

                {appointment.status !== "cancelled" &&
                appointment.status !== "completed" ? (
                  <form
                    action={updateManagementAppointmentStatusAction}
                    className="management-inline-form"
                  >
                    <input type="hidden" name="returnPath" value={currentPath} />
                    <input type="hidden" name="appointmentId" value={appointment.id} />
                    <input type="hidden" name="status" value="cancelled" />
                    <input
                      name="cancellationReason"
                      placeholder="Motivo do cancelamento"
                    />
                    <button type="submit" className="danger-button">
                      Cancelar
                    </button>
                  </form>
                ) : null}

                {appointment.status === "pending" ||
                appointment.status === "confirmed" ? (
                  <details className="management-details">
                    <summary>Editar horário</summary>

                    <form
                      action={updateManagementAppointmentAction}
                      className="simple-form"
                    >
                      <input type="hidden" name="returnPath" value={currentPath} />
                      <input
                        type="hidden"
                        name="appointmentId"
                        value={appointment.id}
                      />

                      <div className="field">
                        <label>Cliente</label>
                        <select name="clientId" defaultValue={appointment.customer_id} required>
                          {options.clients.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="split-grid">
                        <div className="field">
                          <label>Profissional</label>
                          <select
                            name="professionalId"
                            defaultValue={appointment.staff_member_id}
                            required
                          >
                            {options.professionals.map((item) => (
                              <option key={item.id} value={item.id}>
                                {item.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="field">
                          <label>Serviço</label>
                          <select
                            name="serviceId"
                            defaultValue={appointment.service_id}
                            required
                          >
                            {options.services.map((item) => (
                              <option key={item.id} value={item.id}>
                                {item.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="split-grid">
                        <div className="field">
                          <label>Data</label>
                          <input
                            name="date"
                            type="date"
                            defaultValue={formatDateInput(appointment.date, timeZone)}
                            required
                          />
                        </div>
                        <div className="field">
                          <label>Horário</label>
                          <input
                            name="time"
                            type="time"
                            defaultValue={formatTimeInput(appointment.date, timeZone)}
                            required
                          />
                        </div>
                      </div>

                      <div className="field">
                        <label>Observações</label>
                        <textarea
                          name="notes"
                          rows={3}
                          defaultValue={appointment.notes ?? ""}
                        />
                      </div>

                      <button type="submit" className="primary-button">
                        Salvar alterações
                      </button>
                    </form>
                  </details>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
