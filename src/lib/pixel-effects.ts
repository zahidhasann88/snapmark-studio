import type { BoundingBox } from '@/types/editor';
import { clamp, parseHexRgb } from './utils';

export interface ClampedPixelRect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  width: number;
  height: number;
}

export function clampRectToImage(
  rect: BoundingBox,
  imageWidth: number,
  imageHeight: number
): ClampedPixelRect | null {
  const x0 = clamp(Math.floor(rect.x), 0, imageWidth);
  const y0 = clamp(Math.floor(rect.y), 0, imageHeight);
  const x1 = clamp(Math.ceil(rect.x + rect.width), 0, imageWidth);
  const y1 = clamp(Math.ceil(rect.y + rect.height), 0, imageHeight);

  const width = x1 - x0;
  const height = y1 - y0;
  if (width <= 0 || height <= 0) return null;

  return { x0, y0, x1, y1, width, height };
}

export function applyOpaqueRedactionToBuffer(
  imageData: ImageData,
  rect: BoundingBox,
  hexColor: string
): void {
  const clamped = clampRectToImage(rect, imageData.width, imageData.height);
  if (!clamped) return;

  const { r, g, b } = parseHexRgb(hexColor);
  const data = imageData.data;
  const imgW = imageData.width;

  for (let y = clamped.y0; y < clamped.y1; y++) {
    let offset = (y * imgW + clamped.x0) * 4;
    for (let x = clamped.x0; x < clamped.x1; x++) {
      data[offset] = r;
      data[offset + 1] = g;
      data[offset + 2] = b;
      data[offset + 3] = 255;
      offset += 4;
    }
  }
}

export function applyPixelateToBuffer(
  imageData: ImageData,
  rect: BoundingBox,
  blockSize: number
): void {
  const clamped = clampRectToImage(rect, imageData.width, imageData.height);
  if (!clamped) return;

  const step = Math.max(2, Math.round(blockSize));
  const data = imageData.data;
  const imgW = imageData.width;

  for (let by = clamped.y0; by < clamped.y1; by += step) {
    const bhEnd = Math.min(by + step, clamped.y1);
    for (let bx = clamped.x0; bx < clamped.x1; bx += step) {
      const bwEnd = Math.min(bx + step, clamped.x1);

      let sumR = 0;
      let sumG = 0;
      let sumB = 0;
      let sumA = 0;
      let count = 0;

      for (let y = by; y < bhEnd; y++) {
        let offset = (y * imgW + bx) * 4;
        for (let x = bx; x < bwEnd; x++) {
          sumR += data[offset] ?? 0;
          sumG += data[offset + 1] ?? 0;
          sumB += data[offset + 2] ?? 0;
          sumA += data[offset + 3] ?? 0;
          count++;
          offset += 4;
        }
      }

      if (count === 0) continue;
      const avgR = Math.round(sumR / count);
      const avgG = Math.round(sumG / count);
      const avgB = Math.round(sumB / count);
      const avgA = Math.round(sumA / count);

      for (let y = by; y < bhEnd; y++) {
        let offset = (y * imgW + bx) * 4;
        for (let x = bx; x < bwEnd; x++) {
          data[offset] = avgR;
          data[offset + 1] = avgG;
          data[offset + 2] = avgB;
          data[offset + 3] = avgA;
          offset += 4;
        }
      }
    }
  }
}

export function applyBoxBlurToBuffer(
  imageData: ImageData,
  rect: BoundingBox,
  blurRadius: number
): void {
  const clamped = clampRectToImage(rect, imageData.width, imageData.height);
  if (!clamped) return;

  const rw = clamped.width;
  const rh = clamped.height;
  const radius = clamp(Math.round(blurRadius), 1, 64);

  const src = new Uint8ClampedArray(rw * rh * 4);
  const dst = new Uint8ClampedArray(rw * rh * 4);
  const fullData = imageData.data;
  const imgW = imageData.width;

  for (let y = 0; y < rh; y++) {
    const fullRowStart = ((clamped.y0 + y) * imgW + clamped.x0) * 4;
    src.set(fullData.subarray(fullRowStart, fullRowStart + rw * 4), y * rw * 4);
  }

  const kernelSize = radius * 2 + 1;

  for (let pass = 0; pass < 3; pass++) {
    for (let y = 0; y < rh; y++) {
      let sumR = 0;
      let sumG = 0;
      let sumB = 0;
      let sumA = 0;
      const rowOffset = y * rw;

      for (let k = -radius; k <= radius; k++) {
        const cx = clamp(k, 0, rw - 1);
        const idx = (rowOffset + cx) * 4;
        sumR += src[idx] ?? 0;
        sumG += src[idx + 1] ?? 0;
        sumB += src[idx + 2] ?? 0;
        sumA += src[idx + 3] ?? 0;
      }

      for (let x = 0; x < rw; x++) {
        const outIdx = (rowOffset + x) * 4;
        dst[outIdx] = Math.round(sumR / kernelSize);
        dst[outIdx + 1] = Math.round(sumG / kernelSize);
        dst[outIdx + 2] = Math.round(sumB / kernelSize);
        dst[outIdx + 3] = Math.round(sumA / kernelSize);

        const removeX = clamp(x - radius, 0, rw - 1);
        const addX = clamp(x + radius + 1, 0, rw - 1);
        const rIdx = (rowOffset + removeX) * 4;
        const aIdx = (rowOffset + addX) * 4;

        sumR += (src[aIdx] ?? 0) - (src[rIdx] ?? 0);
        sumG += (src[aIdx + 1] ?? 0) - (src[rIdx + 1] ?? 0);
        sumB += (src[aIdx + 2] ?? 0) - (src[rIdx + 2] ?? 0);
        sumA += (src[aIdx + 3] ?? 0) - (src[rIdx + 3] ?? 0);
      }
    }

    for (let x = 0; x < rw; x++) {
      let sumR = 0;
      let sumG = 0;
      let sumB = 0;
      let sumA = 0;

      for (let k = -radius; k <= radius; k++) {
        const cy = clamp(k, 0, rh - 1);
        const idx = (cy * rw + x) * 4;
        sumR += dst[idx] ?? 0;
        sumG += dst[idx + 1] ?? 0;
        sumB += dst[idx + 2] ?? 0;
        sumA += dst[idx + 3] ?? 0;
      }

      for (let y = 0; y < rh; y++) {
        const outIdx = (y * rw + x) * 4;
        src[outIdx] = Math.round(sumR / kernelSize);
        src[outIdx + 1] = Math.round(sumG / kernelSize);
        src[outIdx + 2] = Math.round(sumB / kernelSize);
        src[outIdx + 3] = Math.round(sumA / kernelSize);

        const removeY = clamp(y - radius, 0, rh - 1);
        const addY = clamp(y + radius + 1, 0, rh - 1);
        const rIdx = (removeY * rw + x) * 4;
        const aIdx = (addY * rw + x) * 4;

        sumR += (dst[aIdx] ?? 0) - (dst[rIdx] ?? 0);
        sumG += (dst[aIdx + 1] ?? 0) - (dst[rIdx + 1] ?? 0);
        sumB += (dst[aIdx + 2] ?? 0) - (dst[rIdx + 2] ?? 0);
        sumA += (dst[aIdx + 3] ?? 0) - (dst[rIdx + 3] ?? 0);
      }
    }
  }

  for (let y = 0; y < rh; y++) {
    const fullRowStart = ((clamped.y0 + y) * imgW + clamped.x0) * 4;
    fullData.set(src.subarray(y * rw * 4, (y + 1) * rw * 4), fullRowStart);
  }
}
