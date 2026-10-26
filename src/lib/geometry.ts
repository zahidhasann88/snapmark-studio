import type {
  AnnotationObject,
  ArrowHeadStyle,
  BoundingBox,
  Point,
  ViewportState,
} from '@/types/editor';
import { clamp } from './utils';

export function normalizeRect(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  constrainEqual = false
): BoundingBox {
  let dx = x2 - x1;
  let dy = y2 - y1;

  if (constrainEqual) {
    const size = Math.max(Math.abs(dx), Math.abs(dy));
    dx = dx < 0 ? -size : size;
    dy = dy < 0 ? -size : size;
  }

  const x = dx >= 0 ? x1 : x1 + dx;
  const y = dy >= 0 ? y1 : y1 + dy;

  return {
    x,
    y,
    width: Math.abs(dx),
    height: Math.abs(dy),
  };
}

export function snapLineEndpoint(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  incrementDegrees = 45
): Point {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const length = Math.hypot(dx, dy);
  if (length === 0) return { x: x2, y: y2 };

  const incrementRad = (incrementDegrees * Math.PI) / 180;
  const angle = Math.atan2(dy, dx);
  const snappedAngle = Math.round(angle / incrementRad) * incrementRad;

  return {
    x: x1 + Math.cos(snappedAngle) * length,
    y: y1 + Math.sin(snappedAngle) * length,
  };
}

export interface ArrowHeadPolygon {
  points: Point[];
  closed: boolean;
  filled: boolean;
  fillWithWhite?: boolean;
}

export interface ComputedArrowGeometry {
  shaftStart: Point;
  shaftEnd: Point;
  heads: ArrowHeadPolygon[];
}

export function computeArrowGeometry(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  strokeWidth: number,
  headStyle: ArrowHeadStyle
): ComputedArrowGeometry {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const length = Math.hypot(dx, dy);

  if (length < 1) {
    return {
      shaftStart: { x: x1, y: y1 },
      shaftEnd: { x: x2, y: y2 },
      heads: [],
    };
  }

  const headLength = Math.min(Math.max(14, strokeWidth * 3.6), length * 0.65);
  const headAngle = Math.PI / 6.2; // ~29 degrees
  const angle = Math.atan2(dy, dx);

  const buildHead = (tipX: number, tipY: number, dirAngle: number): ArrowHeadPolygon => {
    const left: Point = {
      x: tipX - headLength * Math.cos(dirAngle - headAngle),
      y: tipY - headLength * Math.sin(dirAngle - headAngle),
    };
    const right: Point = {
      x: tipX - headLength * Math.cos(dirAngle + headAngle),
      y: tipY - headLength * Math.sin(dirAngle + headAngle),
    };
    const tip: Point = { x: tipX, y: tipY };

    if (headStyle === 'open') {
      return {
        points: [left, tip, right],
        closed: false,
        filled: false,
      };
    }

    if (headStyle === 'outline') {
      return {
        points: [tip, left, right],
        closed: true,
        filled: true,
        fillWithWhite: true,
      };
    }

    return {
      points: [tip, left, right],
      closed: true,
      filled: true,
    };
  };

  const retractDistance =
    headStyle === 'open' ? strokeWidth * 0.25 : headLength * Math.cos(headAngle) * 0.78;

  const ux = dx / length;
  const uy = dy / length;

  const shaftEnd: Point = {
    x: x2 - ux * Math.min(retractDistance, length * 0.45),
    y: y2 - uy * Math.min(retractDistance, length * 0.45),
  };

  const shaftStart: Point =
    headStyle === 'double'
      ? {
          x: x1 + ux * Math.min(retractDistance, length * 0.45),
          y: y1 + uy * Math.min(retractDistance, length * 0.45),
        }
      : { x: x1, y: y1 };

  const heads: ArrowHeadPolygon[] = [buildHead(x2, y2, angle)];
  if (headStyle === 'double') {
    heads.push(buildHead(x1, y1, angle + Math.PI));
  }

  return {
    shaftStart,
    shaftEnd,
    heads,
  };
}

export function simplifyPoints(points: number[], minDistance = 2.2): number[] {
  if (points.length <= 4) return [...points];
  const result: number[] = [points[0] ?? 0, points[1] ?? 0];
  let lastX = result[0] ?? 0;
  let lastY = result[1] ?? 0;

  for (let i = 2; i < points.length - 2; i += 2) {
    const px = points[i] ?? 0;
    const py = points[i + 1] ?? 0;
    if (Math.hypot(px - lastX, py - lastY) >= minDistance) {
      result.push(px, py);
      lastX = px;
      lastY = py;
    }
  }

  const endX = points[points.length - 2] ?? lastX;
  const endY = points[points.length - 1] ?? lastY;
  result.push(endX, endY);
  return result;
}

export function getPointsBounds(points: number[]): BoundingBox {
  if (points.length < 2) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (let i = 0; i < points.length; i += 2) {
    const px = points[i] ?? 0;
    const py = points[i + 1] ?? 0;
    if (px < minX) minX = px;
    if (py < minY) minY = py;
    if (px > maxX) maxX = px;
    if (py > maxY) maxY = py;
  }

  return {
    x: minX,
    y: minY,
    width: Math.max(0, maxX - minX),
    height: Math.max(0, maxY - minY),
  };
}

export function scalePointsToBox(
  points: number[],
  fromBox: BoundingBox,
  toBox: BoundingBox
): number[] {
  const result: number[] = [];
  const scaleX = fromBox.width > 0.001 ? toBox.width / fromBox.width : 1;
  const scaleY = fromBox.height > 0.001 ? toBox.height / fromBox.height : 1;

  for (let i = 0; i < points.length; i += 2) {
    const px = points[i] ?? 0;
    const py = points[i + 1] ?? 0;
    result.push(
      toBox.x + (px - fromBox.x) * scaleX,
      toBox.y + (py - fromBox.y) * scaleY
    );
  }
  return result;
}

export function estimateTextHeight(
  text: string,
  fontSize: number,
  boxWidth: number
): number {
  const safeText = text.length > 0 ? text : ' ';
  const explicitLines = safeText.split('\n');
  const approxCharWidth = fontSize * 0.56;
  const charsPerLine = Math.max(1, Math.floor(Math.max(40, boxWidth - 16) / approxCharWidth));

  let totalLines = 0;
  for (const line of explicitLines) {
    totalLines += Math.max(1, Math.ceil(line.length / charsPerLine));
  }
  return Math.max(fontSize * 1.4 + 12, totalLines * fontSize * 1.32 + 12);
}

export function getAnnotationBounds(annotation: AnnotationObject): BoundingBox {
  switch (annotation.type) {
    case 'rect':
    case 'ellipse':
    case 'blur':
    case 'pixelate':
    case 'redact':
      return {
        x: annotation.x,
        y: annotation.y,
        width: annotation.width,
        height: annotation.height,
      };
    case 'line':
    case 'arrow': {
      const minX = Math.min(annotation.x1, annotation.x2);
      const minY = Math.min(annotation.y1, annotation.y2);
      const maxX = Math.max(annotation.x1, annotation.x2);
      const maxY = Math.max(annotation.y1, annotation.y2);
      const pad = Math.max(6, annotation.strokeWidth);
      return {
        x: minX - pad,
        y: minY - pad,
        width: Math.max(pad * 2, maxX - minX + pad * 2),
        height: Math.max(pad * 2, maxY - minY + pad * 2),
      };
    }
    case 'pen':
    case 'highlighter': {
      const bounds = getPointsBounds(annotation.points);
      const pad = annotation.strokeWidth / 2;
      return {
        x: bounds.x - pad,
        y: bounds.y - pad,
        width: bounds.width + pad * 2,
        height: bounds.height + pad * 2,
      };
    }
    case 'text': {
      const height = estimateTextHeight(annotation.text, annotation.fontSize, annotation.width);
      return {
        x: annotation.x,
        y: annotation.y,
        width: annotation.width,
        height,
      };
    }
    case 'step': {
      return {
        x: annotation.x - annotation.radius,
        y: annotation.y - annotation.radius,
        width: annotation.radius * 2,
        height: annotation.radius * 2,
      };
    }
  }
}

export function translateAnnotation(
  annotation: AnnotationObject,
  dx: number,
  dy: number
): AnnotationObject {
  switch (annotation.type) {
    case 'rect':
    case 'ellipse':
    case 'text':
    case 'step':
    case 'blur':
    case 'pixelate':
    case 'redact':
      return {
        ...annotation,
        x: Math.round((annotation.x + dx) * 100) / 100,
        y: Math.round((annotation.y + dy) * 100) / 100,
      };
    case 'line':
    case 'arrow':
      return {
        ...annotation,
        x1: Math.round((annotation.x1 + dx) * 100) / 100,
        y1: Math.round((annotation.y1 + dy) * 100) / 100,
        x2: Math.round((annotation.x2 + dx) * 100) / 100,
        y2: Math.round((annotation.y2 + dy) * 100) / 100,
      };
    case 'pen':
    case 'highlighter':
      return {
        ...annotation,
        points: annotation.points.map((val, idx) =>
          idx % 2 === 0
            ? Math.round((val + dx) * 100) / 100
            : Math.round((val + dy) * 100) / 100
        ),
      };
  }
}

export function boxesIntersect(a: BoundingBox, b: BoundingBox): boolean {
  return (
    a.x <= b.x + b.width &&
    a.x + a.width >= b.x &&
    a.y <= b.y + b.height &&
    a.y + a.height >= b.y
  );
}

export function computeFitViewport(
  imageWidth: number,
  imageHeight: number,
  containerWidth: number,
  containerHeight: number,
  padding = 48
): ViewportState {
  if (imageWidth <= 0 || imageHeight <= 0 || containerWidth <= 0 || containerHeight <= 0) {
    return { zoom: 1, panX: 0, panY: 0 };
  }

  const availW = Math.max(80, containerWidth - padding * 2);
  const availH = Math.max(80, containerHeight - padding * 2);
  const rawScale = Math.min(availW / imageWidth, availH / imageHeight, 1);
  const zoom = clamp(Math.round(rawScale * 1000) / 1000, 0.05, 8);

  const panX = Math.round((containerWidth - imageWidth * zoom) / 2);
  const panY = Math.round((containerHeight - imageHeight * zoom) / 2);

  return { zoom, panX, panY };
}
