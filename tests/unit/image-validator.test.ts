import { describe, expect, it } from 'vitest';
import {
  DEFAULT_IMPORT_LIMITS,
  detectImageMimeFromBytes,
  validateImageBytesAndMeta,
  validateImageDimensions,
} from '@/import/image-validator';

const PNG_HEADER = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
const JPEG_HEADER = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const WEBP_HEADER = new Uint8Array([
  0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
]);
const TEXT_HEADER = new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f]);

describe('Image Import & Validation', () => {
  it('detects PNG, JPEG, and WebP magic byte signatures accurately', () => {
    expect(detectImageMimeFromBytes(PNG_HEADER)).toBe('image/png');
    expect(detectImageMimeFromBytes(JPEG_HEADER)).toBe('image/jpeg');
    expect(detectImageMimeFromBytes(WEBP_HEADER)).toBe('image/webp');
    expect(detectImageMimeFromBytes(TEXT_HEADER)).toBeNull();
  });

  it('rejects empty files with EMPTY_FILE error', () => {
    const res = validateImageBytesAndMeta(
      { name: 'empty.png', type: 'image/png', size: 0 },
      new Uint8Array([])
    );
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe('EMPTY_FILE');
    }
  });

  it('rejects files exceeding safety byte limit', () => {
    const res = validateImageBytesAndMeta(
      { name: 'huge.png', type: 'image/png', size: 60 * 1024 * 1024 },
      PNG_HEADER,
      DEFAULT_IMPORT_LIMITS
    );
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe('FILE_TOO_LARGE');
    }
  });

  it('rejects spoofed files claiming image/png with non-image header bytes', () => {
    const res = validateImageBytesAndMeta(
      { name: 'fake.png', type: 'image/png', size: 1024 },
      TEXT_HEADER
    );
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe('INVALID_SIGNATURE');
    }
  });

  it('rejects unsupported file formats with UNSUPPORTED_TYPE', () => {
    const res = validateImageBytesAndMeta(
      { name: 'notes.pdf', type: 'application/pdf', size: 2048 },
      TEXT_HEADER
    );
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe('UNSUPPORTED_TYPE');
    }
  });

  it('validates dimensions and megapixel safety bounds', () => {
    expect(validateImageDimensions(1920, 1080, 'ok.png')).toBeNull();

    const edgeErr = validateImageDimensions(14000, 800, 'wide.png');
    expect(edgeErr?.code).toBe('DIMENSIONS_EXCEEDED');

    const mpErr = validateImageDimensions(9000, 9000, '81mp.png');
    expect(mpErr?.code).toBe('MEGAPIXELS_EXCEEDED');

    const zeroErr = validateImageDimensions(0, 500, 'broken.png');
    expect(zeroErr?.code).toBe('DECODE_FAILED');
  });
});
