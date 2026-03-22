import {
  createStaffBlockAction,
  createStaffMemberAction,
  deleteStaffMemberAction,
  deleteStaffBlockAction,
  offboardStaffMemberAction,
  toggleStaffMemberStatusAction,
  updateStaffBusinessHoursAction,
  updateStaffMemberAssignmentsAction,
} from "@/app/actions";
import { EmptyStateCard } from "@/components/EmptyStateCard";
import { FlashMessage } from "@/components/FlashMessage";
import { requireOwnerSalon } from "@/lib/auth";
import { formatDateTime } from "@/lib/formatters";
import { WEEKDAY_OPTIONS, formatBusinessTime } from "@/lib/schedule";
import { createClient } from "@/lib/supabase/server";

type TeamPageProps = {
  searchParams?: {
    message?: string;
    tone?: string;
  };
};

type ServiceRow = {
  id: string;
  name: string;
};

type StaffMemberRow = {
  id: string;
  name: string;
  role: string | null;
  is_active: boolean;
  is_default: boolean;
  staff_service_assignments:
    | {
        service_id: string;
        services: { id: string; name: string } | { id: string; name: string }[] | null;
      }[]
    | null;
};

type StaffBlockRow = {
  id: string;
  starts_at: string;
  ends_at: string;
  reason: string | null;
  staff_members: { name: string } | { name: string }[] | null;
};

type StaffBusinessHoursRow = {
  staff_member_id: string;
  weekday: number;
  is_open: boolean;
  opens_at: string | null;
  closes_at: string | null;
};

type SalonBusinessHoursRow = {
  weekday: number;
  is_open: boolean;
  opens_at: string | null;
  closes_at: string | null;
};

export default async function TeamPage({ searchParams }: TeamPageProps) {
  const { salon } = await requireOwnerSalon();
  const supabase = createClient();
  const now = new Date().toISOString();

  const [{ data: services }, { data: staffMembers }, { data: blocks }, { data: salonBusinessHours }] = await Promise.all([
    supabase.from("services").select("id, name").eq("salon_id", salon.id).order("name"),
    supabase
      .from("staff_members")
      .select("id, name, role, is_active, is_default, staff_service_assignments(service_id, services(id, name))")
      .eq("salon_id", salon.id)
      .order("name"),
    supabase
      .from("staff_blocks")
      .select("id, starts_at, ends_at, reason, staff_members(name)")
      .eq("salon_id", salon.id)
      .gte("ends_at", now)
      .order("starts_at", { ascending: true }),
    supabase
      .from("salon_business_hours")
      .select("weekday, is_open, opens_at, closes_at")
      .eq("salon_id", salon.id)
      .order("weekday"),
  ]);

  const safeServices = (services ?? []) as ServiceRow[];
  const safeStaffMembers = (staffMembers ?? []) as StaffMemberRow[];
  const safeBlocks = (blocks ?? []) as StaffBlockRow[];
  const baseBusinessHoursMap = new Map(
    ((salonBusinessHours ?? []) as SalonBusinessHoursRow[]).map((entry) => [entry.weekday, entry]),
  );
  const { data: staffBusinessHours } = safeStaffMembers.length
    ? await supabase
        .from("staff_business_hours")
        .select("staff_member_id, weekday, is_open, opens_at, closes_at")
        .in(
          "staff_member_id",
          safeStaffMembers.map((staffMember) => staffMember.id),
        )
        .order("weekday")
    : { data: [] as StaffBusinessHoursRow[] };
  const staffBusinessHoursMap = new Map<string, Map<number, StaffBusinessHoursRow>>();

  for (const entry of ((staffBusinessHours ?? []) as StaffBusinessHoursRow[])) {
    const current = staffBusinessHoursMap.get(entry.staff_member_id) ?? new Map<number, StaffBusinessHoursRow>();
    current.set(entry.weekday, entry);
    staffBusinessHoursMap.set(entry.staff_member_id, current);
  }

  const activeStaffMembers = safeStaffMembers.filter((staffMember) => staffMember.is_active);

  return (
    <div className="page-grid">
      {searchParams?.message ? <FlashMessage message={searchParams.message} tone={searchParams.tone} /> : null}

      <div className="two-column-grid">
        <section className="card content-card">
          <div className="section-heading">
            <div>
              <h2>Equipe do salão</h2>
              <p className="muted">
                Defina quem atende cada frente do negócio, como cabelo, unhas, sobrancelhas, cílios,
                maquiagem, depilação e outros cuidados.
              </p>
            </div>
          </div>

          <div className="team-member-list" style={{ marginTop: 16 }}>
            {!safeStaffMembers.length ? (
              <EmptyStateCard
                eyebrow="Equipe vazia"
                title="Nenhum profissional cadastrado"
                description="Crie o primeiro profissional para distribuir serviços e liberar novos horários no app."
              />
            ) : (
              safeStaffMembers.map((staffMember) => {
                const assignedServiceIds = new Set(
                  (staffMember.staff_service_assignments ?? []).map((assignment) => assignment.service_id),
                );
                const assignedCount = assignedServiceIds.size;
                const replacementOptions = activeStaffMembers.filter(
                  (candidate) => candidate.id !== staffMember.id,
                );

                return (
                  <article key={staffMember.id} className="team-member-card">
                    <div className="team-member-card__header">
                      <div>
                        <h3>{staffMember.name}</h3>
                        <p className="muted">{staffMember.role || "Atendimento do salão"}</p>
                        <small className="list-meta">
                          {staffMember.is_default ? "Profissional inicial do sistema" : "Profissional adicional"}
                        </small>
                      </div>

                      <div className="inline-actions">
                        <span className={`badge ${staffMember.is_active ? "badge--confirmed" : "badge--cancelled"}`}>
                          {staffMember.is_active ? "ativo" : "pausado"}
                        </span>

                        <form action={toggleStaffMemberStatusAction}>
                          <input type="hidden" name="staffMemberId" value={staffMember.id} />
                          <input type="hidden" name="isActive" value={staffMember.is_active ? "false" : "true"} />
                          <button type="submit" className={staffMember.is_active ? "secondary-button" : "success-button"}>
                            {staffMember.is_active ? "Pausar" : "Reativar"}
                          </button>
                        </form>

                        {!staffMember.is_default ? (
                          <form action={deleteStaffMemberAction}>
                            <input type="hidden" name="staffMemberId" value={staffMember.id} />
                            <button type="submit" className="danger-button">
                              Remover
                            </button>
                          </form>
                        ) : null}
                      </div>
                    </div>

                    <div className="team-member-card__body">
                      <p className="muted">
                        {assignedCount === 0
                          ? "Sem serviços vinculados."
                          : `${assignedCount} ${assignedCount === 1 ? "serviço vinculado" : "serviços vinculados"}.`}
                      </p>

                      {!staffMember.is_default ? (
                        <p className="muted" style={{ marginTop: 8 }}>
                          Se esse profissional saiu do salão, você pode removê-lo daqui. Quando existir histórico ou
                          agendamento vinculado, o painel bloqueia a exclusão para preservar a operação.
                        </p>
                      ) : null}

                      {!staffMember.is_default ? (
                        <details
                          style={{
                            marginTop: 16,
                            paddingTop: 16,
                            borderTop: "1px solid #E7D8C9",
                          }}
                        >
                          <summary
                            style={{
                              cursor: "pointer",
                              fontWeight: 700,
                              color: "#2F231C",
                            }}
                          >
                            Desligar do salão e tratar agenda futura
                          </summary>

                          <form action={offboardStaffMemberAction} className="form-grid" style={{ marginTop: 14 }}>
                            <input type="hidden" name="staffMemberId" value={staffMember.id} />

                            <div className="field">
                              <label htmlFor={`replacement-${staffMember.id}`}>Profissional que recebe a agenda futura</label>
                              <select id={`replacement-${staffMember.id}`} name="replacementStaffMemberId" defaultValue="">
                                <option value="">Sem troca automática</option>
                                {replacementOptions.map((candidate) => (
                                  <option key={candidate.id} value={candidate.id}>
                                    {candidate.name}
                                  </option>
                                ))}
                              </select>
                              <small className="list-meta">
                                Se houver horários futuros pendentes ou confirmados, escolher outro profissional aqui evita
                                retrabalho manual na agenda.
                              </small>
                            </div>

                            {!replacementOptions.length ? (
                              <p className="muted">
                                Não existe outro profissional ativo para receber a agenda. Se esse profissional ainda tiver
                                horários futuros, cadastre ou reative outro membro da equipe antes de desligar.
                              </p>
                            ) : null}

                            <div className="inline-actions">
                              <button type="submit" className="danger-button">
                                Desligar profissional
                              </button>
                            </div>
                          </form>
                        </details>
                      ) : null}

                      {!safeServices.length ? (
                        <EmptyStateCard
                          eyebrow="Sem serviços"
                          title="Cadastre os serviços primeiro"
                          description="Assim que o salão tiver serviços, você poderá distribuir cada um entre os profissionais."
                        />
                      ) : (
                        <form action={updateStaffMemberAssignmentsAction} className="form-grid">
                          <input type="hidden" name="staffMemberId" value={staffMember.id} />

                          <div className="check-grid">
                            {safeServices.map((service) => (
                              <label key={service.id} className="check-chip">
                                <input
                                  type="checkbox"
                                  name="serviceIds"
                                  value={service.id}
                                  defaultChecked={assignedServiceIds.has(service.id)}
                                />
                                <span>{service.name}</span>
                              </label>
                            ))}
                          </div>

                          <div className="inline-actions">
                            <button type="submit" className="primary-button">
                              Salvar serviços
                            </button>
                          </div>
                        </form>
                      )}

                      <form action={updateStaffBusinessHoursAction} className="form-grid" style={{ marginTop: 18 }}>
                        <input type="hidden" name="staffMemberId" value={staffMember.id} />

                        <div
                          style={{
                            paddingTop: 18,
                            borderTop: "1px solid #E7D8C9",
                            display: "grid",
                            gap: 14,
                          }}
                        >
                          <div>
                            <h4 style={{ margin: 0, color: "#2F231C", fontSize: 17 }}>Agenda desse profissional</h4>
                            <p className="muted" style={{ marginTop: 6 }}>
                              Esses horários alimentam o app do cliente. Se o profissional não atende em um período,
                              esse horário deixa de aparecer para reserva.
                            </p>
                          </div>

                          <div className="schedule-week-grid">
                            {WEEKDAY_OPTIONS.map((weekday) => {
                              const staffSchedule = staffBusinessHoursMap.get(staffMember.id)?.get(weekday.value);
                              const baseSchedule = baseBusinessHoursMap.get(weekday.value);
                              const isOpen = staffSchedule?.is_open ?? baseSchedule?.is_open ?? weekday.value !== 0;
                              const opensAt = formatBusinessTime(staffSchedule?.opens_at ?? baseSchedule?.opens_at);
                              const closesAt = formatBusinessTime(staffSchedule?.closes_at ?? baseSchedule?.closes_at);

                              return (
                                <div key={`${staffMember.id}-${weekday.value}`} className="schedule-day-row">
                                  <div className="schedule-day-row__title">
                                    <strong>{weekday.label}</strong>
                                    <label className="toggle-pill">
                                      <input
                                        type="checkbox"
                                        name={`staffIsOpen_${weekday.value}`}
                                        defaultChecked={isOpen}
                                      />
                                      <span>{isOpen ? "Atende" : "Folga"}</span>
                                    </label>
                                  </div>

                                  <div className="schedule-day-row__times">
                                    <div className="field">
                                      <label htmlFor={`staffOpensAt_${staffMember.id}_${weekday.value}`}>Abre</label>
                                      <input
                                        id={`staffOpensAt_${staffMember.id}_${weekday.value}`}
                                        name={`staffOpensAt_${weekday.value}`}
                                        type="time"
                                        defaultValue={opensAt}
                                      />
                                    </div>

                                    <div className="field">
                                      <label htmlFor={`staffClosesAt_${staffMember.id}_${weekday.value}`}>Fecha</label>
                                      <input
                                        id={`staffClosesAt_${staffMember.id}_${weekday.value}`}
                                        name={`staffClosesAt_${weekday.value}`}
                                        type="time"
                                        defaultValue={closesAt}
                                      />
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          <div className="inline-actions">
                            <button type="submit" className="secondary-button">
                              Salvar agenda do profissional
                            </button>
                          </div>
                        </div>
                      </form>
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </section>

        <div className="page-grid">
          <section className="card content-card form-panel">
            <div className="section-heading">
              <div>
                <h2>Novo profissional</h2>
                <p className="muted">
                  Crie membros da equipe e conecte cada um aos serviços certos para um catálogo de estética mais completo.
                </p>
              </div>
            </div>

            <form action={createStaffMemberAction} className="form-grid" style={{ marginTop: 18 }}>
              <div className="field">
                <label htmlFor="staff-name">Nome</label>
                <input id="staff-name" name="name" placeholder="Ex.: Camila" required />
              </div>

              <div className="field">
                <label htmlFor="staff-role">Função</label>
                <input id="staff-role" name="role" placeholder="Ex.: Unhas, cílios e sobrancelhas" />
              </div>

              {safeServices.length ? (
                <div className="field">
                  <label>Serviços que esse profissional atende</label>
                  <div className="check-grid">
                    {safeServices.map((service) => (
                      <label key={service.id} className="check-chip">
                        <input type="checkbox" name="serviceIds" value={service.id} defaultChecked />
                        <span>{service.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ) : null}

              <button type="submit" className="primary-button">
                Adicionar profissional
              </button>
            </form>
          </section>

          <section className="card content-card">
            <div className="section-heading">
              <div>
                <h2>Bloqueios manuais</h2>
                <p className="muted">Reserve pausas, cursos, folgas ou encaixes externos para não abrir horários indevidos.</p>
              </div>
            </div>

            {activeStaffMembers.length ? (
              <form action={createStaffBlockAction} className="form-grid" style={{ marginTop: 18 }}>
                <div className="field">
                  <label htmlFor="block-staff">Profissional</label>
                  <select id="block-staff" name="staffMemberId" required defaultValue="">
                    <option value="" disabled>
                      Selecione
                    </option>
                    {activeStaffMembers.map((staffMember) => (
                      <option key={staffMember.id} value={staffMember.id}>
                        {staffMember.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="split-grid">
                  <div className="field">
                    <label htmlFor="block-start">Início</label>
                    <input id="block-start" name="startsAt" type="datetime-local" required />
                  </div>

                  <div className="field">
                    <label htmlFor="block-end">Fim</label>
                    <input id="block-end" name="endsAt" type="datetime-local" required />
                  </div>
                </div>

                <div className="field">
                  <label htmlFor="block-reason">Motivo</label>
                  <input id="block-reason" name="reason" placeholder="Ex.: Almoço, curso, atendimento externo" />
                </div>

                <button type="submit" className="primary-button">
                  Criar bloqueio
                </button>
              </form>
            ) : (
              <div style={{ marginTop: 18 }}>
                <EmptyStateCard
                  eyebrow="Equipe indisponível"
                  title="Ative um profissional para usar bloqueios"
                  description="Bloqueios manuais dependem de pelo menos um profissional ativo no salão."
                />
              </div>
            )}

            <div className="team-block-list" style={{ marginTop: 20 }}>
              {!safeBlocks.length ? (
                <EmptyStateCard
                  eyebrow="Agenda limpa"
                  title="Nenhum bloqueio futuro"
                  description="Quando você reservar pausas ou indisponibilidades, elas aparecem aqui para consulta rápida."
                />
              ) : (
                safeBlocks.map((block) => {
                  const staff = Array.isArray(block.staff_members) ? block.staff_members[0] : block.staff_members;

                  return (
                    <article key={block.id} className="team-block-card">
                      <div className="team-block-card__content">
                        <h3>{staff?.name ?? "Profissional"}</h3>
                        <small className="list-meta">
                          {formatDateTime(block.starts_at)} até {formatDateTime(block.ends_at)}
                        </small>
                        <p className="muted">{block.reason || "Bloqueio manual sem descrição."}</p>
                      </div>

                      <form action={deleteStaffBlockAction}>
                        <input type="hidden" name="blockId" value={block.id} />
                        <button type="submit" className="danger-button">
                          Remover
                        </button>
                      </form>
                    </article>
                  );
                })
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
