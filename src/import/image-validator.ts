import type {
  ImportErrorInfo,
  ImportSafetyLimits,
  SupportedImageMime,
} from '@/types/editor';
import { formatBytes } from '@/lib/utils';

export const DEFAULT_IMPORT_LIMITS: ImportSafetyLimits = {
  maxFileSizeBytes: 50 * 1024 * 1024, // 50 MB
  maxDimensionPx: 12000, // 12,000 px max width or height
  maxMegapixels: 64_000_000, // 64 MP max pixel area
};

export const SUPPORTED_MIME_TYPES: readonly SupportedImageMime[] = [
  'image/png',
  'image/jpeg',
  'image/webp',
] as const;

export function detectImageMimeFromBytes(bytes: Uint8Array): SupportedImageMime | null {
  if (bytes.length >= 8) {
    // PNG magic signature: 89 50 4E 47 0D 0A 1A 0A
    if (
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47 &&
      bytes[4] === 0x0d &&
      bytes[5] === 0x0a &&
      bytes[6] === 0x1a &&
      bytes[7] === 0x0a
    ) {
      return 'image/png';
    }
  }

  if (bytes.length >= 3) {
    // JPEG magic signature: FF D8 FF
    if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
      return 'image/jpeg';
    }
  }

  if (bytes.length >= 12) {
    // WebP magic signature: "RIFF" .... "WEBP"
    if (
      bytes[0] === 0x52 &&
      bytes[1] === 0x49 &&
      bytes[2] === 0x46 &&
      bytes[3] === 0x46 &&
      bytes[8] === 0x57 &&
      bytes[9] === 0x45 &&
      bytes[10] === 0x42 &&
      bytes[11] === 0x50
    ) {
      return 'image/webp';
    }
  }

  return null;
}

export function isProjectFileName(fileName: string): boolean {
  const lower = fileName.trim().toLowerCase();
  return lower.endsWith('.snapmark') || lower.endsWith('.snapmark.json') || lower.endsWith('.json');
}

export interface FileValidationSuccess {
  ok: true;
  detectedMime: SupportedImageMime;
}

export interface FileValidationFailure {
  ok: false;
  error: ImportErrorInfo;
}

export type FileValidationResult = FileValidationSuccess | FileValidationFailure;

export function validateImageBytesAndMeta(
  meta: { name: string; type: string; size: number },
  headerBytes: Uint8Array,
  limits: ImportSafetyLimits = DEFAULT_IMPORT_LIMITS
): FileValidationResult {
  if (meta.size <= 0 || headerBytes.length === 0) {
    return {
      ok: false,
      error: {
        code: 'EMPTY_FILE',
        title: 'Empty File',
        message: `"${meta.name || 'Clipboard image'}" contains 0 bytes and cannot be opened.`,
        fileName: meta.name,
        detectedType: meta.type || 'unknown',
        fileSizeBytes: meta.size,
      },
    };
  }

  if (meta.size > limits.maxFileSizeBytes) {
    return {
      ok: false,
      error: {
        code: 'FILE_TOO_LARGE',
        title: 'Image File Too Large',
        message: `"${meta.name}" is ${formatBytes(meta.size)}, exceeding the ${formatBytes(limits.maxFileSizeBytes)} local browser safety limit.`,
        fileName: meta.name,
        detectedType: meta.type || 'unknown',
        fileSizeBytes: meta.size,
      },
    };
  }

  const detectedMime = detectImageMimeFromBytes(headerBytes);

  if (!detectedMime) {
    const claimedSupported = (SUPPORTED_MIME_TYPES as readonly string[]).includes(meta.type);
    if (claimedSupported) {
      return {
        ok: false,
        error: {
          code: 'INVALID_SIGNATURE',
          title: 'Corrupted or Invalid Image Data',
          message: `"${meta.name}" claims to be ${meta.type}, but its file header is not a valid PNG, JPEG, or WebP image.`,
          fileName: meta.name,
          detectedType: meta.type,
          fileSizeBytes: meta.size,
        },
      };
    }

    return {
      ok: false,
      error: {
        code: 'UNSUPPORTED_TYPE',
        title: 'Unsupported File Format',
        message: `"${meta.name}" (${meta.type || 'unrecognized format'}) is not supported. Please import a PNG, JPEG, or WebP screenshot, or a .snapmark project file.`,
        fileName: meta.name,
        detectedType: meta.type || 'unrecognized',
        fileSizeBytes: meta.size,
      },
    };
  }

  return {
    ok: true,
    detectedMime,
  };
}

export function validateImageDimensions(
  width: number,
  height: number,
  fileName = 'Image',
  limits: ImportSafetyLimits = DEFAULT_IMPORT_LIMITS
): ImportErrorInfo | null {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return {
      code: 'DECODE_FAILED',
      title: 'Unable to Decode Image',
      message: `"${fileName}" reported invalid dimensions (${width} × ${height}). The image file may be truncated or corrupted.`,
      fileName,
    };
  }

  if (width > limits.maxDimensionPx || height > limits.maxDimensionPx) {
    return {
      code: 'DIMENSIONS_EXCEEDED',
      title: 'Image Dimensions Exceed Safety Limit',
      message: `"${fileName}" is ${width.toLocaleString()} × ${height.toLocaleString()} px, exceeding the maximum ${limits.maxDimensionPx.toLocaleString()} px edge limit.`,
      fileName,
    };
  }

  const totalPixels = width * height;
  if (totalPixels > limits.maxMegapixels) {
    const mp = (totalPixels / 1_000_000).toFixed(1);
    const maxMp = (limits.maxMegapixels / 1_000_000).toFixed(0);
    return {
      code: 'MEGAPIXELS_EXCEEDED',
      title: 'Image Resolution Too High',
      message: `"${fileName}" is ${mp} MP (${width.toLocaleString()} × ${height.toLocaleString()} px), exceeding the ${maxMp} MP browser canvas limit.`,
      fileName,
    };
  }

  return null;
}
