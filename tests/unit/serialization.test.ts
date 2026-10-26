import { describe, expect, it } from 'vitest';
import {
  parseProjectJson,
  serializeProjectToJson,
} from '@/serialization/project-io';
import type { AnnotationObject, LoadedImageAsset } from '@/types/editor';

const VALID_TINY_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAEklEQVR42mP8z8AARAwMjDAGACwBA/+9270AAAAASUVORK5CYII=';

const sampleAsset: LoadedImageAsset = {
  assetId: 'asset_1',
  name: 'login-bug.png',
  mimeType: 'image/png',
  width: 640,
  height: 480,
  byteSize: 2048,
  hasTransparency: true,
  dataUrl: VALID_TINY_PNG,
  objectUrl: null,
  element: null,
};

const sampleAnnotations: AnnotationObject[] = [
  {
    id: 'ann_arrow_1',
    type: 'arrow',
    name: 'Arrow #1',
    visible: true,
    locked: false,
    x1: 50,
    y1: 60,
    x2: 200,
    y2: 140,
    strokeColor: '#ef4444',
    strokeWidth: 4,
    opacity: 1,
    headStyle: 'filled',
  },
  {
    id: 'ann_redact_1',
    type: 'redact',
    name: 'Opaque Redact #1',
    visible: true,
    locked: true,
    x: 100,
    y: 200,
    width: 240,
    height: 40,
    fillColor: '#000000',
    opacity: 1,
  },
];

describe('Project Serialization & Validation', () => {
  it('round-trips a valid project with image metadata and annotations', () => {
    const json = serializeProjectToJson({
      projectName: 'QA Issue 402',
      image: sampleAsset,
      annotations: sampleAnnotations,
    });

    const parsed = parseProjectJson(json, 'qa-issue-402.snapmark.json');
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.project.projectName).toBe('QA Issue 402');
      expect(parsed.project.version).toBe(1);
      expect(parsed.project.image.width).toBe(640);
      expect(parsed.project.annotations).toHaveLength(2);
      const redact = parsed.project.annotations[1]!;
      expect(redact.type).toBe('redact');
      if (redact.type === 'redact') {
        expect(redact.opacity).toBe(1);
      }
    }
  });

  it('rejects malformed JSON strings gracefully', () => {
    const parsed = parseProjectJson('{not valid json', 'corrupt.snapmark.json');
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.error.code).toBe('INVALID_PROJECT');
    }
  });

  it('rejects unsupported project schema versions', () => {
    const futureVersion = JSON.stringify({
      format: 'snapmark-project',
      version: 99,
      projectName: 'Future',
      savedAt: new Date().toISOString(),
      image: {
        name: 'img.png',
        mimeType: 'image/png',
        width: 100,
        height: 100,
        dataUrl: VALID_TINY_PNG,
      },
      annotations: [],
    });

    const parsed = parseProjectJson(futureVersion, 'v99.snapmark.json');
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.error.title).toContain('Version');
    }
  });

  it('rejects tampered redaction objects whose opacity is below 1', () => {
    const tampered = JSON.stringify({
      format: 'snapmark-project',
      version: 1,
      projectName: 'Tampered Redaction',
      savedAt: new Date().toISOString(),
      image: {
        name: 'img.png',
        mimeType: 'image/png',
        width: 100,
        height: 100,
        dataUrl: VALID_TINY_PNG,
      },
      annotations: [
        {
          id: 'bad_redact',
          type: 'redact',
          name: 'Tampered',
          visible: true,
          locked: false,
          x: 10,
          y: 10,
          width: 50,
          height: 20,
          fillColor: '#000000',
          opacity: 0.4,
        },
      ],
    });

    const parsed = parseProjectJson(tampered, 'tampered.snapmark.json');
    expect(parsed.ok).toBe(false);
  });
});
