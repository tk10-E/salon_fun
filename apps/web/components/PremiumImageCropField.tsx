"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";

type PremiumImageCropFieldProps = {
  title: string;
  description: string;
  urlFieldId: string;
  urlFieldName: string;
  fileFieldId: string;
  fileFieldName: string;
  removeFieldName: string;
  focusXFieldName: string;
  focusYFieldName: string;
  zoomFieldName: string;
  defaultUrl?: string | null;
  defaultFocusX?: number | null;
  defaultFocusY?: number | null;
  defaultZoom?: number | null;
  currentAssetManagedInStorage?: boolean;
  recommendedRatioLabel: string;
  recommendedSizeLabel: string;
  safeAreaLabel: string;
  aspectRatio: number;
  maxWidth: number;
  maxHeight: number;
};

const DEFAULT_FOCUS = 50;
const DEFAULT_ZOOM = 1;

export function PremiumImageCropField({
  title,
  description,
  urlFieldId,
  urlFieldName,
  fileFieldId,
  fileFieldName,
  removeFieldName,
  focusXFieldName,
  focusYFieldName,
  zoomFieldName,
  defaultUrl,
  defaultFocusX,
  defaultFocusY,
  defaultZoom,
  currentAssetManagedInStorage = false,
  recommendedRatioLabel,
  recommendedSizeLabel,
  safeAreaLabel,
  aspectRatio,
  maxWidth,
  maxHeight,
}: PremiumImageCropFieldProps) {
  const [urlValue, setUrlValue] = useState(defaultUrl?.trim() ?? "");
  const [previewUrl, setPreviewUrl] = useState(defaultUrl?.trim() ?? "");
  const [focusX, setFocusX] = useState(defaultFocusX ?? DEFAULT_FOCUS);
  const [focusY, setFocusY] = useState(defaultFocusY ?? DEFAULT_FOCUS);
  const [zoom, setZoom] = useState(defaultZoom ?? DEFAULT_ZOOM);
  const [removeCurrent, setRemoveCurrent] = useState(false);
  const [selectedFileLabel, setSelectedFileLabel] = useState<string | null>(
    null,
  );
  const [optimizationNote, setOptimizationNote] = useState<string | null>(null);
  const previewRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const draggingRef = useRef(false);
  const hasManagedPreview = useMemo(
    () => Boolean(defaultUrl?.trim()) && currentAssetManagedInStorage,
    [currentAssetManagedInStorage, defaultUrl],
  );

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }
    };
  }, []);

  const releasePreviewObjectUrl = useCallback(() => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  }, []);

  const updateFocusFromPoint = useCallback((clientX: number, clientY: number) => {
    const bounds = previewRef.current?.getBoundingClientRect();
    if (!bounds || bounds.width === 0 || bounds.height === 0) {
      return;
    }

    const nextFocusX = Math.min(
      100,
      Math.max(0, ((clientX - bounds.left) / bounds.width) * 100),
    );
    const nextFocusY = Math.min(
      100,
      Math.max(0, ((clientY - bounds.top) / bounds.height) * 100),
    );

    setFocusX(Math.round(nextFocusX));
    setFocusY(Math.round(nextFocusY));
  }, []);

  const assignFileToInput = useCallback((file: File) => {
    if (!fileInputRef.current || typeof DataTransfer === "undefined") {
      return;
    }

    const transfer = new DataTransfer();
    transfer.items.add(file);
    fileInputRef.current.files = transfer.files;
  }, []);

  const createPreviewFromFile = useCallback(
    async (file: File) => {
      releasePreviewObjectUrl();
      const objectUrl = URL.createObjectURL(file);
      objectUrlRef.current = objectUrl;
      setPreviewUrl(objectUrl);
      setSelectedFileLabel(file.name);
      setRemoveCurrent(false);
    },
    [releasePreviewObjectUrl],
  );

  const optimizeFileForMobile = useCallback(
    async (file: File) => {
      if (
        typeof window === "undefined" ||
        typeof document === "undefined" ||
        typeof HTMLCanvasElement === "undefined"
      ) {
        return file;
      }

      const objectUrl = URL.createObjectURL(file);

      try {
        const image = await new Promise<HTMLImageElement>((resolve, reject) => {
          const element = new Image();
          element.onload = () => resolve(element);
          element.onerror = () =>
            reject(new Error("Não foi possível carregar a imagem."));
          element.src = objectUrl;
        });

        const scale = Math.min(
          1,
          maxWidth / image.width,
          maxHeight / image.height,
        );
        const targetWidth = Math.max(1, Math.round(image.width * scale));
        const targetHeight = Math.max(1, Math.round(image.height * scale));

        if (
          targetWidth === image.width &&
          targetHeight === image.height &&
          file.size < 2 * 1024 * 1024
        ) {
          setOptimizationNote(
            "Arquivo mantido no tamanho original porque já está leve para mobile.",
          );
          return file;
        }

        const canvas = document.createElement("canvas");
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        const context = canvas.getContext("2d");

        if (!context) {
          return file;
        }

        context.drawImage(image, 0, 0, targetWidth, targetHeight);

        const outputType = file.type === "image/png" ? "image/png" : "image/jpeg";
        const blob = await new Promise<Blob | null>((resolve) => {
          canvas.toBlob(resolve, outputType, outputType === "image/png" ? 0.92 : 0.86);
        });

        if (!blob || blob.size >= file.size) {
          setOptimizationNote(
            `Arquivo analisado para mobile em ${targetWidth}x${targetHeight}, mas mantido no original para preservar qualidade.`,
          );
          return file;
        }

        const optimizedFile = new File(
          [blob],
          outputType === file.type ? file.name : file.name.replace(/\.[^.]+$/, ".jpg"),
          { type: outputType },
        );

        setOptimizationNote(
          `Arquivo otimizado automaticamente para ${targetWidth}x${targetHeight} antes do upload.`,
        );

        return optimizedFile;
      } finally {
        URL.revokeObjectURL(objectUrl);
      }
    },
    [maxHeight, maxWidth],
  );

  const handleFileChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const incomingFile = event.target.files?.[0];
      if (!incomingFile) {
        return;
      }

      const optimizedFile = await optimizeFileForMobile(incomingFile);
      assignFileToInput(optimizedFile);
      await createPreviewFromFile(optimizedFile);
    },
    [assignFileToInput, createPreviewFromFile, optimizeFileForMobile],
  );

  const handleUrlChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const nextValue = event.target.value;
      setUrlValue(nextValue);
      setRemoveCurrent(false);

      if (!selectedFileLabel) {
        releasePreviewObjectUrl();
        setPreviewUrl(nextValue.trim());
      }
    },
    [releasePreviewObjectUrl, selectedFileLabel],
  );

  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      draggingRef.current = true;
      event.currentTarget.setPointerCapture(event.pointerId);
      updateFocusFromPoint(event.clientX, event.clientY);
    },
    [updateFocusFromPoint],
  );

  const handlePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!draggingRef.current) {
        return;
      }

      updateFocusFromPoint(event.clientX, event.clientY);
    },
    [updateFocusFromPoint],
  );

  const handlePointerUp = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      draggingRef.current = false;
      event.currentTarget.releasePointerCapture(event.pointerId);
    },
    [],
  );

  const visiblePreview = removeCurrent ? "" : previewUrl;
  const markerStyle = {
    left: `${focusX}%`,
    top: `${focusY}%`,
  };

  return (
    <div className="premium-settings-panel premium-image-crop-field">
      <div className="brand-asset-guide__header">
        <strong>{title}</strong>
        <p className="muted">{description}</p>
      </div>

      <div className="brand-asset-guide__badges">
        <span>{recommendedRatioLabel}</span>
        <span>{recommendedSizeLabel}</span>
        <span>{safeAreaLabel}</span>
      </div>

      <div className="split-grid">
        <div className="field">
          <label htmlFor={urlFieldId}>{title} por URL</label>
          <input
            id={urlFieldId}
            name={urlFieldName}
            type="url"
            value={urlValue}
            onChange={handleUrlChange}
            placeholder="https://..."
          />
          <small className="muted">
            Pode usar URL externa ou trocar por upload otimizado logo ao lado.
          </small>
        </div>

        <div className="field">
          <label htmlFor={fileFieldId}>{title} por arquivo</label>
          <input
            ref={fileInputRef}
            id={fileFieldId}
            name={fileFieldName}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={handleFileChange}
          />
          <small className="muted">
            O arquivo é reduzido automaticamente para um tamanho mais leve para o app.
          </small>
        </div>
      </div>

      <div className="premium-image-crop-field__stage">
        <div className="premium-image-crop-field__preview-wrap">
          <div
            ref={previewRef}
            className="premium-image-crop-field__preview"
            style={{ aspectRatio: String(aspectRatio) }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          >
            {visiblePreview ? (
              <img
                src={visiblePreview}
                alt={title}
                style={{
                  objectPosition: `${focusX}% ${focusY}%`,
                  transform: `scale(${zoom})`,
                }}
              />
            ) : (
              <div className="premium-image-crop-field__empty">
                <strong>Sem imagem definida</strong>
                <span>Envie um arquivo ou cole uma URL para montar a vitrine premium.</span>
              </div>
            )}
            <div className="brand-asset-card__safe-area" />
            <span className="premium-image-crop-field__focus-marker" style={markerStyle} />
          </div>
          <p className="premium-image-crop-field__hint">
            Arraste sobre a imagem para reposicionar o foco salvo.
          </p>
        </div>

        <div className="premium-image-crop-field__controls">
          <div className="field">
            <label htmlFor={`${urlFieldId}-focus-x`}>Foco horizontal</label>
            <input
              id={`${urlFieldId}-focus-x`}
              type="range"
              min="0"
              max="100"
              value={focusX}
              onChange={(event) => setFocusX(Number(event.target.value))}
            />
            <small className="muted">{focusX}%</small>
          </div>

          <div className="field">
            <label htmlFor={`${urlFieldId}-focus-y`}>Foco vertical</label>
            <input
              id={`${urlFieldId}-focus-y`}
              type="range"
              min="0"
              max="100"
              value={focusY}
              onChange={(event) => setFocusY(Number(event.target.value))}
            />
            <small className="muted">{focusY}%</small>
          </div>

          <div className="field">
            <label htmlFor={`${urlFieldId}-zoom`}>Zoom da imagem</label>
            <input
              id={`${urlFieldId}-zoom`}
              type="range"
              min="1"
              max="1.8"
              step="0.01"
              value={zoom}
              onChange={(event) => setZoom(Number(event.target.value))}
            />
            <small className="muted">{zoom.toFixed(2)}x</small>
          </div>

          <label className="toggle-pill" style={{ width: "fit-content" }}>
            <input
              type="checkbox"
              name={removeFieldName}
              checked={removeCurrent}
              onChange={(event) => setRemoveCurrent(event.target.checked)}
            />
            <span>Remover imagem atual</span>
          </label>

          <div className="premium-image-crop-field__meta">
            <span>
              {hasManagedPreview
                ? "Imagem atual hospedada na plataforma."
                : defaultUrl?.trim()
                  ? "Imagem atual apontando para URL externa."
                  : "Ainda sem imagem publicada."}
            </span>
            {selectedFileLabel ? <span>Arquivo pronto: {selectedFileLabel}</span> : null}
            {optimizationNote ? <span>{optimizationNote}</span> : null}
          </div>
        </div>
      </div>

      <input type="hidden" name={focusXFieldName} value={String(focusX)} />
      <input type="hidden" name={focusYFieldName} value={String(focusY)} />
      <input type="hidden" name={zoomFieldName} value={zoom.toFixed(2)} />
    </div>
  );
}
