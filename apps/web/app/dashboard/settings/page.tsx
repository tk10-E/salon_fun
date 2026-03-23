import Image from "next/image";

import { regenerateSalonCodeAction, updateSalonBrandingAction, updateSalonScheduleAction } from "@/app/actions";
import { FlashMessage } from "@/components/FlashMessage";
import { requireOwnerSalon } from "@/lib/auth";
import { SALON_TIMEZONE_OPTIONS, SLOT_STEP_OPTIONS, WEEKDAY_OPTIONS, formatBusinessTime } from "@/lib/schedule";
import { getSalonSegmentPreset, SALON_SEGMENT_OPTIONS } from "@/lib/salonSegments";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/formatters";

type SettingsPageProps = {
  searchParams?: {
    message?: string;
    tone?: string;
  };
};

export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  const { salon } = await requireOwnerSalon();
  const supabase = createClient();
  const businessHoursResponse = await supabase
    .from("salon_business_hours")
    .select("weekday, is_open, opens_at, closes_at")
    .eq("salon_id", salon.id)
    .order("weekday");
  const brandColor = salon.brand_color ?? "#C56B43";
  const segmentPreset = getSalonSegmentPreset(salon.business_segment);
  const timezone = salon.timezone ?? "America/Sao_Paulo";
  const slotStepMinutes = salon.slot_step_minutes ?? 30;
  const logoUrl = salon.logo_path
    ? supabase.storage.from("salon-assets").getPublicUrl(salon.logo_path).data.publicUrl
    : null;
  const salonName = salon.name?.trim() || "Salão";
  const initials = salonName.slice(0, 2).toUpperCase();
  const businessHoursMap = new Map(
    (businessHoursResponse.data ?? []).map((entry) => [
      entry.weekday,
      {
        is_open: entry.is_open,
        opens_at: entry.opens_at,
        closes_at: entry.closes_at,
      },
    ]),
  );
  const businessHours = WEEKDAY_OPTIONS.map((weekday) => ({
    ...weekday,
    ...(businessHoursMap.get(weekday.value) ?? {
      is_open: weekday.value !== 0,
      opens_at: weekday.value === 0 ? null : "09:00:00",
      closes_at: weekday.value === 0 ? null : "18:00:00",
    }),
  }));

  return (
    <div className="page-grid">
      {searchParams?.message ? <FlashMessage message={searchParams.message} tone={searchParams.tone} /> : null}

      <section className="card content-card">
        <div className="section-heading">
          <div>
            <h2>Identidade do salão</h2>
            <p className="muted">Esses dados alimentam a experiência do app do cliente com cor, texto, logo e contato.</p>
          </div>
        </div>

        <div className="brand-settings-grid" style={{ marginTop: 18 }}>
          <div className="brand-preview-card">
            <div
              className="brand-preview-hero"
              style={{
                background: `linear-gradient(135deg, ${brandColor}, color-mix(in srgb, ${brandColor} 28%, white))`,
              }}
            >
              <div className="brand-preview-logo">
                {logoUrl ? (
                  <Image src={logoUrl} alt={`Logo de ${salonName}`} fill sizes="82px" />
                ) : (
                  <span>{initials}</span>
                )}
              </div>
              <div className="brand-preview-copy">
                <span className="eyebrow">Preview do app</span>
                <h3>{salonName}</h3>
                <p>{salon.tagline || segmentPreset.description}</p>
              </div>
            </div>

            <div className="brand-preview-meta">
              <div>
                <span className="eyebrow">Segmento</span>
                <p>{segmentPreset.label}</p>
              </div>
              <div>
                <span className="eyebrow">WhatsApp</span>
                <p>{salon.whatsapp_phone || "Ainda não configurado"}</p>
              </div>
              <div>
                <span className="eyebrow">Cor principal</span>
                <div className="brand-color-chip">
                  <span style={{ backgroundColor: brandColor }} />
                  <strong>{brandColor}</strong>
                </div>
              </div>
            </div>

            <div className="brand-preview-mobile">
              <div className="brand-preview-mobile__frame">
                <div
                  className="brand-preview-mobile__hero"
                  style={{
                    background: `linear-gradient(145deg, ${brandColor}, color-mix(in srgb, ${brandColor} 18%, #2F231C))`,
                  }}
                >
                  <div className="brand-preview-mobile__brand">
                    <div className="brand-preview-mobile__logo">
                      {logoUrl ? (
                        <Image src={logoUrl} alt={`Preview de ${salonName}`} fill sizes="44px" />
                      ) : (
                        <span>{initials}</span>
                      )}
                    </div>
                    <div>
                      <strong>{salonName}</strong>
                      <span>{salon.tagline || segmentPreset.mobileSupport}</span>
                    </div>
                  </div>

                  <div className="brand-preview-mobile__headline">{segmentPreset.mobileHeadline}</div>
                </div>

                <div className="brand-preview-mobile__cards">
                  {segmentPreset.previewCards.map((card) => (
                    <div key={card.title} className="brand-preview-mobile__card">
                      <span className="eyebrow">{card.eyebrow}</span>
                      <strong>{card.title}</strong>
                      <p>{card.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <form action={updateSalonBrandingAction} className="form-grid" encType="multipart/form-data">
            <div className="field">
              <label htmlFor="name">Nome do salão</label>
              <input id="name" name="name" defaultValue={salon.name} required />
            </div>

            <div className="field">
              <label htmlFor="tagline">Descrição curta</label>
              <textarea
                id="tagline"
                name="tagline"
                defaultValue={salon.tagline ?? ""}
                rows={3}
                placeholder="Ex.: Escova, corte e manicure em um ambiente leve e acolhedor."
              />
            </div>

            <div className="field">
              <label htmlFor="businessSegment">Segmento do salão</label>
              <select id="businessSegment" name="businessSegment" defaultValue={segmentPreset.value}>
                {SALON_SEGMENT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <small className="muted">
                Esse preset muda a linguagem, os destaques e a sensação do app do cliente sem trocar a estrutura do produto.
              </small>
            </div>

            <div className="split-grid">
              <div className="field">
                <label htmlFor="brandColor">Cor principal</label>
                <input id="brandColor" name="brandColor" type="color" defaultValue={brandColor} />
              </div>

              <div className="field">
                <label htmlFor="whatsappPhone">WhatsApp</label>
                <input
                  id="whatsappPhone"
                  name="whatsappPhone"
                  type="tel"
                  defaultValue={salon.whatsapp_phone ?? ""}
                  placeholder="5511999999999"
                />
              </div>
            </div>

            <div className="field">
              <label htmlFor="logo">Logo que aparece no app do cliente</label>
              <input id="logo" name="logo" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" />
              <small className="muted">PNG, JPG, WEBP ou SVG com até 2 MB. Essa imagem aparece no topo do app do cliente.</small>
            </div>

            {logoUrl ? (
              <div className="field">
                <label>Logo atual</label>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    padding: 14,
                    borderRadius: 18,
                    border: "1px solid #E3D5C7",
                    background: "#FBF7F2",
                  }}
                >
                  <div
                    style={{
                      position: "relative",
                      width: 72,
                      height: 72,
                      borderRadius: 20,
                      overflow: "hidden",
                      background: "#FFFFFF",
                      border: "1px solid #E3D5C7",
                      flexShrink: 0,
                    }}
                  >
                    <Image src={logoUrl} alt={`Logo atual de ${salonName}`} fill sizes="72px" />
                  </div>
                  <div style={{ display: "grid", gap: 6 }}>
                    <strong style={{ color: "#2F231C" }}>Essa é a imagem que o cliente vê no app.</strong>
                    <span className="muted">Se quiser trocar, envie outra imagem acima. Se quiser limpar, marque a opção abaixo.</span>
                  </div>
                </div>
              </div>
            ) : null}

            {logoUrl ? (
              <div className="field">
                <label className="toggle-pill" style={{ width: "fit-content" }}>
                  <input type="checkbox" name="removeLogo" />
                  <span>Remover logo atual</span>
                </label>
                <small className="muted">Se marcar essa opção e salvar, o app do cliente volta a mostrar as iniciais do salão.</small>
              </div>
            ) : null}

            <div
              style={{
                padding: 16,
                borderRadius: 18,
                background: "#FBF7F2",
                border: "1px solid #E3D5C7",
              }}
            >
              <strong style={{ display: "block", color: "#2F231C", marginBottom: 6 }}>Onde essa logo aparece</strong>
              <p className="muted" style={{ margin: 0 }}>
                A logo fica no destaque principal do app do cliente, junto do nome do salão, da cor da marca e do botão de
                contato.
              </p>
            </div>

            <div
              style={{
                padding: 16,
                borderRadius: 18,
                background: "#FBF7F2",
                border: "1px solid #E3D5C7",
                display: "grid",
                gap: 10,
              }}
            >
              <strong style={{ display: "block", color: "#2F231C" }}>Preset ativo: {segmentPreset.label}</strong>
              <p className="muted" style={{ margin: 0 }}>
                {segmentPreset.shortDescription}
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {segmentPreset.focusAreas.map((focus) => (
                  <span
                    key={focus}
                    style={{
                      padding: "8px 12px",
                      borderRadius: 999,
                      border: "1px solid #E3D5C7",
                      background: "rgba(255,255,255,0.92)",
                      color: "#2F231C",
                      fontWeight: 700,
                      fontSize: "0.85rem",
                    }}
                  >
                    {focus}
                  </span>
                ))}
              </div>
            </div>

            <div className="inline-actions">
              <button type="submit" className="primary-button">
                Salvar identidade
              </button>
            </div>
          </form>
        </div>
      </section>

      <section className="card content-card">
        <div className="section-heading">
          <div>
            <h2>Agenda online</h2>
            <p className="muted">Defina o intervalo da agenda e em quais horários o cliente pode reservar pelo app.</p>
          </div>
        </div>

        <div className="schedule-settings-grid" style={{ marginTop: 18 }}>
          <div className="schedule-preview-card">
            <div className="schedule-preview-head">
              <span className="eyebrow">Como o cliente vê</span>
              <h3>Disponibilidade alinhada com sua operação</h3>
              <p>
                O app passa a mostrar somente horários dentro do seu atendimento. Nada de agenda fora do horário,
                conflito ou encaixe manual no susto.
              </p>
            </div>

            <div className="schedule-preview-meta">
              <div>
                <span className="eyebrow">Fuso horário</span>
                <p>{SALON_TIMEZONE_OPTIONS.find((option) => option.value === timezone)?.label ?? timezone}</p>
              </div>
              <div>
                <span className="eyebrow">Intervalo entre horários</span>
                <p>{SLOT_STEP_OPTIONS.find((option) => option.value === slotStepMinutes)?.label ?? `${slotStepMinutes} min`}</p>
              </div>
            </div>
          </div>

          <form action={updateSalonScheduleAction} className="form-grid">
            <div className="split-grid">
              <div className="field">
                <label htmlFor="timezone">Fuso horário</label>
                <select id="timezone" name="timezone" defaultValue={timezone}>
                  {SALON_TIMEZONE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label htmlFor="slotStepMinutes">Intervalo da agenda</label>
                <select id="slotStepMinutes" name="slotStepMinutes" defaultValue={String(slotStepMinutes)}>
                  {SLOT_STEP_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="schedule-week-grid">
              {businessHours.map((day) => (
                <div key={day.value} className="schedule-day-row">
                  <div className="schedule-day-row__title">
                    <strong>{day.label}</strong>
                    <label className="toggle-pill">
                      <input type="checkbox" name={`isOpen_${day.value}`} defaultChecked={day.is_open} />
                      <span>{day.is_open ? "Aberto" : "Fechado"}</span>
                    </label>
                  </div>

                  <div className="schedule-day-row__times">
                    <div className="field">
                      <label htmlFor={`opensAt_${day.value}`}>Abre</label>
                      <input
                        id={`opensAt_${day.value}`}
                        name={`opensAt_${day.value}`}
                        type="time"
                        defaultValue={formatBusinessTime(day.opens_at)}
                      />
                    </div>

                    <div className="field">
                      <label htmlFor={`closesAt_${day.value}`}>Fecha</label>
                      <input
                        id={`closesAt_${day.value}`}
                        name={`closesAt_${day.value}`}
                        type="time"
                        defaultValue={formatBusinessTime(day.closes_at)}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="inline-actions">
              <button type="submit" className="primary-button">
                Salvar agenda
              </button>
            </div>
          </form>
        </div>
      </section>

      <section className="card content-card">
        <div className="section-heading">
          <div>
            <h2>Código para clientes</h2>
            <p className="muted">Compartilhe esse código para que seus clientes entrem no app certo.</p>
          </div>
        </div>

        <div className="row-list" style={{ marginTop: 16 }}>
          <article className="list-row code-card">
            <div className="list-row__content">
              <h3>{salon.name}</h3>
              <small className="list-meta">Criado em {formatDate(salon.created_at)}</small>
            </div>

            <div className="code-card__aside">
              <span className="eyebrow">Código</span>
              <p className="code-value">{salon.join_code}</p>
            </div>
          </article>
        </div>

        <form action={regenerateSalonCodeAction} style={{ marginTop: 24 }}>
          <button type="submit" className="secondary-button">
            Gerar novo código
          </button>
        </form>
      </section>
    </div>
  );
}
