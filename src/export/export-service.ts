import type {
  AnnotationObject,
  ExportOptions,
  LoadedImageAsset,
} from '@/types/editor';
import { clamp, sanitizeFileName } from '@/lib/utils';
import { renderFlattenedCanvas } from './flatten-renderer';

export interface ExportBlobResult {
  blob: Blob;
  width: number;
  height: number;
  mimeType: 'image/png' | 'image/jpeg';
  fileName: string;
}

function canvasToBlobAsync(
  canvas: HTMLCanvasElement,
  mimeType: 'image/png' | 'image/jpeg',
  quality?: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    try {
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(
              new Error(
                'Browser failed to encode the exported image. Try a smaller export scale.'
              )
            );
          }
        },
        mimeType,
        quality
      );
    } catch (err) {
      if (err instanceof DOMException && err.name === 'SecurityError') {
        reject(
          new Error(
            'Canvas export was blocked by cross-origin security restrictions (tainted canvas).'
          )
        );
      } else {
        reject(err instanceof Error ? err : new Error('Unexpected canvas export failure.'));
      }
    }
  });
}

export async function generateFlattenedExportBlob(params: {
  image: LoadedImageAsset;
  annotations: AnnotationObject[];
  options: ExportOptions;
}): Promise<ExportBlobResult> {
  const { image, annotations, options } = params;

  const canvas = renderFlattenedCanvas({
    image,
    annotations,
    scale: options.scale,
    format: options.format,
    backgroundFillEnabled: options.backgroundFillEnabled,
    backgroundFillColor: options.backgroundFillColor,
  });

  const mimeType = options.format === 'jpeg' ? 'image/jpeg' : 'image/png';
  const quality =
    options.format === 'jpeg' ? clamp(options.quality, 0.1, 1) : undefined;

  const blob = await canvasToBlobAsync(canvas, mimeType, quality);

  const ext = options.format === 'jpeg' ? 'jpg' : 'png';
  const baseName = sanitizeFileName(options.fileName, 'annotated-screenshot');
  const fileName = `${baseName}.${ext}`;

  return {
    blob,
    width: canvas.width,
    height: canvas.height,
    mimeType,
    fileName,
  };
}

export function triggerBlobDownload(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export function isClipboardImageWriteSupported(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  return Boolean(
    navigator.clipboard &&
      typeof navigator.clipboard.write === 'function' &&
      typeof window.ClipboardItem !== 'undefined'
  );
}

export async function copyFlattenedImageToClipboard(params: {
  image: LoadedImageAsset;
  annotations: AnnotationObject[];
  scale?: 1 | 2;
  backgroundFillEnabled?: boolean;
  backgroundFillColor?: string;
}): Promise<{ width: number; height: number }> {
  if (!isClipboardImageWriteSupported()) {
    throw new Error(
      'Copying images directly to the clipboard is not supported in this browser context. Please download as PNG instead.'
    );
  }

  const result = await generateFlattenedExportBlob({
    image: params.image,
    annotations: params.annotations,
    options: {
      format: 'png',
      quality: 1,
      scale: params.scale ?? 1,
      backgroundFillEnabled: params.backgroundFillEnabled ?? false,
      backgroundFillColor: params.backgroundFillColor ?? '#ffffff',
      fileName: 'clipboard-export',
    },
  });

  const item = new ClipboardItem({ 'image/png': result.blob });
  await navigator.clipboard.write([item]);
  return { width: result.width, height: result.height };
}
