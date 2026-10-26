import { create } from 'zustand';
import type {
  AnnotationObject,
  DocumentSnapshot,
  ImportErrorInfo,
  LoadedImageAsset,
  RedactAnnotation,
  ToolStyleDefaults,
  ToolType,
  ToastNotice,
  ViewportState,
  WorkspaceBackdrop,
} from '@/types/editor';
import { clamp, createId, sanitizeFileName } from '@/lib/utils';
import { computeFitViewport, translateAnnotation } from '@/lib/geometry';
import { clearUnusedImageAssets, getImageAsset } from '@/import/image-loader';
import {
  beginHistoryTransaction,
  cancelHistoryTransaction,
  commitHistoryTransaction,
  createInitialHistory,
  getReferencedAssetIds,
  type HistoryManagerState,
  recordHistoryChange,
  redoHistory,
  replaceHistoryPresent,
  undoHistory,
  updateHistoryTransient,
} from './history';
import { DEFAULT_TOOL_STYLES } from '@/tools/tool-definitions';

export interface LoadingProgressState {
  active: boolean;
  percent: number;
  label: string;
}

export interface EditorStoreState {
  history: HistoryManagerState;
  activeTool: ToolType;
  styleDefaults: ToolStyleDefaults;
  selectedIds: string[];
  editingTextId: string | null;
  viewport: ViewportState;
  canvasContainerSize: { width: number; height: number };
  backdrop: WorkspaceBackdrop;
  isDirty: boolean;
  importError: ImportErrorInfo | null;
  loadingProgress: LoadingProgressState;
  toasts: ToastNotice[];

  getBackgroundAsset: () => LoadedImageAsset | null;
  getNextStepNumber: () => number;

  setActiveTool: (tool: ToolType) => void;
  updateStyleDefaults: (patch: Partial<ToolStyleDefaults>) => void;
  setBackdrop: (backdrop: WorkspaceBackdrop) => void;
  setImportError: (error: ImportErrorInfo | null) => void;
  setLoadingProgress: (progress: LoadingProgressState) => void;
  addToast: (toast: Omit<ToastNotice, 'id'>) => void;
  dismissToast: (id: string) => void;
  setProjectName: (name: string) => void;
  markClean: () => void;

  setContainerSize: (width: number, height: number) => void;
  setViewport: (viewport: Partial<ViewportState>) => void;
  zoomByFactor: (factor: number, centerX?: number, centerY?: number) => void;
  zoomToFit: () => void;
  resetZoom100: () => void;

  loadBackgroundImage: (asset: LoadedImageAsset, keepAnnotations?: boolean) => void;
  removeBackgroundImage: () => void;
  resetProject: () => void;
  loadOpenedProject: (params: {
    projectName: string;
    asset: LoadedImageAsset;
    annotations: AnnotationObject[];
  }) => void;

  setSelectedIds: (ids: string[]) => void;
  toggleSelection: (id: string) => void;
  selectAllAnnotations: () => void;
  clearSelection: () => void;
  setEditingTextId: (id: string | null) => void;

  addAnnotation: (annotation: AnnotationObject, autoSelect?: boolean) => void;
  updateAnnotation: (
    id: string,
    updater: (prev: AnnotationObject) => AnnotationObject,
    options?: { coalesceKey?: string }
  ) => void;
  updateAnnotationsBatch: (
    ids: string[],
    updater: (prev: AnnotationObject) => AnnotationObject
  ) => void;
  beginGestureTransaction: () => void;
  updateTransientAnnotations: (annotations: AnnotationObject[]) => void;
  commitGestureTransaction: () => void;
  cancelGestureTransaction: () => void;

  deleteSelectedAnnotations: () => void;
  deleteAnnotationById: (id: string) => void;
  duplicateSelectedAnnotations: () => void;
  nudgeSelectedAnnotations: (dx: number, dy: number) => void;
  bringForward: (id?: string) => void;
  sendBackward: (id?: string) => void;
  bringToFront: (id?: string) => void;
  sendToBack: (id?: string) => void;
  toggleLockAnnotation: (id?: string) => void;
  toggleVisibilityAnnotation: (id: string) => void;
  convertToOpaqueRedaction: (id: string) => void;
  clearAnnotationsOnly: () => void;

  undo: () => void;
  redo: () => void;
}

const COALESCE_WINDOW_MS = 800;
let lastCoalescedEdit: { key: string; present: DocumentSnapshot; at: number } | null = null;

function enforceAnnotationInvariants(ann: AnnotationObject): AnnotationObject {
  if (ann.type === 'redact') {
    return {
      ...ann,
      opacity: 1,
      width: Math.max(1, ann.width),
      height: Math.max(1, ann.height),
    };
  }
  if (ann.type === 'highlighter') {
    return {
      ...ann,
      opacity: clamp(ann.opacity, 0.08, 0.65),
    };
  }
  return ann;
}

export const useEditorStore = create<EditorStoreState>((set, get) => ({
  history: createInitialHistory(),
  activeTool: 'select',
  styleDefaults: { ...DEFAULT_TOOL_STYLES },
  selectedIds: [],
  editingTextId: null,
  viewport: { zoom: 1, panX: 48, panY: 48 },
  canvasContainerSize: { width: 1000, height: 700 },
  backdrop: 'checkerboard',
  isDirty: false,
  importError: null,
  loadingProgress: { active: false, percent: 0, label: '' },
  toasts: [],

  getBackgroundAsset: () => {
    const assetId = get().history.present.backgroundAssetId;
    return getImageAsset(assetId);
  },

  getNextStepNumber: () => {
    const annotations = get().history.present.annotations;
    let maxStep = 0;
    for (const ann of annotations) {
      if (ann.type === 'step' && ann.stepNumber > maxStep) {
        maxStep = ann.stepNumber;
      }
    }
    return maxStep + 1;
  },

  setActiveTool: (tool) => {
    set((state) => ({
      activeTool: tool,
      editingTextId: null,
      // Keep selection if switching to select; clear when switching to a drawing tool
      selectedIds: tool === 'select' || tool === 'pan' ? state.selectedIds : [],
    }));
  },

  updateStyleDefaults: (patch) => {
    set((state) => ({
      styleDefaults: {
        ...state.styleDefaults,
        ...patch,
        highlighterOpacity:
          patch.highlighterOpacity !== undefined
            ? clamp(patch.highlighterOpacity, 0.08, 0.65)
            : state.styleDefaults.highlighterOpacity,
      },
    }));
  },

  setBackdrop: (backdrop) => set({ backdrop }),

  setImportError: (importError) => set({ importError }),

  setLoadingProgress: (loadingProgress) => set({ loadingProgress }),

  addToast: (toast) => {
    const id = createId('toast');
    set((state) => ({
      toasts: [...state.toasts.slice(-3), { ...toast, id }],
    }));
    if (typeof window !== 'undefined') {
      window.setTimeout(() => {
        get().dismissToast(id);
      }, 4200);
    }
  },

  dismissToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },

  setProjectName: (name) => {
    const state = get();
    const nextHistory = recordHistoryChange(state.history, {
      ...state.history.present,
      projectName: name,
    });
    set({ history: nextHistory, isDirty: true });
  },

  markClean: () => set({ isDirty: false }),

  setContainerSize: (width, height) => {
    set({ canvasContainerSize: { width, height } });
  },

  setViewport: (patch) => {
    set((state) => ({
      viewport: {
        zoom: patch.zoom !== undefined ? clamp(patch.zoom, 0.05, 8) : state.viewport.zoom,
        panX: patch.panX !== undefined ? patch.panX : state.viewport.panX,
        panY: patch.panY !== undefined ? patch.panY : state.viewport.panY,
      },
    }));
  },

  zoomByFactor: (factor, centerX, centerY) => {
    const { viewport, canvasContainerSize } = get();
    const oldZoom = viewport.zoom;
    const newZoom = clamp(Math.round(oldZoom * factor * 1000) / 1000, 0.05, 8);
    if (newZoom === oldZoom) return;

    const cx = centerX ?? canvasContainerSize.width / 2;
    const cy = centerY ?? canvasContainerSize.height / 2;

    const imagePointX = (cx - viewport.panX) / oldZoom;
    const imagePointY = (cy - viewport.panY) / oldZoom;

    const newPanX = cx - imagePointX * newZoom;
    const newPanY = cy - imagePointY * newZoom;

    set({
      viewport: {
        zoom: newZoom,
        panX: Math.round(newPanX * 10) / 10,
        panY: Math.round(newPanY * 10) / 10,
      },
    });
  },

  zoomToFit: () => {
    const asset = get().getBackgroundAsset();
    const { canvasContainerSize } = get();
    if (!asset) {
      set({ viewport: { zoom: 1, panX: 48, panY: 48 } });
      return;
    }
    const fitted = computeFitViewport(
      asset.width,
      asset.height,
      canvasContainerSize.width,
      canvasContainerSize.height,
      48
    );
    set({ viewport: fitted });
  },

  resetZoom100: () => {
    const asset = get().getBackgroundAsset();
    const { canvasContainerSize } = get();
    if (!asset) {
      set({ viewport: { zoom: 1, panX: 48, panY: 48 } });
      return;
    }
    const panX = Math.round((canvasContainerSize.width - asset.width) / 2);
    const panY = Math.round((canvasContainerSize.height - asset.height) / 2);
    set({ viewport: { zoom: 1, panX, panY } });
  },

  loadBackgroundImage: (asset, keepAnnotations = false) => {
    const state = get();
    const derivedName = sanitizeFileName(asset.name, 'screenshot');
    const hadPreviousContent =
      state.history.present.backgroundAssetId !== null ||
      state.history.present.annotations.length > 0;

    const nextSnapshot = {
      projectName: keepAnnotations ? state.history.present.projectName : derivedName,
      backgroundAssetId: asset.assetId,
      annotations: keepAnnotations ? state.history.present.annotations : [],
    };

    const nextHistory = hadPreviousContent
      ? recordHistoryChange(state.history, nextSnapshot)
      : createInitialHistory(nextSnapshot);

    const fitted = computeFitViewport(
      asset.width,
      asset.height,
      state.canvasContainerSize.width,
      state.canvasContainerSize.height,
      48
    );

    clearUnusedImageAssets(getReferencedAssetIds(nextHistory));

    set({
      history: nextHistory,
      viewport: fitted,
      selectedIds: keepAnnotations ? state.selectedIds : [],
      editingTextId: null,
      importError: null,
      activeTool: state.activeTool === 'pan' ? 'select' : state.activeTool,
      isDirty: true,
    });
  },

  removeBackgroundImage: () => {
    const state = get();
    if (!state.history.present.backgroundAssetId) return;

    const nextHistory = recordHistoryChange(state.history, {
      ...state.history.present,
      backgroundAssetId: null,
    });
    clearUnusedImageAssets(getReferencedAssetIds(nextHistory));
    set({
      history: nextHistory,
      selectedIds: [],
      editingTextId: null,
      isDirty: state.history.present.annotations.length > 0,
    });
  },

  resetProject: () => {
    const freshHistory = createInitialHistory();
    clearUnusedImageAssets(new Set());
    set({
      history: freshHistory,
      activeTool: 'select',
      selectedIds: [],
      editingTextId: null,
      viewport: { zoom: 1, panX: 48, panY: 48 },
      isDirty: false,
      importError: null,
    });
  },

  loadOpenedProject: ({ projectName, asset, annotations }) => {
    const state = get();
    const safeAnnotations = annotations.map(enforceAnnotationInvariants);
    const freshHistory = createInitialHistory({
      projectName,
      backgroundAssetId: asset.assetId,
      annotations: safeAnnotations,
    });
    clearUnusedImageAssets(getReferencedAssetIds(freshHistory));

    const fitted = computeFitViewport(
      asset.width,
      asset.height,
      state.canvasContainerSize.width,
      state.canvasContainerSize.height,
      48
    );

    set({
      history: freshHistory,
      activeTool: 'select',
      selectedIds: [],
      editingTextId: null,
      viewport: fitted,
      isDirty: false,
      importError: null,
    });
  },

  setSelectedIds: (ids) => {
    const existingIds = new Set(get().history.present.annotations.map((a) => a.id));
    set({
      selectedIds: ids.filter((id) => existingIds.has(id)),
    });
  },

  toggleSelection: (id) => {
    set((state) => {
      const exists = state.selectedIds.includes(id);
      return {
        selectedIds: exists
          ? state.selectedIds.filter((item) => item !== id)
          : [...state.selectedIds, id],
      };
    });
  },

  selectAllAnnotations: () => {
    const selectable = get()
      .history.present.annotations.filter((a) => a.visible && !a.locked)
      .map((a) => a.id);
    set({ selectedIds: selectable, activeTool: 'select', editingTextId: null });
  },

  clearSelection: () => set({ selectedIds: [], editingTextId: null }),

  setEditingTextId: (id) => set({ editingTextId: id }),

  addAnnotation: (annotation, autoSelect = true) => {
    const state = get();
    const enforced = enforceAnnotationInvariants(annotation);
    const nextAnnotations = [...state.history.present.annotations, enforced];
    const nextHistory = recordHistoryChange(state.history, {
      ...state.history.present,
      annotations: nextAnnotations,
    });
    set({
      history: nextHistory,
      selectedIds: autoSelect ? [enforced.id] : state.selectedIds,
      isDirty: true,
    });
  },

  updateAnnotation: (id, updater, options) => {
    const state = get();
    const nextAnnotations = state.history.present.annotations.map((ann) =>
      ann.id === id ? enforceAnnotationInvariants(updater(ann)) : ann
    );
    const nextSnapshot = { ...state.history.present, annotations: nextAnnotations };
    const coalesceKey = options?.coalesceKey;
    // Only merge when nothing else touched the document since the last coalesced edit.
    const canCoalesce =
      coalesceKey !== undefined &&
      lastCoalescedEdit !== null &&
      lastCoalescedEdit.key === coalesceKey &&
      lastCoalescedEdit.present === state.history.present &&
      Date.now() - lastCoalescedEdit.at < COALESCE_WINDOW_MS &&
      !state.history.transactionStart;
    const nextHistory = canCoalesce
      ? replaceHistoryPresent(state.history, nextSnapshot)
      : recordHistoryChange(state.history, nextSnapshot);
    lastCoalescedEdit = coalesceKey
      ? { key: coalesceKey, present: nextHistory.present, at: Date.now() }
      : null;
    set({ history: nextHistory, isDirty: true });
  },

  updateAnnotationsBatch: (ids, updater) => {
    if (ids.length === 0) return;
    const idSet = new Set(ids);
    const state = get();
    const nextAnnotations = state.history.present.annotations.map((ann) =>
      idSet.has(ann.id) ? enforceAnnotationInvariants(updater(ann)) : ann
    );
    const nextHistory = recordHistoryChange(state.history, {
      ...state.history.present,
      annotations: nextAnnotations,
    });
    set({ history: nextHistory, isDirty: true });
  },

  beginGestureTransaction: () => {
    set((state) => ({
      history: beginHistoryTransaction(state.history),
    }));
  },

  updateTransientAnnotations: (annotations) => {
    set((state) => ({
      history: updateHistoryTransient(
        state.history,
        annotations.map(enforceAnnotationInvariants)
      ),
    }));
  },

  commitGestureTransaction: () => {
    set((state) => {
      const committed = commitHistoryTransaction(state.history);
      return {
        history: committed,
        isDirty: state.isDirty || committed.past.length !== state.history.past.length,
      };
    });
  },

  cancelGestureTransaction: () => {
    set((state) => ({
      history: cancelHistoryTransaction(state.history),
    }));
  },

  deleteSelectedAnnotations: () => {
    const state = get();
    if (state.selectedIds.length === 0) return;
    const selectedSet = new Set(state.selectedIds);
    const remaining = state.history.present.annotations.filter(
      (ann) => !selectedSet.has(ann.id) || ann.locked
    );
    if (remaining.length === state.history.present.annotations.length) return;

    const nextHistory = recordHistoryChange(state.history, {
      ...state.history.present,
      annotations: remaining,
    });
    set({
      history: nextHistory,
      selectedIds: remaining.filter((a) => selectedSet.has(a.id)).map((a) => a.id),
      editingTextId: null,
      isDirty: true,
    });
  },

  deleteAnnotationById: (id) => {
    const state = get();
    const target = state.history.present.annotations.find((a) => a.id === id);
    if (!target || target.locked) return;
    const remaining = state.history.present.annotations.filter((a) => a.id !== id);
    const nextHistory = recordHistoryChange(state.history, {
      ...state.history.present,
      annotations: remaining,
    });
    set({
      history: nextHistory,
      selectedIds: state.selectedIds.filter((sid) => sid !== id),
      editingTextId: state.editingTextId === id ? null : state.editingTextId,
      isDirty: true,
    });
  },

  duplicateSelectedAnnotations: () => {
    const state = get();
    if (state.selectedIds.length === 0) return;
    const selectedSet = new Set(state.selectedIds);
    const clones: AnnotationObject[] = [];
    let nextStep = state.getNextStepNumber();

    for (const ann of state.history.present.annotations) {
      if (!selectedSet.has(ann.id)) continue;
      const moved = translateAnnotation(ann, 18, 18);
      const clone: AnnotationObject =
        moved.type === 'step'
          ? {
              ...moved,
              id: createId('ann'),
              name: `Step #${nextStep}`,
              stepNumber: nextStep++,
              locked: false,
            }
          : {
              ...moved,
              id: createId('ann'),
              name: `${ann.name} Copy`,
              locked: false,
            };
      clones.push(clone);
    }

    if (clones.length === 0) return;
    const nextHistory = recordHistoryChange(state.history, {
      ...state.history.present,
      annotations: [...state.history.present.annotations, ...clones],
    });
    set({
      history: nextHistory,
      selectedIds: clones.map((c) => c.id),
      activeTool: 'select',
      isDirty: true,
    });
  },

  nudgeSelectedAnnotations: (dx, dy) => {
    const state = get();
    if (state.selectedIds.length === 0) return;
    const selectedSet = new Set(state.selectedIds);
    let movedAny = false;
    const nextAnnotations = state.history.present.annotations.map((ann) => {
      if (!selectedSet.has(ann.id) || ann.locked) return ann;
      movedAny = true;
      return translateAnnotation(ann, dx, dy);
    });
    if (!movedAny) return;
    const nextHistory = recordHistoryChange(state.history, {
      ...state.history.present,
      annotations: nextAnnotations,
    });
    set({ history: nextHistory, isDirty: true });
  },

  bringForward: (id) => {
    const state = get();
    const targetId = id ?? state.selectedIds[0];
    if (!targetId) return;
    const list = [...state.history.present.annotations];
    const idx = list.findIndex((a) => a.id === targetId);
    if (idx < 0 || idx >= list.length - 1) return;
    const [item] = list.splice(idx, 1);
    if (!item) return;
    list.splice(idx + 1, 0, item);
    const nextHistory = recordHistoryChange(state.history, {
      ...state.history.present,
      annotations: list,
    });
    set({ history: nextHistory, isDirty: true });
  },

  sendBackward: (id) => {
    const state = get();
    const targetId = id ?? state.selectedIds[0];
    if (!targetId) return;
    const list = [...state.history.present.annotations];
    const idx = list.findIndex((a) => a.id === targetId);
    if (idx <= 0) return;
    const [item] = list.splice(idx, 1);
    if (!item) return;
    list.splice(idx - 1, 0, item);
    const nextHistory = recordHistoryChange(state.history, {
      ...state.history.present,
      annotations: list,
    });
    set({ history: nextHistory, isDirty: true });
  },

  bringToFront: (id) => {
    const state = get();
    const targetId = id ?? state.selectedIds[0];
    if (!targetId) return;
    const list = [...state.history.present.annotations];
    const idx = list.findIndex((a) => a.id === targetId);
    if (idx < 0 || idx === list.length - 1) return;
    const [item] = list.splice(idx, 1);
    if (!item) return;
    list.push(item);
    const nextHistory = recordHistoryChange(state.history, {
      ...state.history.present,
      annotations: list,
    });
    set({ history: nextHistory, isDirty: true });
  },

  sendToBack: (id) => {
    const state = get();
    const targetId = id ?? state.selectedIds[0];
    if (!targetId) return;
    const list = [...state.history.present.annotations];
    const idx = list.findIndex((a) => a.id === targetId);
    if (idx <= 0) return;
    const [item] = list.splice(idx, 1);
    if (!item) return;
    list.unshift(item);
    const nextHistory = recordHistoryChange(state.history, {
      ...state.history.present,
      annotations: list,
    });
    set({ history: nextHistory, isDirty: true });
  },

  toggleLockAnnotation: (id) => {
    const state = get();
    const targets = id ? [id] : state.selectedIds;
    if (targets.length === 0) return;
    const targetSet = new Set(targets);
    const nextAnnotations = state.history.present.annotations.map((ann) =>
      targetSet.has(ann.id) ? { ...ann, locked: !ann.locked } : ann
    );
    const nextHistory = recordHistoryChange(state.history, {
      ...state.history.present,
      annotations: nextAnnotations,
    });
    set({ history: nextHistory, isDirty: true });
  },

  toggleVisibilityAnnotation: (id) => {
    const state = get();
    const nextAnnotations = state.history.present.annotations.map((ann) =>
      ann.id === id ? { ...ann, visible: !ann.visible } : ann
    );
    const nextHistory = recordHistoryChange(state.history, {
      ...state.history.present,
      annotations: nextAnnotations,
    });
    set({
      history: nextHistory,
      selectedIds: state.selectedIds.filter((sid) => {
        const updated = nextAnnotations.find((a) => a.id === sid);
        return Boolean(updated?.visible);
      }),
      isDirty: true,
    });
  },

  convertToOpaqueRedaction: (id) => {
    const state = get();
    const target = state.history.present.annotations.find((a) => a.id === id);
    if (!target || (target.type !== 'blur' && target.type !== 'pixelate')) return;

    const redacted: RedactAnnotation = {
      id: target.id,
      type: 'redact',
      name: target.name.replace(/^(Blur|Pixelate)/i, 'Opaque Redact'),
      visible: target.visible,
      locked: target.locked,
      x: target.x,
      y: target.y,
      width: target.width,
      height: target.height,
      fillColor: state.styleDefaults.redactColor || '#000000',
      opacity: 1,
    };

    const nextAnnotations = state.history.present.annotations.map((ann) =>
      ann.id === id ? redacted : ann
    );
    const nextHistory = recordHistoryChange(state.history, {
      ...state.history.present,
      annotations: nextAnnotations,
    });
    set({ history: nextHistory, isDirty: true });
  },

  clearAnnotationsOnly: () => {
    const state = get();
    if (state.history.present.annotations.length === 0) return;
    const nextHistory = recordHistoryChange(state.history, {
      ...state.history.present,
      annotations: [],
    });
    set({
      history: nextHistory,
      selectedIds: [],
      editingTextId: null,
      isDirty: true,
    });
  },

  undo: () => {
    set((state) => {
      const nextHistory = undoHistory(state.history);
      if (nextHistory === state.history) return {};
      const validIds = new Set(nextHistory.present.annotations.map((a) => a.id));
      return {
        history: nextHistory,
        selectedIds: state.selectedIds.filter((id) => validIds.has(id)),
        editingTextId: null,
        isDirty: true,
      };
    });
  },

  redo: () => {
    set((state) => {
      const prevIds = new Set(state.history.present.annotations.map((a) => a.id));
      const nextHistory = redoHistory(state.history);
      if (nextHistory === state.history) return {};
      const validIds = new Set(nextHistory.present.annotations.map((a) => a.id));
      const keptSelection = state.selectedIds.filter((id) => validIds.has(id));
      const newlyRestoredIds = nextHistory.present.annotations
        .filter((a) => !prevIds.has(a.id) && a.visible && !a.locked)
        .map((a) => a.id);
      return {
        history: nextHistory,
        selectedIds: keptSelection.length > 0 ? keptSelection : newlyRestoredIds,
        editingTextId: null,
        isDirty: true,
      };
    });
  },
}));
