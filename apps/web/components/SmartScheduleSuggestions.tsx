import { formatCurrency, formatDate } from "@/lib/formatters";

type SmartScheduleService = {
  id: string;
  name: string;
  category: string | null;
  duration: number;
  price: number | string | null;
};

export type SmartScheduleSuggestion = {
  staff_member_id: string;
  staff_member_name: string;
  gap_kind: "between_appointments" | "before_first" | "after_last" | "open_day";
  gap_start: string;
  gap_end: string;
  gap_minutes: number;
  suggested_start: string;
  suggested_end: string;
  headline: string;
  detail: string;
  compatible_service_count: number;
  compatible_services: SmartScheduleService[];
  suggested_service: SmartScheduleService;
};

type SmartScheduleSuggestionsProps = {
  title?: string;
  description?: string;
  targetDayLabel?: string;
  suggestions: SmartScheduleSuggestion[];
};

function formatTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatGapKind(kind: SmartScheduleSuggestion["gap_kind"]) {
  switch (kind) {
    case "between_appointments":
      return "Entre atendimentos";
    case "before_first":
      return "Antes do primeiro";
    case "after_last":
      return "Depois do último";
    default:
      return "Agenda livre";
  }
}

export function SmartScheduleSuggestions({
  title = "Encaixes inteligentes",
  description = "O sistema cruza jornada, bloqueios, serviços e agendamentos para sugerir encaixes reais sem conflito.",
  targetDayLabel,
  suggestions,
}: SmartScheduleSuggestionsProps) {
  return (
    <section className="card content-card">
      <div className="section-heading">
        <div>
          <h2>{title}</h2>
          <p className="muted">{description}</p>
        </div>
      </div>

      {targetDayLabel ? (
        <div className="inline-actions" style={{ marginTop: 16, marginBottom: 4 }}>
          <span className="badge badge--soft">{targetDayLabel}</span>
          <span className="badge badge--pending">{suggestions.length} sugestões úteis</span>
        </div>
      ) : null}

      <div className="row-list" style={{ marginTop: 16 }}>
        {suggestions.length === 0 ? (
          <article className="list-row smart-suggestion-card">
            <div className="list-row__content">
              <h3>Nenhum encaixe estratégico encontrado agora</h3>
              <p className="muted list-description">
                Quando surgir um intervalo livre entre atendimentos, ele aparece aqui com o melhor horário e os serviços que ainda cabem na janela.
              </p>
            </div>
          </article>
        ) : (
          suggestions.map((suggestion) => (
            <article key={`${suggestion.staff_member_id}-${suggestion.suggested_start}`} className="list-row smart-suggestion-card">
              <div className="list-row__content">
                <div className="inline-actions" style={{ marginBottom: 8 }}>
                  <span className="badge badge--pending">{formatGapKind(suggestion.gap_kind)}</span>
                  <span className="badge badge--soft">{suggestion.staff_member_name}</span>
                </div>
                <h3>{suggestion.headline}</h3>
                <p className="muted list-description">{suggestion.detail}</p>

                <div className="smart-suggestion-grid">
                  <div className="smart-suggestion-item">
                    <span className="smart-suggestion-item__label">Melhor encaixe</span>
                    <strong>{formatTime(suggestion.suggested_start)}</strong>
                    <small className="list-meta">
                      até {formatTime(suggestion.suggested_end)} • janela livre até {formatTime(suggestion.gap_end)}
                    </small>
                  </div>

                  <div className="smart-suggestion-item">
                    <span className="smart-suggestion-item__label">Serviço ideal</span>
                    <strong>{suggestion.suggested_service.name}</strong>
                    <small className="list-meta">
                      {suggestion.suggested_service.category ? `${suggestion.suggested_service.category} • ` : ""}
                      {suggestion.suggested_service.duration} min
                      {suggestion.suggested_service.price != null
                        ? ` • ${formatCurrency(Number(suggestion.suggested_service.price))}`
                        : ""}
                    </small>
                  </div>

                  <div className="smart-suggestion-item">
                    <span className="smart-suggestion-item__label">Intervalo disponível</span>
                    <strong>{suggestion.gap_minutes} min livres</strong>
                    <small className="list-meta">
                      {formatTime(suggestion.gap_start)} até {formatTime(suggestion.gap_end)}
                    </small>
                  </div>
                </div>

                {suggestion.compatible_services.length ? (
                  <div className="smart-suggestion-services">
                    <span className="smart-suggestion-item__label">
                      Serviços compatíveis ({suggestion.compatible_service_count})
                    </span>
                    <div className="inline-actions" style={{ marginTop: 10 }}>
                      {suggestion.compatible_services.map((service) => (
                        <span key={service.id} className="badge badge--soft">
                          {service.name} • {service.duration} min
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  );
}

export function buildSmartScheduleTargetDayLabel(targetDay: string) {
  return `Agenda de ${formatDate(targetDay)}`;
}
