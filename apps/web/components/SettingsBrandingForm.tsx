"use client";

import type { FormEvent, ReactNode } from "react";
import { useState } from "react";

import { FlashMessage } from "@/components/FlashMessage";
import {
  SETTINGS_BRANDING_UPLOAD_FORMAT_GUIDANCE,
  SETTINGS_BRANDING_UPLOAD_GUIDANCE,
  getSettingsBrandingUploadError,
} from "@/lib/settingsBrandingUploads";

type SettingsBrandingFormProps = {
  action: string;
  salonId: string;
  children: ReactNode;
};

export function SettingsBrandingForm({
  action,
  salonId,
  children,
}: SettingsBrandingFormProps) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function readInputFile(form: HTMLFormElement, field: string) {
    const element = form.elements.namedItem(field);

    if (!(element instanceof HTMLInputElement)) {
      return null;
    }

    return element.files?.[0] ?? null;
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    const form = event.currentTarget;
    const error = getSettingsBrandingUploadError({
      logo: readInputFile(form, "logo"),
      clientAppHeroImageFile: readInputFile(form, "clientAppHeroImageFile"),
      clientAppGalleryCoverImageFile: readInputFile(
        form,
        "clientAppGalleryCoverImageFile",
      ),
      clientAppProfileCoverImageFile: readInputFile(
        form,
        "clientAppProfileCoverImageFile",
      ),
    });

    if (error) {
      event.preventDefault();
      setErrorMessage(error);
      return;
    }

    setErrorMessage(null);
  }

  return (
    <form
      action={action}
      className="form-grid settings-identity-form"
      encType="multipart/form-data"
      method="post"
      noValidate
      onSubmit={handleSubmit}
      style={{ marginTop: 12 }}
    >
      <input type="hidden" name="salonId" value={salonId} />

      <article className="settings-upload-guard" aria-live="polite">
        <strong>Imagens do app</strong>
        <p>{SETTINGS_BRANDING_UPLOAD_GUIDANCE}</p>
        <p>{SETTINGS_BRANDING_UPLOAD_FORMAT_GUIDANCE}</p>
      </article>

      {errorMessage ? <FlashMessage message={errorMessage} tone="error" /> : null}

      {children}
    </form>
  );
}
