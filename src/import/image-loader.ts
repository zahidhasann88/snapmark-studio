import type {
  ImportErrorInfo,
  ImportSafetyLimits,
  LoadedImageAsset,
  SupportedImageMime,
} from '@/types/editor';
import { createId } from '@/lib/utils';
import {
  DEFAULT_IMPORT_LIMITS,
  validateImageBytesAndMeta,
  validateImageDimensions,
} from './image-validator';

const assetRegistry = new Map<string, LoadedImageAsset>();

export function registerImageAsset(asset: LoadedImageAsset): void {
  assetRegistry.set(asset.assetId, asset);
}

export function getImageAsset(assetId: string | null | undefined): LoadedImageAsset | null {
  if (!assetId) return null;
  return assetRegistry.get(assetId) ?? null;
}

export function releaseImageAsset(assetId: string): void {
  const existing = assetRegistry.get(assetId);
  if (!existing) return;
  if (existing.objectUrl) {
    try {
      URL.revokeObjectURL(existing.objectUrl);
    } catch {
      // Ignore revoke errors in non-browser test environments
    }
  }
  assetRegistry.delete(assetId);
}

export function clearUnusedImageAssets(referencedAssetIds: Set<string>): void {
  for (const [assetId] of assetRegistry.entries()) {
    if (!referencedAssetIds.has(assetId)) {
      releaseImageAsset(assetId);
    }
  }
}

function detectImageTransparency(
  img: HTMLImageElement,
  mimeType: SupportedImageMime
): boolean {
  if (mimeType === 'image/jpeg') return false;
  if (typeof document === 'undefined') return false;

  try {
    const sampleW = Math.min(img.naturalWidth || img.width, 160);
    const sampleH = Math.min(img.naturalHeight || img.height, 160);
    if (sampleW <= 0 || sampleH <= 0) return false;

    const canvas = document.createElement('canvas');
    canvas.width = sampleW;
    canvas.height = sampleH;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return false;

    ctx.drawImage(img, 0, 0, sampleW, sampleH);
    const { data } = ctx.getImageData(0, 0, sampleW, sampleH);
    for (let i = 3; i < data.length; i += 4) {
      if ((data[i] ?? 255) < 255) {
        return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}

function readBlobAsDataUrl(
  blob: Blob,
  onProgress?: (percent: number, stage: string) => void
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onprogress = (evt) => {
      if (evt.lengthComputable && evt.total > 0) {
        const pct = Math.round((evt.loaded / evt.total) * 55) + 10;
        onProgress?.(pct, 'Reading image data locally…');
      }
    };
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to read image data URL'));
      }
    };
    reader.onerror = () => reject(reader.error ?? new Error('File read error'));
    reader.readAsDataURL(blob);
  });
}

function decodeHtmlImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Image decoding failed'));
    img.src = src;
  });
}

function readHeaderSlice(file: Blob, length = 16): Promise<Uint8Array> {
  const slice = file.slice(0, length);
  if (typeof slice.arrayBuffer === 'function') {
    return slice.arrayBuffer().then((buf) => new Uint8Array(buf));
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) {
        resolve(new Uint8Array(reader.result));
      } else {
        reject(new Error('Unable to inspect file header'));
      }
    };
    reader.onerror = () => reject(reader.error ?? new Error('Unable to inspect file header'));
    reader.readAsArrayBuffer(slice);
  });
}

export type LoadImageResult =
  | { ok: true; asset: LoadedImageAsset }
  | { ok: false; error: ImportErrorInfo };

export async function loadAndValidateImageFile(
  file: File,
  options?: {
    limits?: ImportSafetyLimits;
    onProgress?: (percent: number, stage: string) => void;
  }
): Promise<LoadImageResult> {
  const limits = options?.limits ?? DEFAULT_IMPORT_LIMITS;
  const onProgress = options?.onProgress;

  onProgress?.(5, 'Validating file format…');

  let headerBytes: Uint8Array;
  try {
    headerBytes = await readHeaderSlice(file, 16);
  } catch {
    return {
      ok: false,
      error: {
        code: 'DECODE_FAILED',
        title: 'Could Not Read File',
        message: `Failed to read "${file.name}". Please ensure the file is accessible on your device.`,
        fileName: file.name,
        fileSizeBytes: file.size,
      },
    };
  }

  const metaCheck = validateImageBytesAndMeta(
    { name: file.name || 'Pasted Screenshot', type: file.type, size: file.size },
    headerBytes,
    limits
  );

  if (!metaCheck.ok) {
    return { ok: false, error: metaCheck.error };
  }

  if (file.size > 1024 * 1024 && typeof window !== 'undefined') {
    await new Promise<void>((r) => requestAnimationFrame(() => r()));
  }

  let objectUrl: string | null = null;
  try {
    const normalizedBlob = new Blob([file], { type: metaCheck.detectedMime });
    if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
      objectUrl = URL.createObjectURL(normalizedBlob);
    }

    const dataUrl = await readBlobAsDataUrl(normalizedBlob, onProgress);
    onProgress?.(72, 'Decoding image dimensions…');

    const imgElement = await decodeHtmlImage(objectUrl ?? dataUrl);
    const width = imgElement.naturalWidth || imgElement.width;
    const height = imgElement.naturalHeight || imgElement.height;

    const dimError = validateImageDimensions(
      width,
      height,
      file.name || 'Pasted Screenshot',
      limits
    );

    if (dimError) {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      return { ok: false, error: dimError };
    }

    onProgress?.(90, 'Checking alpha channel…');
    const hasTransparency = detectImageTransparency(imgElement, metaCheck.detectedMime);

    const asset: LoadedImageAsset = {
      assetId: createId('img'),
      name: file.name || 'pasted-screenshot.png',
      mimeType: metaCheck.detectedMime,
      width,
      height,
      byteSize: file.size,
      hasTransparency,
      dataUrl,
      objectUrl,
      element: imgElement,
    };

    registerImageAsset(asset);
    onProgress?.(100, 'Ready');
    return { ok: true, asset };
  } catch {
    if (objectUrl) {
      try {
        URL.revokeObjectURL(objectUrl);
      } catch {
        // ignore
      }
    }
    return {
      ok: false,
      error: {
        code: 'DECODE_FAILED',
        title: 'Image Could Not Be Decoded',
        message: `"${file.name || 'Image'}" could not be decoded by your browser. The image stream may be damaged or corrupted.`,
        fileName: file.name,
        detectedType: metaCheck.detectedMime,
        fileSizeBytes: file.size,
      },
    };
  }
}

export async function loadImageAssetFromDataUrl(params: {
  dataUrl: string;
  name: string;
  mimeType: SupportedImageMime;
  limits?: ImportSafetyLimits;
}): Promise<LoadImageResult> {
  const limits = params.limits ?? DEFAULT_IMPORT_LIMITS;
  try {
    const imgElement = await decodeHtmlImage(params.dataUrl);
    const width = imgElement.naturalWidth || imgElement.width;
    const height = imgElement.naturalHeight || imgElement.height;

    const dimError = validateImageDimensions(width, height, params.name, limits);
    if (dimError) {
      return { ok: false, error: dimError };
    }

    const approxBytes = Math.round((params.dataUrl.length * 3) / 4);
    const hasTransparency = detectImageTransparency(imgElement, params.mimeType);

    const asset: LoadedImageAsset = {
      assetId: createId('img'),
      name: params.name,
      mimeType: params.mimeType,
      width,
      height,
      byteSize: approxBytes,
      hasTransparency,
      dataUrl: params.dataUrl,
      objectUrl: null,
      element: imgElement,
    };

    registerImageAsset(asset);
    return { ok: true, asset };
  } catch {
    return {
      ok: false,
      error: {
        code: 'DECODE_FAILED',
        title: 'Project Image Decode Failed',
        message: `Embedded screenshot "${params.name}" in the project file could not be decoded.`,
        fileName: params.name,
      },
    };
  }
}
