import { describe, expect, it } from 'vitest';
import {
  applyBoxBlurToBuffer,
  applyOpaqueRedactionToBuffer,
  applyPixelateToBuffer,
} from '@/lib/pixel-effects';
import {
  computeExportDimensions,
  validateExportScaleBounds,
} from '@/export/flatten-renderer';

function createSecretPatternImageData(width: number, height: number): ImageData {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      if ((x + y) % 2 === 0) {
        data[idx] = 255;
        data[idx + 1] = 0;
        data[idx + 2] = 128;
        data[idx + 3] = 255;
      } else {
        data[idx] = 0;
        data[idx + 1] = 240;
        data[idx + 2] = 255;
        data[idx + 3] = 180;
      }
    }
  }
  return new ImageData(data, width, height);
}

describe('Permanent Redaction, Blur/Pixelate & Export Dimensions', () => {
  it('permanently destroys underlying pixels inside opaque redaction bounds at 100% alpha', () => {
    const img = createSecretPatternImageData(100, 80);

    applyOpaqueRedactionToBuffer(
      img,
      { x: 20.4, y: 15.7, width: 30.2, height: 20.3 },
      '#000000'
    );

    for (let y = 15; y < 36; y++) {
      for (let x = 20; x < 51; x++) {
        const idx = (y * 100 + x) * 4;
        expect(img.data[idx]).toBe(0);
        expect(img.data[idx + 1]).toBe(0);
        expect(img.data[idx + 2]).toBe(0);
        expect(img.data[idx + 3]).toBe(255);
      }
    }

    const outsideIdx = (5 * 100 + 5) * 4;
    expect(img.data[outsideIdx]).toBe(255);
    expect(img.data[outsideIdx + 2]).toBe(128);
  });

  it('applies uniform block mosaic pixelation strictly within target region', () => {
    const img = createSecretPatternImageData(60, 60);
    applyPixelateToBuffer(img, { x: 10, y: 10, width: 20, height: 20 }, 10);

    const baseIdx = (10 * 60 + 10) * 4;
    const r0 = img.data[baseIdx];
    const g0 = img.data[baseIdx + 1];
    const b0 = img.data[baseIdx + 2];

    for (let y = 10; y < 20; y++) {
      for (let x = 10; x < 20; x++) {
        const idx = (y * 60 + x) * 4;
        expect(img.data[idx]).toBe(r0);
        expect(img.data[idx + 1]).toBe(g0);
        expect(img.data[idx + 2]).toBe(b0);
      }
    }
  });

  it('smooths high-frequency contrast inside blur region without bleeding outside', () => {
    const img = createSecretPatternImageData(60, 60);
    applyBoxBlurToBuffer(img, { x: 15, y: 15, width: 30, height: 30 }, 6);

    const centerIdx = (30 * 60 + 30) * 4;
    expect(img.data[centerIdx]!).toBeGreaterThan(90);
    expect(img.data[centerIdx]!).toBeLessThan(165);

    const untouchedIdx = (2 * 60 + 2) * 4;
    expect(img.data[untouchedIdx]).toBe(255);
    expect(img.data[untouchedIdx + 1]).toBe(0);
  });

  it('computes scaled export dimensions preserving aspect ratio and validates safety bounds', () => {
    expect(computeExportDimensions(1280, 800, 0.5)).toEqual({ width: 640, height: 400 });
    expect(computeExportDimensions(1280, 800, 1)).toEqual({ width: 1280, height: 800 });
    expect(computeExportDimensions(1280, 800, 2)).toEqual({ width: 2560, height: 1600 });

    expect(validateExportScaleBounds(1920, 1080, 2)).toBeNull();
    expect(validateExportScaleBounds(10000, 8000, 3)).toContain('exceed');
  });
});
