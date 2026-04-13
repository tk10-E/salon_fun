export const CLIENT_APP_IMAGE_MAX_BYTES = 3 * 1024 * 1024;
export const SALON_LOGO_MAX_BYTES = 2 * 1024 * 1024;
export const MAX_LOCAL_BRANDING_UPLOADS_PER_SUBMIT = 1;

export const SETTINGS_BRANDING_UPLOAD_GUIDANCE =
  "Obrigatório: nenhuma imagem. Recomendado: logo + 1 imagem principal. Extras: galeria e perfil. Arquivo local: 1 por vez.";

export const SETTINGS_BRANDING_UPLOAD_FORMAT_GUIDANCE =
  "Logo: PNG, JPG, WEBP ou SVG ate 2 MB. Capas: PNG, JPG ou WEBP ate 3 MB.";

export type SettingsBrandingUploadField =
  | "logo"
  | "clientAppHeroImageFile"
  | "clientAppGalleryCoverImageFile"
  | "clientAppProfileCoverImageFile";

type SettingsBrandingUploadLabel = {
  invalidType: string;
  tooLarge: string;
};

const fieldMessages: Record<
  SettingsBrandingUploadField,
  SettingsBrandingUploadLabel
> = {
  logo: {
    invalidType: "Envie uma imagem válida para a logo.",
    tooLarge: "A logo deve ter no máximo 2 MB.",
  },
  clientAppHeroImageFile: {
    invalidType: "Envie uma imagem válida para o hero principal do app.",
    tooLarge: "A imagem principal do app deve ter no máximo 3 MB.",
  },
  clientAppGalleryCoverImageFile: {
    invalidType: "Envie uma imagem válida para a capa da galeria do app.",
    tooLarge: "A capa da galeria do app deve ter no máximo 3 MB.",
  },
  clientAppProfileCoverImageFile: {
    invalidType:
      "Envie uma imagem válida para a capa institucional do perfil do salão.",
    tooLarge: "A capa do perfil do salão deve ter no máximo 3 MB.",
  },
};

export const SETTINGS_BRANDING_UPLOAD_LIMIT_MESSAGE =
  "Para evitar erro 413 em produção, envie apenas uma imagem local por vez. Se precisar trocar várias mídias, salve uma por vez ou use as URLs.";

const rasterBrandingUploadMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const logoBrandingUploadMimeTypes = new Set([
  ...rasterBrandingUploadMimeTypes,
  "image/svg+xml",
]);

function isSelectedFile(file: File | null | undefined): file is File {
  return Boolean(
    file &&
      typeof file.size === "number" &&
      file.size > 0 &&
      typeof file.type === "string",
  );
}

export function getSettingsBrandingUploadError(
  files: Partial<Record<SettingsBrandingUploadField, File | null>>,
) {
  const selectedFiles: Array<[SettingsBrandingUploadField, File]> = [];

  for (const [field, file] of Object.entries(files) as Array<
    [SettingsBrandingUploadField, File | null | undefined]
  >) {
    if (isSelectedFile(file)) {
      selectedFiles.push([field, file]);
    }
  }

  if (selectedFiles.length > MAX_LOCAL_BRANDING_UPLOADS_PER_SUBMIT) {
    return SETTINGS_BRANDING_UPLOAD_LIMIT_MESSAGE;
  }

  for (const [field, file] of selectedFiles) {
    if (!isSettingsBrandingUploadMimeTypeAllowed(field, file.type)) {
      return fieldMessages[field].invalidType;
    }

    const maxBytes =
      field === "logo" ? SALON_LOGO_MAX_BYTES : CLIENT_APP_IMAGE_MAX_BYTES;

    if (file.size > maxBytes) {
      return fieldMessages[field].tooLarge;
    }
  }

  return null;
}

export function isSettingsBrandingUploadMimeTypeAllowed(
  field: SettingsBrandingUploadField,
  mimeType: string,
) {
  const normalizedMimeType = normalizeImageMimeType(mimeType);
  const allowedMimeTypes =
    field === "logo"
      ? logoBrandingUploadMimeTypes
      : rasterBrandingUploadMimeTypes;

  return allowedMimeTypes.has(normalizedMimeType);
}

function normalizeImageMimeType(mimeType: string) {
  const normalized = mimeType.split(";")[0].trim().toLowerCase();

  if (normalized === "image/jpg" || normalized === "image/pjpeg") {
    return "image/jpeg";
  }

  if (normalized === "image/x-png") {
    return "image/png";
  }

  return normalized;
}
