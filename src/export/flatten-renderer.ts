import type {
  AnnotationObject,
  ExportFormat,
  ExportScale,
  LoadedImageAsset,
} from '@/types/editor';
import { computeArrowGeometry } from '@/lib/geometry';
import {
  applyBoxBlurToBuffer,
  applyOpaqueRedactionToBuffer,
  applyPixelateToBuffer,
} from '@/lib/pixel-effects';
import { clamp, hexToRgba, parseHexRgb } from '@/lib/utils';

export const MAX_EXPORT_DIMENSION = 16384;
export const MAX_EXPORT_PIXELS = 80_000_000;

export interface FlattenRenderParams {
  image: LoadedImageAsset;
  annotations: AnnotationObject[];
  scale: ExportScale;
  format: ExportFormat;
  backgroundFillEnabled: boolean;
  backgroundFillColor: string;
}

export function computeExportDimensions(
  imageWidth: number,
  imageHeight: number,
  scale: number
): { width: number; height: number } {
  const width = Math.max(1, Math.round(imageWidth * scale));
  const height = Math.max(1, Math.round(imageHeight * scale));
  return { width, height };
}

export function validateExportScaleBounds(
  imageWidth: number,
  imageHeight: number,
  scale: number
): string | null {
  const { width, height } = computeExportDimensions(imageWidth, imageHeight, scale);
  if (width > MAX_EXPORT_DIMENSION || height > MAX_EXPORT_DIMENSION) {
    return `Scaled export dimensions (${width.toLocaleString()} × ${height.toLocaleString()} px) exceed browser canvas limit (${MAX_EXPORT_DIMENSION.toLocaleString()} px). Choose a lower scale.`;
  }
  if (width * height > MAX_EXPORT_PIXELS) {
    return `Scaled export resolution (${((width * height) / 1_000_000).toFixed(1)} MP) exceeds safe browser memory limit (${MAX_EXPORT_PIXELS / 1_000_000} MP). Choose 1x or 0.5x scale.`;
  }
  return null;
}

export function wrapCanvasTextLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const paragraphs = (text || '').split('\n');
  const lines: string[] = [];

  for (const para of paragraphs) {
    if (para.length === 0) {
      lines.push('');
      continue;
    }

    const words = para.split(/(\s+)/);
    let currentLine = '';

    for (const token of words) {
      if (token.length === 0) continue;
      const candidate = currentLine + token;
      const measured = ctx.measureText(candidate).width;

      if (measured <= maxWidth || currentLine.length === 0) {
        if (currentLine.length === 0 && measured > maxWidth && token.trim().length > 1) {
          let chunk = '';
          for (const ch of token) {
            if (ctx.measureText(chunk + ch).width > maxWidth && chunk.length > 0) {
              lines.push(chunk);
              chunk = ch;
            } else {
              chunk += ch;
            }
          }
          currentLine = chunk;
        } else {
          currentLine = candidate;
        }
      } else {
        lines.push(currentLine.trimEnd());
        currentLine = token.trimStart();
      }
    }
    lines.push(currentLine);
  }

  return lines.length > 0 ? lines : [''];
}

function drawRoundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  const safeR = Math.min(Math.max(0, r), w / 2, h / 2);
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(x, y, w, h, safeR);
  } else {
    ctx.moveTo(x + safeR, y);
    ctx.lineTo(x + w - safeR, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + safeR);
    ctx.lineTo(x + w, y + h - safeR);
    ctx.quadraticCurveTo(x + w, y + h, x + w - safeR, y + h);
    ctx.lineTo(x + safeR, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - safeR);
    ctx.lineTo(x, y + safeR);
    ctx.quadraticCurveTo(x, y, x + safeR, y);
    ctx.closePath();
  }
}

function drawSmoothPolyline(
  ctx: CanvasRenderingContext2D,
  points: number[],
  scale: number
): void {
  if (points.length < 4) return;
  ctx.beginPath();
  const x0 = (points[0] ?? 0) * scale;
  const y0 = (points[1] ?? 0) * scale;
  ctx.moveTo(x0, y0);

  if (points.length === 4) {
    ctx.lineTo((points[2] ?? 0) * scale, (points[3] ?? 0) * scale);
    return;
  }

  for (let i = 2; i < points.length - 2; i += 2) {
    const cx = (points[i] ?? 0) * scale;
    const cy = (points[i + 1] ?? 0) * scale;
    const nx = (points[i + 2] ?? 0) * scale;
    const ny = (points[i + 3] ?? 0) * scale;
    const midX = (cx + nx) / 2;
    const midY = (cy + ny) / 2;
    ctx.quadraticCurveTo(cx, cy, midX, midY);
  }

  const lastX = (points[points.length - 2] ?? 0) * scale;
  const lastY = (points[points.length - 1] ?? 0) * scale;
  ctx.lineTo(lastX, lastY);
}

export function renderAnnotationsOntoContext(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  annotations: AnnotationObject[],
  scale: number
): void {
  for (const ann of annotations) {
    if (!ann.visible) continue;

    ctx.save();

    switch (ann.type) {
      case 'redact': {
        const x0 = clamp(Math.floor(ann.x * scale), 0, canvasWidth);
        const y0 = clamp(Math.floor(ann.y * scale), 0, canvasHeight);
        const x1 = clamp(Math.ceil((ann.x + ann.width) * scale), 0, canvasWidth);
        const y1 = clamp(Math.ceil((ann.y + ann.height) * scale), 0, canvasHeight);
        const rw = x1 - x0;
        const rh = y1 - y0;

        if (rw > 0 && rh > 0) {
          ctx.globalCompositeOperation = 'source-over';
          ctx.globalAlpha = 1;
          ctx.clearRect(x0, y0, rw, rh);
          const { r, g, b } = parseHexRgb(ann.fillColor);
          ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
          ctx.fillRect(x0, y0, rw, rh);

          try {
            const fullData = ctx.getImageData(x0, y0, rw, rh);
            applyOpaqueRedactionToBuffer(
              fullData,
              { x: 0, y: 0, width: rw, height: rh },
              ann.fillColor
            );
            ctx.putImageData(fullData, x0, y0);
          } catch {
            // fillRect above already painted 100% opaque pixels if getImageData is restricted
          }
        }
        break;
      }

      case 'blur': {
        const x0 = clamp(Math.floor(ann.x * scale), 0, canvasWidth);
        const y0 = clamp(Math.floor(ann.y * scale), 0, canvasHeight);
        const x1 = clamp(Math.ceil((ann.x + ann.width) * scale), 0, canvasWidth);
        const y1 = clamp(Math.ceil((ann.y + ann.height) * scale), 0, canvasHeight);
        const rw = x1 - x0;
        const rh = y1 - y0;

        if (rw > 0 && rh > 0) {
          const regionData = ctx.getImageData(x0, y0, rw, rh);
          applyBoxBlurToBuffer(
            regionData,
            { x: 0, y: 0, width: rw, height: rh },
            Math.max(2, ann.blurRadius * scale)
          );
          ctx.putImageData(regionData, x0, y0);
        }
        break;
      }

      case 'pixelate': {
        const x0 = clamp(Math.floor(ann.x * scale), 0, canvasWidth);
        const y0 = clamp(Math.floor(ann.y * scale), 0, canvasHeight);
        const x1 = clamp(Math.ceil((ann.x + ann.width) * scale), 0, canvasWidth);
        const y1 = clamp(Math.ceil((ann.y + ann.height) * scale), 0, canvasHeight);
        const rw = x1 - x0;
        const rh = y1 - y0;

        if (rw > 0 && rh > 0) {
          const regionData = ctx.getImageData(x0, y0, rw, rh);
          applyPixelateToBuffer(
            regionData,
            { x: 0, y: 0, width: rw, height: rh },
            Math.max(2, ann.blockSize * scale)
          );
          ctx.putImageData(regionData, x0, y0);
        }
        break;
      }

      case 'rect': {
        const rx = ann.x * scale;
        const ry = ann.y * scale;
        const rw = ann.width * scale;
        const rh = ann.height * scale;
        if (rw <= 0 || rh <= 0) break;

        ctx.globalAlpha = clamp(ann.opacity, 0, 1);
        drawRoundedRectPath(ctx, rx, ry, rw, rh, ann.cornerRadius * scale);

        if (ann.fillOpacity > 0) {
          ctx.fillStyle = hexToRgba(ann.fillColor, ann.fillOpacity);
          ctx.fill();
        }
        if (ann.strokeWidth > 0) {
          ctx.strokeStyle = ann.strokeColor;
          ctx.lineWidth = ann.strokeWidth * scale;
          ctx.lineJoin = 'round';
          ctx.stroke();
        }
        break;
      }

      case 'ellipse': {
        const rx = (ann.width * scale) / 2;
        const ry = (ann.height * scale) / 2;
        if (rx <= 0 || ry <= 0) break;
        const cx = ann.x * scale + rx;
        const cy = ann.y * scale + ry;

        ctx.globalAlpha = clamp(ann.opacity, 0, 1);
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);

        if (ann.fillOpacity > 0) {
          ctx.fillStyle = hexToRgba(ann.fillColor, ann.fillOpacity);
          ctx.fill();
        }
        if (ann.strokeWidth > 0) {
          ctx.strokeStyle = ann.strokeColor;
          ctx.lineWidth = ann.strokeWidth * scale;
          ctx.stroke();
        }
        break;
      }

      case 'line': {
        ctx.globalAlpha = clamp(ann.opacity, 0, 1);
        ctx.strokeStyle = ann.strokeColor;
        ctx.lineWidth = ann.strokeWidth * scale;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(ann.x1 * scale, ann.y1 * scale);
        ctx.lineTo(ann.x2 * scale, ann.y2 * scale);
        ctx.stroke();
        break;
      }

      case 'arrow': {
        ctx.globalAlpha = clamp(ann.opacity, 0, 1);
        const scaledStroke = ann.strokeWidth * scale;
        const geom = computeArrowGeometry(
          ann.x1 * scale,
          ann.y1 * scale,
          ann.x2 * scale,
          ann.y2 * scale,
          scaledStroke,
          ann.headStyle
        );

        ctx.strokeStyle = ann.strokeColor;
        ctx.lineWidth = scaledStroke;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        ctx.beginPath();
        ctx.moveTo(geom.shaftStart.x, geom.shaftStart.y);
        ctx.lineTo(geom.shaftEnd.x, geom.shaftEnd.y);
        ctx.stroke();

        for (const head of geom.heads) {
          if (head.points.length < 3) continue;
          ctx.beginPath();
          ctx.moveTo(head.points[0]!.x, head.points[0]!.y);
          for (let i = 1; i < head.points.length; i++) {
            ctx.lineTo(head.points[i]!.x, head.points[i]!.y);
          }
          if (head.closed) ctx.closePath();

          if (head.filled) {
            ctx.fillStyle = head.fillWithWhite ? '#ffffff' : ann.strokeColor;
            ctx.fill();
            if (head.fillWithWhite) {
              ctx.lineWidth = Math.max(1.5 * scale, scaledStroke * 0.75);
              ctx.stroke();
            }
          } else {
            ctx.stroke();
          }
        }
        break;
      }

      case 'pen': {
        ctx.globalAlpha = clamp(ann.opacity, 0, 1);
        ctx.strokeStyle = ann.strokeColor;
        ctx.lineWidth = ann.strokeWidth * scale;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        drawSmoothPolyline(ctx, ann.points, scale);
        ctx.stroke();
        break;
      }

      case 'highlighter': {
        ctx.globalAlpha = clamp(ann.opacity, 0.08, 0.65);
        ctx.strokeStyle = ann.strokeColor;
        ctx.lineWidth = ann.strokeWidth * scale;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        drawSmoothPolyline(ctx, ann.points, scale);
        ctx.stroke();
        break;
      }

      case 'text': {
        if (!ann.text && ann.fillOpacity <= 0) break;
        ctx.globalAlpha = clamp(ann.opacity, 0, 1);
        const scaledFontSize = ann.fontSize * scale;
        const weightNum =
          ann.fontWeight === 'bold' ? '700' : ann.fontWeight === 'medium' ? '600' : '400';
        ctx.font = `${weightNum} ${scaledFontSize}px Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
        ctx.textBaseline = 'top';

        const padX = 8 * scale;
        const padY = 8 * scale;
        const boxWidth = Math.max(40 * scale, ann.width * scale);
        const innerMaxWidth = Math.max(16 * scale, boxWidth - padX * 2);
        const lines = wrapCanvasTextLines(ctx, ann.text, innerMaxWidth);
        const lineHeight = scaledFontSize * 1.32;
        const boxHeight = lines.length * lineHeight + padY * 2;

        const bx = ann.x * scale;
        const by = ann.y * scale;

        if (ann.fillOpacity > 0) {
          drawRoundedRectPath(ctx, bx, by, boxWidth, boxHeight, 6 * scale);
          ctx.fillStyle = hexToRgba(ann.fillColor, ann.fillOpacity);
          ctx.fill();
        }

        ctx.fillStyle = ann.strokeColor;
        lines.forEach((line, index) => {
          const ly = by + padY + index * lineHeight;
          if (ann.textAlign === 'center') {
            ctx.textAlign = 'center';
            ctx.fillText(line, bx + boxWidth / 2, ly);
          } else if (ann.textAlign === 'right') {
            ctx.textAlign = 'right';
            ctx.fillText(line, bx + boxWidth - padX, ly);
          } else {
            ctx.textAlign = 'left';
            ctx.fillText(line, bx + padX, ly);
          }
        });
        break;
      }

      case 'step': {
        ctx.globalAlpha = clamp(ann.opacity, 0, 1);
        const cx = ann.x * scale;
        const cy = ann.y * scale;
        const r = ann.radius * scale;

        ctx.save();
        ctx.shadowColor = 'rgba(15, 23, 42, 0.28)';
        ctx.shadowBlur = 6 * scale;
        ctx.shadowOffsetY = 2 * scale;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fillStyle = ann.fillColor;
        ctx.fill();
        ctx.restore();

        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.lineWidth = Math.max(2, 2.5 * scale);
        ctx.strokeStyle = ann.strokeColor;
        ctx.stroke();

        const fontSize = Math.round(r * 1.05);
        ctx.font = `700 ${fontSize}px Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
        ctx.fillStyle = ann.textColor;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(ann.stepNumber), cx, cy + 0.5 * scale);
        break;
      }
    }

    ctx.restore();
  }
}

export function renderFlattenedCanvas(params: FlattenRenderParams): HTMLCanvasElement {
  const { image, annotations, scale, format, backgroundFillEnabled, backgroundFillColor } = params;

  const scaleError = validateExportScaleBounds(image.width, image.height, scale);
  if (scaleError) {
    throw new Error(scaleError);
  }

  if (!image.element) {
    throw new Error('Background screenshot image element is not loaded.');
  }

  const { width, height } = computeExportDimensions(image.width, image.height, scale);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    throw new Error('Browser could not allocate a 2D rendering context for export.');
  }

  ctx.clearRect(0, 0, width, height);

  if (format === 'jpeg' || backgroundFillEnabled) {
    const { r, g, b } = parseHexRgb(backgroundFillColor || '#ffffff');
    ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
    ctx.fillRect(0, 0, width, height);
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(image.element, 0, 0, width, height);

  renderAnnotationsOntoContext(ctx, width, height, annotations, scale);

  return canvas;
}
