'use client';

import { useCallback } from 'react';
import { useEditorStore } from '@/store/editor-store';
import { isProjectFileName } from './image-validator';
import {
  loadAndValidateImageFile,
  loadImageAssetFromDataUrl,
} from './image-loader';
import { parseProjectJson } from '@/serialization/project-io';
import { generateSampleScreenshotAsset } from '@/lib/sample-screenshot';

export function useFileImporter() {
  const setLoadingProgress = useEditorStore((s) => s.setLoadingProgress);
  const setImportError = useEditorStore((s) => s.setImportError);
  const loadBackgroundImage = useEditorStore((s) => s.loadBackgroundImage);
  const loadOpenedProject = useEditorStore((s) => s.loadOpenedProject);
  const addToast = useEditorStore((s) => s.addToast);

  const importFile = useCallback(
    async (
      file: File,
      options?: {
        keepAnnotations?: boolean;
        expectProject?: boolean;
        onSuccessNavigate?: () => void;
      }
    ): Promise<boolean> => {
      setImportError(null);

      let looksLikeProject =
        Boolean(options?.expectProject) ||
        isProjectFileName(file.name) ||
        file.type === 'application/json';

      if (!looksLikeProject && file.size > 0 && file.size < 65 * 1024 * 1024) {
        try {
          const headText = await file.slice(0, 256).text();
          if (headText.trimStart().startsWith('{') && headText.includes('snapmark-project')) {
            looksLikeProject = true;
          }
        } catch {
          // ignore
        }
      }

      if (looksLikeProject) {
        setLoadingProgress({
          active: true,
          percent: 25,
          label: 'Validating project file…',
        });

        try {
          const rawText = await file.text();
          const parsed = parseProjectJson(rawText, file.name);
          if (!parsed.ok) {
            setLoadingProgress({ active: false, percent: 0, label: '' });
            setImportError(parsed.error);
            return false;
          }

          setLoadingProgress({
            active: true,
            percent: 70,
            label: 'Restoring screenshot & annotations…',
          });

          const imgResult = await loadImageAssetFromDataUrl({
            dataUrl: parsed.project.image.dataUrl,
            name: parsed.project.image.name,
            mimeType: parsed.project.image.mimeType,
          });

          setLoadingProgress({ active: false, percent: 0, label: '' });

          if (!imgResult.ok) {
            setImportError(imgResult.error);
            return false;
          }

          loadOpenedProject({
            projectName: parsed.project.projectName,
            asset: imgResult.asset,
            annotations: parsed.project.annotations,
          });

          addToast({
            variant: 'success',
            title: 'Project Reopened',
            description: `Loaded "${parsed.project.projectName}" with ${parsed.project.annotations.length} annotation(s).`,
          });

          options?.onSuccessNavigate?.();
          return true;
        } catch {
          setLoadingProgress({ active: false, percent: 0, label: '' });
          setImportError({
            code: 'INVALID_PROJECT',
            title: 'Failed to Read Project File',
            message: `Could not read "${file.name}" from disk.`,
            fileName: file.name,
          });
          return false;
        }
      }

      setLoadingProgress({
        active: true,
        percent: 10,
        label: 'Inspecting image…',
      });

      const result = await loadAndValidateImageFile(file, {
        onProgress: (percent, label) => {
          setLoadingProgress({ active: true, percent, label });
        },
      });

      setLoadingProgress({ active: false, percent: 0, label: '' });

      if (!result.ok) {
        setImportError(result.error);
        return false;
      }

      loadBackgroundImage(result.asset, options?.keepAnnotations ?? false);
      addToast({
        variant: 'success',
        title: options?.keepAnnotations ? 'Background Replaced' : 'Screenshot Imported',
        description: `${result.asset.width} × ${result.asset.height} px (${result.asset.mimeType.replace('image/', '').toUpperCase()})`,
      });
      options?.onSuccessNavigate?.();
      return true;
    },
    [addToast, loadBackgroundImage, loadOpenedProject, setImportError, setLoadingProgress]
  );

  const importSampleScreenshot = useCallback(
    async (onSuccessNavigate?: () => void): Promise<boolean> => {
      setImportError(null);
      setLoadingProgress({
        active: true,
        percent: 40,
        label: 'Generating local sample screenshot…',
      });
      try {
        const res = await generateSampleScreenshotAsset();
        setLoadingProgress({ active: false, percent: 0, label: '' });
        if (!res.ok) {
          setImportError(res.error);
          return false;
        }
        loadBackgroundImage(res.asset, false);
        addToast({
          variant: 'default',
          title: 'Sample Screenshot Loaded',
          description: 'Try drawing arrows, step badges, or redacting the API secret.',
        });
        onSuccessNavigate?.();
        return true;
      } catch {
        setLoadingProgress({ active: false, percent: 0, label: '' });
        return false;
      }
    },
    [addToast, loadBackgroundImage, setImportError, setLoadingProgress]
  );

  return {
    importFile,
    importSampleScreenshot,
  };
}
