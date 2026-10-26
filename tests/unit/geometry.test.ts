import { describe, expect, it } from 'vitest';
import {
  boxesIntersect,
  computeArrowGeometry,
  computeFitViewport,
  getAnnotationBounds,
  normalizeRect,
  scalePointsToBox,
  simplifyPoints,
  snapLineEndpoint,
  translateAnnotation,
} from '@/lib/geometry';
import type { ArrowAnnotation, PenAnnotation } from '@/types/editor';

describe('Geometry Utilities', () => {
  it('normalizes rectangles dragged in any quadrant', () => {
    expect(normalizeRect(100, 120, 40, 20)).toEqual({
      x: 40,
      y: 20,
      width: 60,
      height: 100,
    });
    expect(normalizeRect(10, 15, 90, 65)).toEqual({
      x: 10,
      y: 15,
      width: 80,
      height: 50,
    });
  });

  it('constrains aspect ratio to 1:1 square when Shift constraint is active', () => {
    const sq = normalizeRect(100, 100, 40, 80, true);
    expect(sq.width).toBe(60);
    expect(sq.height).toBe(60);
    expect(sq.x).toBe(40);
    expect(sq.y).toBe(40);
  });

  it('snaps line endpoints to 45-degree increments', () => {
    const horizontal = snapLineEndpoint(0, 0, 100, 8, 45);
    expect(Math.round(horizontal.y)).toBe(0);
    expect(horizontal.x).toBeGreaterThan(95);

    const diagonal = snapLineEndpoint(0, 0, 95, 102, 45);
    expect(Math.abs(diagonal.x - diagonal.y)).toBeLessThan(0.01);
  });

  it('computes arrowhead geometry for filled, open, double, and outline styles', () => {
    const filled = computeArrowGeometry(0, 0, 120, 0, 4, 'filled');
    expect(filled.heads).toHaveLength(1);
    expect(filled.heads[0]?.filled).toBe(true);
    expect(filled.heads[0]?.closed).toBe(true);
    expect(filled.shaftEnd.x).toBeLessThan(120);

    const open = computeArrowGeometry(0, 0, 120, 0, 4, 'open');
    expect(open.heads).toHaveLength(1);
    expect(open.heads[0]?.filled).toBe(false);
    expect(open.heads[0]?.closed).toBe(false);

    const doubleHead = computeArrowGeometry(0, 0, 120, 0, 4, 'double');
    expect(doubleHead.heads).toHaveLength(2);
    expect(doubleHead.shaftStart.x).toBeGreaterThan(0);
    expect(doubleHead.shaftEnd.x).toBeLessThan(120);

    const outline = computeArrowGeometry(0, 0, 120, 0, 4, 'outline');
    expect(outline.heads[0]?.fillWithWhite).toBe(true);
  });

  it('simplifies dense freehand point streams while preserving start and end', () => {
    const raw = [0, 0, 0.5, 0.2, 1.0, 0.3, 10, 10, 10.4, 10.2, 25, 30];
    const simplified = simplifyPoints(raw, 3);
    expect(simplified[0]).toBe(0);
    expect(simplified[1]).toBe(0);
    expect(simplified[simplified.length - 2]).toBe(25);
    expect(simplified[simplified.length - 1]).toBe(30);
    expect(simplified.length).toBeLessThan(raw.length);
  });

  it('translates arrows and freehand strokes accurately', () => {
    const arrow: ArrowAnnotation = {
      id: 'a1',
      type: 'arrow',
      name: 'Arrow #1',
      visible: true,
      locked: false,
      x1: 10,
      y1: 20,
      x2: 110,
      y2: 70,
      strokeColor: '#ef4444',
      strokeWidth: 4,
      opacity: 1,
      headStyle: 'filled',
    };
    const movedArrow = translateAnnotation(arrow, 15, -5);
    expect(movedArrow.type === 'arrow' && movedArrow.x1).toBe(25);
    expect(movedArrow.type === 'arrow' && movedArrow.y1).toBe(15);
    expect(movedArrow.type === 'arrow' && movedArrow.x2).toBe(125);
    expect(movedArrow.type === 'arrow' && movedArrow.y2).toBe(65);

    const pen: PenAnnotation = {
      id: 'p1',
      type: 'pen',
      name: 'Pen #1',
      visible: true,
      locked: false,
      points: [0, 0, 20, 40],
      strokeColor: '#2563eb',
      strokeWidth: 3,
      opacity: 1,
    };
    const movedPen = translateAnnotation(pen, 10, 20);
    expect(movedPen.type === 'pen' && movedPen.points).toEqual([10, 20, 30, 60]);
  });

  it('scales freehand point clouds proportionally into resized bounding boxes', () => {
    const scaled = scalePointsToBox(
      [10, 10, 30, 50],
      { x: 10, y: 10, width: 20, height: 40 },
      { x: 20, y: 20, width: 40, height: 80 }
    );
    expect(scaled).toEqual([20, 20, 60, 100]);
  });

  it('computes accurate fit-to-screen zoom without upscaling small screenshots past 100%', () => {
    const smallFit = computeFitViewport(400, 300, 1200, 900, 48);
    expect(smallFit.zoom).toBe(1);
    expect(smallFit.panX).toBe(400);
    expect(smallFit.panY).toBe(300);

    const largeFit = computeFitViewport(2400, 1600, 1200, 900, 50);
    expect(largeFit.zoom).toBeLessThan(0.5);
    expect(largeFit.zoom).toBeGreaterThan(0.4);
  });

  it('checks bounding box intersections for marquee selection', () => {
    const bounds = getAnnotationBounds({
      id: 's1',
      type: 'step',
      name: 'Step #1',
      visible: true,
      locked: false,
      x: 100,
      y: 100,
      radius: 16,
      stepNumber: 1,
      fillColor: '#ef4444',
      strokeColor: '#ffffff',
      textColor: '#ffffff',
      opacity: 1,
    });
    expect(boxesIntersect(bounds, { x: 90, y: 90, width: 30, height: 30 })).toBe(true);
    expect(boxesIntersect(bounds, { x: 200, y: 200, width: 30, height: 30 })).toBe(false);
  });
});
