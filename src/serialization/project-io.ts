import type {
  AnnotationObject,
  ImportErrorInfo,
  LoadedImageAsset,
} from '@/types/editor';
import { sanitizeFileName } from '@/lib/utils';
import {
  SNAPMARK_FORMAT_ID,
  SNAPMARK_PROJECT_VERSION,
  snapmarkProjectSchema,
  type SnapmarkProjectFile,
} from './schema';

export function serializeProjectToJson(params: {
  projectName: string;
  image: LoadedImageAsset;
  annotations: AnnotationObject[];
}): string {
  const payload: SnapmarkProjectFile = {
    format: SNAPMARK_FORMAT_ID,
    version: SNAPMARK_PROJECT_VERSION,
    projectName: params.projectName.trim() || 'Untitled Screenshot',
    savedAt: new Date().toISOString(),
    image: {
      name: params.image.name,
      mimeType: params.image.mimeType,
      width: params.image.width,
      height: params.image.height,
      dataUrl: params.image.dataUrl,
    },
    annotations: params.annotations.map((ann) =>
      ann.type === 'redact' ? { ...ann, opacity: 1 as const } : structuredClone(ann)
    ),
  };

  const validated = snapmarkProjectSchema.parse(payload);
  return JSON.stringify(validated, null, 2);
}

export type ParseProjectResult =
  | { ok: true; project: SnapmarkProjectFile }
  | { ok: false; error: ImportErrorInfo };

export function parseProjectJson(
  rawText: string,
  fileName = 'project.snapmark.json'
): ParseProjectResult {
  if (!rawText || rawText.trim().length === 0) {
    return {
      ok: false,
      error: {
        code: 'INVALID_PROJECT',
        title: 'Empty Project File',
        message: `"${fileName}" is empty and does not contain SnapMark project data.`,
        fileName,
      },
    };
  }

  let parsedUnknown: unknown;
  try {
    parsedUnknown = JSON.parse(rawText);
  } catch {
    return {
      ok: false,
      error: {
        code: 'INVALID_PROJECT',
        title: 'Malformed Project JSON',
        message: `"${fileName}" could not be parsed as valid JSON. Ensure it is an unmodified .snapmark project file.`,
        fileName,
      },
    };
  }

  if (typeof parsedUnknown !== 'object' || parsedUnknown === null) {
    return {
      ok: false,
      error: {
        code: 'INVALID_PROJECT',
        title: 'Invalid Project Structure',
        message: `"${fileName}" does not contain a valid SnapMark project object.`,
        fileName,
      },
    };
  }

  const record = parsedUnknown as Record<string, unknown>;
  if (record.format !== SNAPMARK_FORMAT_ID) {
    return {
      ok: false,
      error: {
        code: 'INVALID_PROJECT',
        title: 'Unrecognized Project Format',
        message: `"${fileName}" is missing the "${SNAPMARK_FORMAT_ID}" format identifier.`,
        fileName,
      },
    };
  }

  if (record.version !== SNAPMARK_PROJECT_VERSION) {
    return {
      ok: false,
      error: {
        code: 'INVALID_PROJECT',
        title: 'Unsupported Project Version',
        message: `"${fileName}" uses project version "${String(record.version)}", whereas this studio supports version ${SNAPMARK_PROJECT_VERSION}.`,
        fileName,
      },
    };
  }

  const result = snapmarkProjectSchema.safeParse(parsedUnknown);
  if (!result.success) {
    const firstIssue = result.error.issues[0];
    const pathLabel = firstIssue?.path.join('.') || 'document';
    return {
      ok: false,
      error: {
        code: 'INVALID_PROJECT',
        title: 'Project Validation Failed',
        message: `"${fileName}" failed schema validation at "${pathLabel}": ${firstIssue?.message ?? 'Invalid value'}.`,
        fileName,
      },
    };
  }

  return {
    ok: true,
    project: result.data,
  };
}

export function downloadProjectFile(params: {
  projectName: string;
  image: LoadedImageAsset;
  annotations: AnnotationObject[];
}): string {
  const json = serializeProjectToJson(params);
  const safeBase = sanitizeFileName(params.projectName, 'screenshot-project');
  const fullName = `${safeBase}.snapmark.json`;

  const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fullName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 1000);

  return fullName;
}
