"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";

type DashboardIdentityAvatarProps = {
  imageUrl?: string | null;
  fallbackImageUrl?: string | null;
  alt: string;
  fallbackImageAlt?: string;
  fallbackText: string;
  className: string;
  imageClassName: string;
  fallbackClassName: string;
  style?: CSSProperties;
};

function normalizeText(value?: string | null) {
  if (!value) {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

export function DashboardIdentityAvatar({
  imageUrl,
  fallbackImageUrl,
  alt,
  fallbackImageAlt,
  fallbackText,
  className,
  imageClassName,
  fallbackClassName,
  style,
}: DashboardIdentityAvatarProps) {
  const imageCandidates = useMemo(() => {
    const primaryImageUrl = normalizeText(imageUrl);
    const backupImageUrl = normalizeText(fallbackImageUrl);
    const candidates: Array<{ url: string; alt: string }> = [];

    if (primaryImageUrl) {
      candidates.push({ url: primaryImageUrl, alt });
    }

    if (backupImageUrl && backupImageUrl !== primaryImageUrl) {
      candidates.push({
        url: backupImageUrl,
        alt: fallbackImageAlt?.trim() || alt,
      });
    }

    return candidates;
  }, [alt, fallbackImageAlt, fallbackImageUrl, imageUrl]);

  const [resolvedImage, setResolvedImage] = useState<{
    url: string;
    alt: string;
  } | null>(null);

  useEffect(() => {
    let isCancelled = false;

    setResolvedImage(null);

    if (imageCandidates.length === 0) {
      return () => {
        isCancelled = true;
      };
    }

    if (typeof window === "undefined" || typeof window.Image === "undefined") {
      setResolvedImage(imageCandidates[0] ?? null);
      return () => {
        isCancelled = true;
      };
    }

    const tryLoadCandidate = (index: number) => {
      const candidate = imageCandidates[index];

      if (!candidate) {
        if (!isCancelled) {
          setResolvedImage(null);
        }
        return;
      }

      const probe = new window.Image();
      probe.onload = () => {
        if (!isCancelled) {
          setResolvedImage(candidate);
        }
      };
      probe.onerror = () => {
        if (!isCancelled) {
          tryLoadCandidate(index + 1);
        }
      };
      probe.src = candidate.url;
    };

    tryLoadCandidate(0);

    return () => {
      isCancelled = true;
    };
  }, [imageCandidates]);

  if (resolvedImage) {
    return (
      <span
        className={`${className} ${className}--image`}
        role="img"
        aria-label={resolvedImage.alt}
        style={style}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={resolvedImage.url}
          alt=""
          aria-hidden="true"
          className={imageClassName}
        />
      </span>
    );
  }

  return (
    <span
      className={`${className} ${fallbackClassName}`}
      role="img"
      aria-label={alt}
      style={style}
    >
      {fallbackText}
    </span>
  );
}
