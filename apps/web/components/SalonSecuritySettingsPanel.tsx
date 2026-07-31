"use client";

import {
  startTransition,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import { useRouter } from "next/navigation";

import { FlashMessage } from "@/components/FlashMessage";
import { createClient as createSupabaseBrowserClient } from "@/lib/supabase/browser";

type SalonSecuritySettingsPanelProps = {
  action: (formData: FormData) => void | Promise<void>;
  initialAllowedCountryCodes: string[];
  initialGeoAllowlistEnabled: boolean;
  initialMfaTotpEnabled: boolean;
};

type Notice = {
  message: string;
  tone: "success" | "error" | "info";
};

type TotpFactor = {
  createdAt: string | null;
  friendlyName: string | null;
  id: string;
  status: string | null;
};

type PendingEnrollment = {
  factorId: string;
  qrCode: string;
  secret: string;
};

function formatDateTime(value: string | null) {
  if (!value) {
    return "Agora";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "Agora";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(parsed);
}

function getFactorLabel(factor: TotpFactor, index: number) {
  if (factor.friendlyName) {
    return factor.friendlyName;
  }

  return `Autenticador ${index + 1}`;
}

function mapTotpFactors(rawFactors: unknown) {
  if (!Array.isArray(rawFactors)) {
    return [] as TotpFactor[];
  }

  return rawFactors
    .filter(
      (factor) =>
        factor &&
        typeof factor === "object" &&
        "factor_type" in factor &&
        (factor as { factor_type?: unknown }).factor_type === "totp",
    )
    .map((factor) => {
      const value = factor as Record<string, unknown>;

      return {
        createdAt:
          typeof value.created_at === "string" ? value.created_at : null,
        friendlyName:
          typeof value.friendly_name === "string" && value.friendly_name.trim()
            ? value.friendly_name.trim()
            : null,
        id: String(value.id ?? ""),
        status: typeof value.status === "string" ? value.status : null,
      } satisfies TotpFactor;
    })
    .filter((factor) => factor.id.length > 0);
}

export function SalonSecuritySettingsPanel({
  action,
  initialAllowedCountryCodes,
  initialGeoAllowlistEnabled,
  initialMfaTotpEnabled,
}: SalonSecuritySettingsPanelProps) {
  const router = useRouter();
  const [notice, setNotice] = useState<Notice | null>(null);
  const [loadingIntent, setLoadingIntent] = useState<string | null>(null);
  const [pendingEnrollment, setPendingEnrollment] =
    useState<PendingEnrollment | null>(null);
  const [totpCode, setTotpCode] = useState("");
  const [factors, setFactors] = useState<TotpFactor[]>([]);
  const [currentLevel, setCurrentLevel] = useState<"aal1" | "aal2" | null>(null);

  const verifiedFactors = useMemo(
    () => factors.filter((factor) => factor.status === "verified"),
    [factors],
  );

  async function refreshFactorState() {
    const supabase = createSupabaseBrowserClient();
    const [{ data: factorData, error: factorError }, { data: aalData, error: aalError }] =
      await Promise.all([
        supabase.auth.mfa.listFactors(),
        supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
      ]);

    if (factorError || aalError) {
      throw factorError ?? aalError ?? new Error("mfa_state_unavailable");
    }

    setFactors(mapTotpFactors(factorData?.all));
    setCurrentLevel(
      aalData?.currentLevel === "aal2"
        ? "aal2"
        : aalData?.currentLevel === "aal1"
          ? "aal1"
          : null,
    );
  }

  useEffect(() => {
    void refreshFactorState().catch(() => {
      setNotice({
        message: "Não foi possível carregar o estado atual do autenticador.",
        tone: "error",
      });
    });
  }, []);

  async function handleStartEnrollment() {
    setLoadingIntent("enroll");
    setNotice(null);

    try {
      const supabase = createSupabaseBrowserClient();
      const { data: factorData, error: factorError } =
        await supabase.auth.mfa.listFactors();

      if (factorError) {
        throw factorError;
      }

      const staleUnverifiedFactors = mapTotpFactors(factorData?.all).filter(
        (factor) => factor.status !== "verified",
      );

      for (const factor of staleUnverifiedFactors) {
        await supabase.auth.mfa.unenroll({ factorId: factor.id });
      }

      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "Painel do salão",
      });

      if (
        error ||
        data?.type !== "totp" ||
        !data.totp?.qr_code ||
        !data.totp?.secret
      ) {
        throw error ?? new Error("totp_enrollment_unavailable");
      }

      setPendingEnrollment({
        factorId: data.id,
        qrCode: data.totp.qr_code,
        secret: data.totp.secret,
      });
      setTotpCode("");
      setNotice({
        message:
          "Autenticador gerado. Escaneie o QR code no app autenticador e confirme o código de 6 dígitos.",
        tone: "info",
      });
      await refreshFactorState();
    } catch {
      setNotice({
        message: "Não foi possível gerar um novo autenticador agora.",
        tone: "error",
      });
    } finally {
      setLoadingIntent(null);
    }
  }

  async function handleVerifyEnrollment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!pendingEnrollment) {
      return;
    }

    setLoadingIntent("verify");
    setNotice(null);

    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.mfa.challengeAndVerify({
        factorId: pendingEnrollment.factorId,
        code: totpCode.trim(),
      });

      if (error) {
        throw error;
      }

      setPendingEnrollment(null);
      setTotpCode("");
      await refreshFactorState();
      startTransition(() => {
        router.refresh();
      });
      setNotice({
        message:
          "Autenticador confirmado. Agora você já pode exigir MFA no painel.",
        tone: "success",
      });
    } catch {
      setNotice({
        message:
          "Não foi possível confirmar esse código. Gere o código mais recente no autenticador e tente de novo.",
        tone: "error",
      });
    } finally {
      setLoadingIntent(null);
    }
  }

  return (
    <div className="settings-section-stack">
      {notice ? <FlashMessage message={notice.message} tone={notice.tone} /> : null}

      <section className="settings-form-section">
        <div className="settings-form-section__header">
          <div>
            <h3>Autenticador do painel</h3>
            <p>
              Ligue um app TOTP para confirmar logins sensíveis e subir o nível
              de proteção do acesso.
            </p>
          </div>
        </div>

        <div className="settings-form-section__body">
          <div className="settings-summary-grid settings-summary-grid--three">
            <article className="settings-status-card">
              <strong>
                {verifiedFactors.length > 0
                  ? `${verifiedFactors.length} autenticador(es) pronto(s)`
                  : "Nenhum autenticador confirmado"}
              </strong>
              <p>
                {verifiedFactors.length > 0
                  ? "O painel já pode pedir o código do autenticador no próximo login."
                  : "Gere um QR code, conecte no app autenticador e confirme um código de 6 dígitos."}
              </p>
            </article>

            <article className="settings-status-card">
              <strong>
                {currentLevel === "aal2"
                  ? "Sessão reforçada"
                  : "Sessão padrão"}
              </strong>
              <p>
                {currentLevel === "aal2"
                  ? "Seu acesso atual já passou pela segunda etapa."
                  : "Seu acesso atual ainda está no primeiro fator."}
              </p>
            </article>

            <article className="settings-status-card">
              <strong>
                {initialMfaTotpEnabled ? "Exigência ativa" : "Exigência opcional"}
              </strong>
              <p>
                {initialMfaTotpEnabled
                  ? "Quem entrar no painel precisa confirmar o código do autenticador."
                  : "Você pode preparar o autenticador primeiro e só depois exigir MFA."}
              </p>
            </article>
          </div>

          {verifiedFactors.length ? (
            <div className="settings-module-grid">
              {verifiedFactors.map((factor, index) => (
                <article key={factor.id} className="settings-upload-card">
                  <div className="settings-upload-card__header">
                    <strong>{getFactorLabel(factor, index)}</strong>
                    <p>Confirmado em {formatDateTime(factor.createdAt)}</p>
                  </div>
                </article>
              ))}
            </div>
          ) : null}

          {pendingEnrollment ? (
            <article className="settings-upload-card">
              <div className="settings-upload-card__header">
                <strong>Confirmar autenticador</strong>
                <p>
                  Escaneie o QR code no app autenticador e informe o código de
                  6 dígitos para fechar a configuração.
                </p>
              </div>

              <div className="split-grid" style={{ alignItems: "start" }}>
                <div>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={pendingEnrollment.qrCode}
                    alt="QR code do autenticador"
                    style={{
                      width: 180,
                      height: 180,
                      maxWidth: "100%",
                      borderRadius: 8,
                      border: "1px solid rgba(15, 23, 42, 0.12)",
                    }}
                  />
                </div>

                <div className="form-grid">
                  <article className="settings-status-card">
                    <strong>Chave manual</strong>
                    <p>{pendingEnrollment.secret}</p>
                  </article>

                  <form className="form-grid" onSubmit={handleVerifyEnrollment}>
                    <label className="field">
                      <span>Código do autenticador</span>
                      <input
                        inputMode="numeric"
                        pattern="[0-9]{6}"
                        placeholder="000000"
                        value={totpCode}
                        onChange={(event) =>
                          setTotpCode(event.target.value.replace(/\D+/g, "").slice(0, 6))
                        }
                        required
                      />
                    </label>

                    <button
                      type="submit"
                      className="primary-button"
                      disabled={loadingIntent !== null}
                    >
                      {loadingIntent === "verify"
                        ? "Confirmando..."
                        : "Confirmar autenticador"}
                    </button>
                  </form>
                </div>
              </div>
            </article>
          ) : (
            <button
              type="button"
              className="secondary-button"
              onClick={handleStartEnrollment}
              disabled={loadingIntent !== null}
            >
              {loadingIntent === "enroll"
                ? "Gerando..."
                : verifiedFactors.length > 0
                  ? "Adicionar outro autenticador"
                  : "Gerar autenticador TOTP"}
            </button>
          )}
        </div>
      </section>

      <form action={action} className="form-grid settings-identity-form">
        <div className="settings-section-stack">
          <section className="settings-form-section">
            <div className="settings-form-section__header">
              <div>
                <h3>Política do painel</h3>
                <p>
                  Defina quando o autenticador vira obrigatório e se o painel
                  deve aceitar acesso só de países permitidos.
                </p>
              </div>
            </div>

            <div className="settings-form-section__body">
              <div className="settings-toggle-grid">
                <label className="checkbox-field" style={{ marginTop: 4 }}>
                  <input
                    type="checkbox"
                    name="mfaTotpEnabled"
                    defaultChecked={initialMfaTotpEnabled}
                  />
                  Exigir código do autenticador para entrar no painel
                </label>

                <label className="checkbox-field" style={{ marginTop: 4 }}>
                  <input
                    type="checkbox"
                    name="geoAllowlistEnabled"
                    defaultChecked={initialGeoAllowlistEnabled}
                  />
                  Restringir acesso do painel aos países permitidos
                </label>
              </div>

              <label className="field">
                <span>Países permitidos</span>
                <input
                  name="allowedCountryCodes"
                  defaultValue={initialAllowedCountryCodes.join(", ")}
                  placeholder="BR, US"
                />
                <small className="muted">
                  Use códigos ISO-3166 alpha-2 separados por vírgula.
                </small>
              </label>

              <article className="settings-status-card">
                <strong>Leitura da allowlist</strong>
                <p>
                  Quando a restrição geográfica estiver ativa, o painel só segue
                  em frente se o cabeçalho do país da borda corresponder a um dos
                  códigos informados.
                </p>
              </article>
            </div>
          </section>
        </div>

        <div className="settings-submit-bar">
          <button type="submit" className="primary-button">
            Salvar segurança do painel
          </button>
        </div>
      </form>
    </div>
  );
}
