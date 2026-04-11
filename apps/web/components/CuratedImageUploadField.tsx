import {
  MEDIA_UPLOAD_PRESETS,
  formatPresetMegabytes,
  type MediaUploadContext,
} from "@/lib/mediaUploadPresets";

type CuratedImageUploadFieldProps = {
  id: string;
  name: string;
  context: MediaUploadContext;
  accept?: string;
  multiple?: boolean;
  required?: boolean;
  defaultPreviewUrls?: string[];
  replaceHint?: string;
  helperText?: string;
};

export function CuratedImageUploadField({
  id,
  name,
  context,
  accept = "image/png,image/jpeg,image/webp",
  multiple = false,
  required = false,
  defaultPreviewUrls = [],
  replaceHint,
  helperText,
}: CuratedImageUploadFieldProps) {
  const preset = MEDIA_UPLOAD_PRESETS[context];
  const metaLines = [
    replaceHint,
    defaultPreviewUrls.length
      ? "Mostrando a midia atual publicada no painel."
      : null,
    "A plataforma otimiza a imagem automaticamente no envio para manter a vitrine mais leve e nitida.",
  ].filter((value): value is string => Boolean(value));

  return (
    <div className="curated-image-upload-field">
      <input
        id={id}
        name={name}
        type="file"
        accept={accept}
        multiple={multiple}
        required={required}
      />
      <small className="muted">
        {helperText ??
          `${preset.helperText} Ate ${formatPresetMegabytes(
            preset.maxInputBytes,
          )} MB por arquivo.`}
      </small>

      <div className="curated-image-upload-field__badges">
        {preset.badges.map((badge) => (
          <span key={badge}>{badge}</span>
        ))}
      </div>

      <div className="curated-image-upload-field__grid">
        {defaultPreviewUrls.length ? (
          defaultPreviewUrls.map((url, index) => (
            <div
              key={`${url}-${index}`}
              className={`curated-image-upload-field__card curated-image-upload-field__card--${context}`}
              style={{ aspectRatio: String(preset.previewAspectRatio) }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt={resolvePreviewLabel(context, index)}
                style={{ objectFit: preset.previewFit }}
              />
              <span className="curated-image-upload-field__tag">
                {resolvePreviewLabel(context, index)}
              </span>
            </div>
          ))
        ) : (
          <div
            className={`curated-image-upload-field__card curated-image-upload-field__card--${context} curated-image-upload-field__card--empty`}
            style={{ aspectRatio: String(preset.previewAspectRatio) }}
          >
            <strong>{preset.emptyTitle}</strong>
            <span>{preset.emptyDescription}</span>
          </div>
        )}
      </div>

      <div className="curated-image-upload-field__meta">
        {metaLines.map((line) => (
          <span key={line}>{line}</span>
        ))}
      </div>
    </div>
  );
}

function resolvePreviewLabel(context: MediaUploadContext, index: number) {
  if (context === "product") {
    return index === 0 ? "Capa da loja" : `Galeria ${index + 1}`;
  }

  if (context === "service") {
    return "Preview do servico";
  }

  return index === 0 ? "Capa do feed" : `Imagem ${index + 1}`;
}
