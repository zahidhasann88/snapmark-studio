import type {
  AnnotationObject,
  LoadedImageAsset,
  Point,
  ToolStyleDefaults,
  ToolType,
  ViewportState,
  WorkspaceBackdrop,
} from '@/types/editor';

export interface CanvasSyncState {
  image: LoadedImageAsset | null;
  annotations: AnnotationObject[];
  selectedIds: string[];
  editingTextId: string | null;
  activeTool: ToolType;
  styleDefaults: ToolStyleDefaults;
  viewport: ViewportState;
  backdrop: WorkspaceBackdrop;
  nextStepNumber: number;
}

export interface CanvasEngineCallbacks {
  onSelectIds: (ids: string[]) => void;
  onCreateAnnotation: (annotation: AnnotationObject, autoEditText?: boolean) => void;
  onCommitAnnotationsChange: (
    updates: Array<{ id: string; transform: (prev: AnnotationObject) => AnnotationObject }>
  ) => void;
  onRequestEditText: (id: string) => void;
  onViewportChange: (viewport: Partial<ViewportState>) => void;
  onZoomAtPoint: (factor: number, stageX: number, stageY: number) => void;
  onCursorCoordsChange: (coords: Point | null) => void;
  onSwitchToSelectTool: () => void;
}

export interface CanvasEngineAdapter {
  mount: (container: HTMLDivElement) => void;
  resize: (width: number, height: number) => void;
  sync: (state: CanvasSyncState) => void;
  cancelActiveInteraction: () => boolean;
  setSpacePressed: (pressed: boolean) => void;
  destroy: () => void;
}
