export type ToolType =
  | 'select'
  | 'pan'
  | 'rect'
  | 'ellipse'
  | 'line'
  | 'arrow'
  | 'pen'
  | 'highlighter'
  | 'text'
  | 'step'
  | 'blur'
  | 'pixelate'
  | 'redact';

export type AnnotationKind = Exclude<ToolType, 'select' | 'pan'>;

export type ArrowHeadStyle = 'filled' | 'open' | 'double' | 'outline';

export type FontWeightOption = 'normal' | 'medium' | 'bold';

export type TextAlignOption = 'left' | 'center' | 'right';

export type WorkspaceBackdrop = 'checkerboard' | 'dark' | 'light';

export type SupportedImageMime = 'image/png' | 'image/jpeg' | 'image/webp';

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface BaseAnnotation {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
}

export interface RectAnnotation extends BaseAnnotation {
  type: 'rect';
  x: number;
  y: number;
  width: number;
  height: number;
  strokeColor: string;
  strokeWidth: number;
  fillColor: string;
  fillOpacity: number;
  opacity: number;
  cornerRadius: number;
}

export interface EllipseAnnotation extends BaseAnnotation {
  type: 'ellipse';
  x: number;
  y: number;
  width: number;
  height: number;
  strokeColor: string;
  strokeWidth: number;
  fillColor: string;
  fillOpacity: number;
  opacity: number;
}

export interface LineAnnotation extends BaseAnnotation {
  type: 'line';
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  strokeColor: string;
  strokeWidth: number;
  opacity: number;
}

export interface ArrowAnnotation extends BaseAnnotation {
  type: 'arrow';
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  strokeColor: string;
  strokeWidth: number;
  opacity: number;
  headStyle: ArrowHeadStyle;
}

export interface PenAnnotation extends BaseAnnotation {
  type: 'pen';
  points: number[];
  strokeColor: string;
  strokeWidth: number;
  opacity: number;
}

export interface HighlighterAnnotation extends BaseAnnotation {
  type: 'highlighter';
  points: number[];
  strokeColor: string;
  strokeWidth: number;
  opacity: number;
}

export interface TextAnnotation extends BaseAnnotation {
  type: 'text';
  x: number;
  y: number;
  width: number;
  text: string;
  fontSize: number;
  fontWeight: FontWeightOption;
  textAlign: TextAlignOption;
  strokeColor: string;
  fillColor: string;
  fillOpacity: number;
  opacity: number;
}

export interface StepAnnotation extends BaseAnnotation {
  type: 'step';
  x: number;
  y: number;
  radius: number;
  stepNumber: number;
  fillColor: string;
  strokeColor: string;
  textColor: string;
  opacity: number;
}

export interface BlurAnnotation extends BaseAnnotation {
  type: 'blur';
  x: number;
  y: number;
  width: number;
  height: number;
  blurRadius: number;
}

export interface PixelateAnnotation extends BaseAnnotation {
  type: 'pixelate';
  x: number;
  y: number;
  width: number;
  height: number;
  blockSize: number;
}

export interface RedactAnnotation extends BaseAnnotation {
  type: 'redact';
  x: number;
  y: number;
  width: number;
  height: number;
  fillColor: string;
  opacity: 1;
}

export type AnnotationObject =
  | RectAnnotation
  | EllipseAnnotation
  | LineAnnotation
  | ArrowAnnotation
  | PenAnnotation
  | HighlighterAnnotation
  | TextAnnotation
  | StepAnnotation
  | BlurAnnotation
  | PixelateAnnotation
  | RedactAnnotation;

export interface BackgroundImageMeta {
  assetId: string;
  name: string;
  mimeType: SupportedImageMime;
  width: number;
  height: number;
  byteSize: number;
  hasTransparency: boolean;
}

export interface LoadedImageAsset extends BackgroundImageMeta {
  dataUrl: string;
  objectUrl: string | null;
  element: HTMLImageElement | ImageBitmap | null;
}

export interface ToolStyleDefaults {
  strokeColor: string;
  strokeWidth: number;
  fillColor: string;
  fillOpacity: number;
  opacity: number;
  cornerRadius: number;
  headStyle: ArrowHeadStyle;
  highlighterColor: string;
  highlighterWidth: number;
  highlighterOpacity: number;
  fontSize: number;
  fontWeight: FontWeightOption;
  textAlign: TextAlignOption;
  textBgOpacity: number;
  stepRadius: number;
  stepFillColor: string;
  blurRadius: number;
  blockSize: number;
  redactColor: string;
}

export interface ViewportState {
  zoom: number;
  panX: number;
  panY: number;
}

export interface DocumentSnapshot {
  projectName: string;
  backgroundAssetId: string | null;
  annotations: AnnotationObject[];
}

export type ImportErrorCode =
  | 'UNSUPPORTED_TYPE'
  | 'INVALID_SIGNATURE'
  | 'FILE_TOO_LARGE'
  | 'EMPTY_FILE'
  | 'DIMENSIONS_EXCEEDED'
  | 'MEGAPIXELS_EXCEEDED'
  | 'DECODE_FAILED'
  | 'INVALID_PROJECT';

export interface ImportErrorInfo {
  code: ImportErrorCode;
  title: string;
  message: string;
  fileName?: string;
  detectedType?: string;
  fileSizeBytes?: number;
}

export interface ImportSafetyLimits {
  maxFileSizeBytes: number;
  maxDimensionPx: number;
  maxMegapixels: number;
}

export type ExportFormat = 'png' | 'jpeg';

export type ExportScale = 0.5 | 1 | 2 | 3;

export interface ExportOptions {
  format: ExportFormat;
  quality: number;
  scale: ExportScale;
  backgroundFillEnabled: boolean;
  backgroundFillColor: string;
  fileName: string;
}

export interface ToastNotice {
  id: string;
  variant: 'default' | 'success' | 'warning' | 'error';
  title: string;
  description?: string;
}
