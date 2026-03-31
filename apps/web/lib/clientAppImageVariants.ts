import { Buffer } from "node:buffer";

import sharp from "sharp";

export type ClientAppImageAssetKey = "hero" | "galleryCover" | "profileCover";
export type ClientAppImageVariantKind = "mobile" | "tablet" | "share";

type ClientAppImageOutputSpec = {
  aspectRatio: number;
  outputWidth: number;
  outputHeight: number;
};

type ClientAppImageVariantSpec = {
  storageFolder: string;
  aspectRatio: number;
  outputWidth: number;
  outputHeight: number;
  recommendedRatioLabel: string;
  recommendedSizeLabel: string;
  safeAreaLabel: string;
  outputs: Record<ClientAppImageVariantKind, ClientAppImageOutputSpec>;
};

export type RemoteClientAppImageAsset = {
  buffer: Buffer;
  contentType: string;
};

export const CLIENT_APP_IMAGE_VARIANT_SPECS: Record<
  ClientAppImageAssetKey,
  ClientAppImageVariantSpec
> = {
  hero: {
    storageFolder: "hero",
    aspectRatio: 16 / 10,
    outputWidth: 1600,
    outputHeight: 1000,
    recommendedRatioLabel: "Proporção sugerida 16:10",
    recommendedSizeLabel: "Tamanho ideal 1600x1000",
    safeAreaLabel: "Texto e assunto principal dentro da área segura",
    outputs: {
      mobile: {
        aspectRatio: 16 / 10,
        outputWidth: 1600,
        outputHeight: 1000,
      },
      tablet: {
        aspectRatio: 16 / 10,
        outputWidth: 2400,
        outputHeight: 1500,
      },
      share: {
        aspectRatio: 1200 / 630,
        outputWidth: 1200,
        outputHeight: 630,
      },
    },
  },
  galleryCover: {
    storageFolder: "gallery-cover",
    aspectRatio: 4 / 5,
    outputWidth: 1200,
    outputHeight: 1500,
    recommendedRatioLabel: "Proporção sugerida 4:5",
    recommendedSizeLabel: "Tamanho ideal 1200x1500",
    safeAreaLabel: "Assunto principal centralizado na área útil",
    outputs: {
      mobile: {
        aspectRatio: 4 / 5,
        outputWidth: 1200,
        outputHeight: 1500,
      },
      tablet: {
        aspectRatio: 4 / 5,
        outputWidth: 1800,
        outputHeight: 2250,
      },
      share: {
        aspectRatio: 1200 / 630,
        outputWidth: 1200,
        outputHeight: 630,
      },
    },
  },
  profileCover: {
    storageFolder: "profile-cover",
    aspectRatio: 3 / 2,
    outputWidth: 1440,
    outputHeight: 960,
    recommendedRatioLabel: "Proporção sugerida 3:2",
    recommendedSizeLabel: "Tamanho ideal 1440x960",
    safeAreaLabel: "Logo, fachada ou atmosfera da marca dentro da área segura",
    outputs: {
      mobile: {
        aspectRatio: 3 / 2,
        outputWidth: 1440,
        outputHeight: 960,
      },
      tablet: {
        aspectRatio: 3 / 2,
        outputWidth: 2160,
        outputHeight: 1440,
      },
      share: {
        aspectRatio: 1200 / 630,
        outputWidth: 1200,
        outputHeight: 630,
      },
    },
  },
};

export function getClientAppImageStoragePaths(
  salonId: string,
  assetKey: ClientAppImageAssetKey,
) {
  const { storageFolder } = CLIENT_APP_IMAGE_VARIANT_SPECS[assetKey];

  return {
    sourcePath: `${salonId}/client-app/${storageFolder}/source`,
    variantPath: `${salonId}/client-app/${storageFolder}/mobile.jpg`,
    tabletVariantPath: `${salonId}/client-app/${storageFolder}/tablet.jpg`,
    shareVariantPath: `${salonId}/client-app/${storageFolder}/share.jpg`,
    legacyPath: `${salonId}/client-app/${storageFolder}`,
  };
}

export async function fetchRemoteClientAppImage(
  url: string,
): Promise<RemoteClientAppImageAsset> {
  let parsedUrl: URL;

  try {
    parsedUrl = new URL(url);
  } catch {
    throw new Error("Use uma URL válida para a imagem premium do app.");
  }

  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    throw new Error("Use uma URL http ou https para a imagem premium do app.");
  }

  const response = await fetch(parsedUrl, {
    headers: { accept: "image/*,*/*;q=0.8" },
  });

  if (!response.ok) {
    throw new Error(
      "Não foi possível baixar a imagem premium informada pela URL.",
    );
  }

  const contentType =
    response.headers.get("content-type")?.split(";")[0].trim() ??
    "application/octet-stream";

  if (!contentType.startsWith("image/")) {
    throw new Error("A URL informada precisa apontar para uma imagem.");
  }

  return {
    buffer: Buffer.from(await response.arrayBuffer()),
    contentType,
  };
}

export async function generateClientAppImageVariants(params: {
  assetKey: ClientAppImageAssetKey;
  sourceBuffer: Buffer;
  focusX: number;
  focusY: number;
  zoom: number;
}) {
  const { assetKey, sourceBuffer, focusX, focusY, zoom } = params;
  const spec = CLIENT_APP_IMAGE_VARIANT_SPECS[assetKey];
  const normalizedSource = await sharp(sourceBuffer, { failOn: "none" })
    .rotate()
    .toBuffer();
  const metadata = await sharp(normalizedSource).metadata();
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;

  if (width <= 0 || height <= 0) {
    throw new Error("Não foi possível processar a imagem premium enviada.");
  }

  const variants = Object.fromEntries(
    await Promise.all(
      Object.entries(spec.outputs).map(async ([variantKind, outputSpec]) => {
        const cropRect = computeCropRect({
          sourceWidth: width,
          sourceHeight: height,
          aspectRatio: outputSpec.aspectRatio,
          focusX,
          focusY,
          zoom,
        });

        const buffer = await sharp(normalizedSource)
          .extract(cropRect)
          .resize(outputSpec.outputWidth, outputSpec.outputHeight, {
            fit: "cover",
            position: "centre",
          })
          .jpeg({
            quality: 86,
            mozjpeg: true,
            progressive: true,
          })
          .toBuffer();

        return [
          variantKind,
          {
            buffer,
            contentType: "image/jpeg",
          },
        ] as const;
      }),
    ),
  ) as Record<
    ClientAppImageVariantKind,
    {
      buffer: Buffer;
      contentType: string;
    }
  >;

  return {
    normalizedSource,
    variants,
  };
}

function computeCropRect(params: {
  sourceWidth: number;
  sourceHeight: number;
  aspectRatio: number;
  focusX: number;
  focusY: number;
  zoom: number;
}) {
  const { sourceWidth, sourceHeight, aspectRatio } = params;
  const focusX = clamp(params.focusX, 0, 100);
  const focusY = clamp(params.focusY, 0, 100);
  const zoom = clamp(params.zoom, 1, 1.8);
  const sourceAspectRatio = sourceWidth / sourceHeight;

  let baseCropWidth = sourceWidth;
  let baseCropHeight = sourceHeight;

  if (sourceAspectRatio > aspectRatio) {
    baseCropWidth = sourceHeight * aspectRatio;
  } else {
    baseCropHeight = sourceWidth / aspectRatio;
  }

  const cropWidth = Math.max(
    1,
    Math.min(sourceWidth, Math.round(baseCropWidth / zoom)),
  );
  const cropHeight = Math.max(
    1,
    Math.min(sourceHeight, Math.round(baseCropHeight / zoom)),
  );
  const centerX = (focusX / 100) * sourceWidth;
  const centerY = (focusY / 100) * sourceHeight;
  const maxLeft = Math.max(0, sourceWidth - cropWidth);
  const maxTop = Math.max(0, sourceHeight - cropHeight);

  return {
    left: Math.round(clamp(centerX - cropWidth / 2, 0, maxLeft)),
    top: Math.round(clamp(centerY - cropHeight / 2, 0, maxTop)),
    width: cropWidth,
    height: cropHeight,
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
