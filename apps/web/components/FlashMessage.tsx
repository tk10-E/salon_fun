type FlashTone = "success" | "error" | "info";

type FlashMessageProps = {
  message: string;
  tone?: string;
};

const toneMap: Record<FlashTone, { label: string; symbol: string }> = {
  success: { label: "Sucesso", symbol: "OK" },
  error: { label: "Aviso", symbol: "!" },
  info: { label: "Informacao", symbol: "i" },
};

function normalizeTone(tone?: string): FlashTone {
  if (tone === "success" || tone === "error" || tone === "info") {
    return tone;
  }

  return "info";
}

export function FlashMessage({ message, tone }: FlashMessageProps) {
  const resolvedTone = normalizeTone(tone);
  const config = toneMap[resolvedTone];

  return (
    <div className={`flash flash--${resolvedTone}`} role="status" aria-live="polite">
      <span className="flash__icon" aria-hidden="true">
        {config.symbol}
      </span>
      <div className="flash__content">
        <strong>{config.label}</strong>
        <p>{message}</p>
      </div>
    </div>
  );
}

