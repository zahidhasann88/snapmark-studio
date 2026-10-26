import Konva from "konva";
import type { AnnotationObject, LoadedImageAsset, Point } from "@/types/editor";
import {
  boxesIntersect,
  computeArrowGeometry,
  getAnnotationBounds,
  getPointsBounds,
  normalizeRect,
  scalePointsToBox,
  simplifyPoints,
  snapLineEndpoint,
  translateAnnotation,
} from "@/lib/geometry";
import {
  applyBoxBlurToBuffer,
  applyPixelateToBuffer,
} from "@/lib/pixel-effects";
import { clamp, createId, hexToRgba } from "@/lib/utils";
import type {
  CanvasEngineAdapter,
  CanvasEngineCallbacks,
  CanvasSyncState,
} from "./canvas-adapter";

interface CachedEffectEntry {
  key: string;
  canvas: HTMLCanvasElement;
}

interface RenderedAnnotationNode {
  annotation: AnnotationObject;
  contextKey: string;
  node: Konva.Group | Konva.Shape;
}

type ActiveGesture =
  | {
      kind: "pan";
      startClientX: number;
      startClientY: number;
      originPanX: number;
      originPanY: number;
    }
  | {
      kind: "marquee";
      startDoc: Point;
      additive: boolean;
    }
  | {
      kind: "draw-box";
      tool: "rect" | "ellipse" | "blur" | "pixelate" | "redact";
      startDoc: Point;
    }
  | {
      kind: "draw-line";
      tool: "line" | "arrow";
      startDoc: Point;
    }
  | {
      kind: "draw-freehand";
      tool: "pen" | "highlighter";
      points: number[];
    }
  | {
      kind: "drag-endpoint";
      annotationId: string;
      endpoint: "start" | "end";
    };

function createCheckerboardPatternCanvas(): HTMLCanvasElement {
  const tile = document.createElement("canvas");
  tile.width = 20;
  tile.height = 20;
  const ctx = tile.getContext("2d");
  if (ctx) {
    ctx.fillStyle = "#f8fafc";
    ctx.fillRect(0, 0, 20, 20);
    ctx.fillStyle = "#e2e8f0";
    ctx.fillRect(0, 0, 10, 10);
    ctx.fillRect(10, 10, 10, 10);
  }
  return tile;
}

export class KonvaCanvasEngine implements CanvasEngineAdapter {
  private callbacks: CanvasEngineCallbacks;
  private stage: Konva.Stage | null = null;
  private imageLayer: Konva.Layer | null = null;
  private annotationsLayer: Konva.Layer | null = null;
  private overlayLayer: Konva.Layer | null = null;
  private transformer: Konva.Transformer | null = null;
  private marqueeRect: Konva.Rect | null = null;
  private draftGroup: Konva.Group | null = null;
  private endpointGroup: Konva.Group | null = null;

  private state: CanvasSyncState | null = null;
  private nodeMap = new Map<string, Konva.Group | Konva.Shape>();
  private renderedNodes = new Map<string, RenderedAnnotationNode>();
  private effectCache = new Map<string, CachedEffectEntry>();
  private checkerPattern: HTMLCanvasElement | null = null;

  private gesture: ActiveGesture | null = null;
  private spacePressed = false;
  private shiftPressed = false;
  private containerEl: HTMLDivElement | null = null;

  private keyDownBound: (e: KeyboardEvent) => void;
  private keyUpBound: (e: KeyboardEvent) => void;
  private windowPointerUpBound: (e: PointerEvent) => void;

  constructor(callbacks: CanvasEngineCallbacks) {
    this.callbacks = callbacks;
    this.keyDownBound = (e) => {
      if (e.key === "Shift") this.shiftPressed = true;
    };
    this.keyUpBound = (e) => {
      if (e.key === "Shift") this.shiftPressed = false;
    };
    this.windowPointerUpBound = () => {
      if (this.gesture) {
        this.finishPointerGesture();
      }
    };
  }

  mount(container: HTMLDivElement): void {
    this.containerEl = container;
    const width = Math.max(100, container.clientWidth || 800);
    const height = Math.max(100, container.clientHeight || 600);

    Konva.pixelRatio = Math.min(window.devicePixelRatio || 1, 2);

    this.checkerPattern = createCheckerboardPatternCanvas();

    this.stage = new Konva.Stage({
      container,
      width,
      height,
    });

    this.imageLayer = new Konva.Layer({ listening: false });
    this.annotationsLayer = new Konva.Layer();
    this.overlayLayer = new Konva.Layer();

    this.transformer = new Konva.Transformer({
      rotateEnabled: false,
      flipEnabled: false,
      ignoreStroke: true,
      borderStroke: "#8b5cf6",
      borderStrokeWidth: 1.5,
      anchorStroke: "#8b5cf6",
      anchorFill: "#ffffff",
      anchorSize: 9,
      anchorCornerRadius: 2,
      keepRatio: false,
      boundBoxFunc: (oldBox, newBox) => {
        if (Math.abs(newBox.width) < 8 || Math.abs(newBox.height) < 8) {
          return oldBox;
        }
        return newBox;
      },
    });

    this.marqueeRect = new Konva.Rect({
      visible: false,
      listening: false,
      fill: "rgba(139, 92, 246, 0.10)",
      stroke: "#8b5cf6",
      strokeWidth: 1,
      dash: [4, 4],
    });

    this.draftGroup = new Konva.Group({ listening: false });
    this.endpointGroup = new Konva.Group();

    this.overlayLayer.add(this.transformer);
    this.overlayLayer.add(this.endpointGroup);
    this.overlayLayer.add(this.marqueeRect);
    this.overlayLayer.add(this.draftGroup);

    this.stage.add(this.imageLayer);
    this.stage.add(this.annotationsLayer);
    this.stage.add(this.overlayLayer);

    this.bindStageEvents();
    window.addEventListener("keydown", this.keyDownBound);
    window.addEventListener("keyup", this.keyUpBound);
    window.addEventListener("pointerup", this.windowPointerUpBound);

    if (this.state) {
      this.sync(this.state);
    }
  }

  resize(width: number, height: number): void {
    if (!this.stage || width <= 0 || height <= 0) return;
    this.stage.width(width);
    this.stage.height(height);
    this.stage.batchDraw();
  }

  setSpacePressed(pressed: boolean): void {
    this.spacePressed = pressed;
    this.updateCursor();
  }

  cancelActiveInteraction(): boolean {
    if (!this.gesture) return false;
    this.gesture = null;
    this.draftGroup?.destroyChildren();
    this.marqueeRect?.visible(false);
    this.overlayLayer?.batchDraw();
    this.updateCursor();
    return true;
  }

  sync(nextState: CanvasSyncState): void {
    const prevImageId = this.state?.image?.assetId ?? null;
    this.state = nextState;
    if (
      !this.stage ||
      !this.imageLayer ||
      !this.annotationsLayer ||
      !this.overlayLayer
    ) {
      return;
    }

    if (prevImageId !== (nextState.image?.assetId ?? null)) {
      this.effectCache.clear();
    }

    this.stage.scale({
      x: nextState.viewport.zoom,
      y: nextState.viewport.zoom,
    });
    this.stage.position({
      x: nextState.viewport.panX,
      y: nextState.viewport.panY,
    });

    this.renderBackgroundLayer(nextState.image, nextState.backdrop);
    this.renderAnnotationsLayer(nextState);
    this.syncSelectionOverlay(nextState);
    this.updateCursor();

    this.stage.batchDraw();
  }

  destroy(): void {
    window.removeEventListener("keydown", this.keyDownBound);
    window.removeEventListener("keyup", this.keyUpBound);
    window.removeEventListener("pointerup", this.windowPointerUpBound);
    this.effectCache.clear();
    this.nodeMap.clear();
    this.renderedNodes.clear();
    if (this.stage) {
      this.stage.destroy();
      this.stage = null;
    }
  }

  private getPointerInDocument(): Point | null {
    if (!this.stage || !this.state) return null;
    const pos = this.stage.getPointerPosition();
    if (!pos) return null;
    const { zoom, panX, panY } = this.state.viewport;
    return {
      x: (pos.x - panX) / zoom,
      y: (pos.y - panY) / zoom,
    };
  }

  private updateCursor(): void {
    if (!this.containerEl || !this.state) return;
    if (this.gesture?.kind === "pan") {
      this.containerEl.style.cursor = "grabbing";
      return;
    }
    if (this.spacePressed || this.state.activeTool === "pan") {
      this.containerEl.style.cursor = "grab";
      return;
    }
    switch (this.state.activeTool) {
      case "select":
        this.containerEl.style.cursor = "default";
        break;
      case "text":
        this.containerEl.style.cursor = "text";
        break;
      default:
        this.containerEl.style.cursor = "crosshair";
        break;
    }
  }

  private renderBackgroundLayer(
    image: LoadedImageAsset | null,
    backdrop: CanvasSyncState["backdrop"],
  ): void {
    if (!this.imageLayer) return;
    this.imageLayer.destroyChildren();

    if (!image || !image.element) {
      this.imageLayer.batchDraw();
      return;
    }

    const frameShadow = new Konva.Rect({
      x: 0,
      y: 0,
      width: image.width,
      height: image.height,
      fill:
        backdrop === "dark"
          ? "#0f172a"
          : backdrop === "light"
            ? "#ffffff"
            : "#ffffff",
      shadowColor: "rgba(15, 23, 42, 0.28)",
      shadowBlur: 24,
      shadowOffsetY: 6,
      listening: false,
    });
    this.imageLayer.add(frameShadow);

    if (backdrop === "checkerboard" && this.checkerPattern) {
      const checkerRect = new Konva.Rect({
        x: 0,
        y: 0,
        width: image.width,
        height: image.height,
        fillPatternImage: this.checkerPattern as unknown as HTMLImageElement,
        fillPatternRepeat: "repeat",
        listening: false,
      });
      this.imageLayer.add(checkerRect);
    }

    const konvaImg = new Konva.Image({
      x: 0,
      y: 0,
      width: image.width,
      height: image.height,
      image: image.element,
      listening: false,
    });
    this.imageLayer.add(konvaImg);

    const borderOutline = new Konva.Rect({
      x: 0,
      y: 0,
      width: image.width,
      height: image.height,
      stroke: "rgba(148, 163, 184, 0.45)",
      strokeWidth: 1 / (this.state?.viewport.zoom || 1),
      listening: false,
    });
    this.imageLayer.add(borderOutline);
  }

  private buildEffectPreviewCanvas(
    image: LoadedImageAsset | null,
    ann: Extract<AnnotationObject, { type: "blur" | "pixelate" }>,
  ): HTMLCanvasElement | null {
    if (!image || !image.element) return null;
    const x0 = clamp(Math.floor(ann.x), 0, image.width);
    const y0 = clamp(Math.floor(ann.y), 0, image.height);
    const x1 = clamp(Math.ceil(ann.x + ann.width), 0, image.width);
    const y1 = clamp(Math.ceil(ann.y + ann.height), 0, image.height);
    const rw = x1 - x0;
    const rh = y1 - y0;
    if (rw <= 0 || rh <= 0) return null;

    const paramVal = ann.type === "blur" ? ann.blurRadius : ann.blockSize;
    const cacheKey = `${image.assetId}:${ann.type}:${x0},${y0},${rw},${rh}:${paramVal}`;
    const existing = this.effectCache.get(ann.id);
    if (existing && existing.key === cacheKey) {
      return existing.canvas;
    }

    const offscreen = document.createElement("canvas");
    offscreen.width = rw;
    offscreen.height = rh;
    const ctx = offscreen.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;

    ctx.drawImage(image.element, x0, y0, rw, rh, 0, 0, rw, rh);
    const imgData = ctx.getImageData(0, 0, rw, rh);
    if (ann.type === "blur") {
      applyBoxBlurToBuffer(
        imgData,
        { x: 0, y: 0, width: rw, height: rh },
        ann.blurRadius,
      );
    } else {
      applyPixelateToBuffer(
        imgData,
        { x: 0, y: 0, width: rw, height: rh },
        ann.blockSize,
      );
    }
    ctx.putImageData(imgData, 0, 0);

    this.effectCache.set(ann.id, { key: cacheKey, canvas: offscreen });
    return offscreen;
  }

  private renderAnnotationsLayer(syncState: CanvasSyncState): void {
    if (!this.annotationsLayer) return;

    const isSelectMode =
      syncState.activeTool === "select" && !this.spacePressed;
    const invZoom = 1 / (syncState.viewport.zoom || 1);
    const contextKey = `${isSelectMode}|${syncState.viewport.zoom}|${syncState.image?.assetId ?? ""}`;

    const previous = this.renderedNodes;
    const next = new Map<string, RenderedAnnotationNode>();
    const ordered: Array<Konva.Group | Konva.Shape> = [];

    for (const ann of syncState.annotations) {
      if (!ann.visible) continue;
      if (ann.type === "text" && syncState.editingTextId === ann.id) {
        continue;
      }

      const cached = previous.get(ann.id);
      if (
        cached &&
        cached.annotation === ann &&
        cached.contextKey === contextKey
      ) {
        previous.delete(ann.id);
        next.set(ann.id, cached);
        ordered.push(cached.node);
        continue;
      }

      const node = this.createNodeForAnnotation(
        ann,
        syncState,
        isSelectMode,
        invZoom,
      );
      if (node) {
        this.bindAnnotationNodeEvents(node, ann, isSelectMode);
        this.annotationsLayer.add(node);
        next.set(ann.id, { annotation: ann, contextKey, node });
        ordered.push(node);
      }
    }

    for (const stale of previous.values()) {
      stale.node.destroy();
    }

    ordered.forEach((node, index) => node.zIndex(index));

    this.renderedNodes = next;
    this.nodeMap.clear();
    for (const [id, entry] of next) {
      this.nodeMap.set(id, entry.node);
    }
  }

  private createNodeForAnnotation(
    ann: AnnotationObject,
    syncState: CanvasSyncState,
    isSelectMode: boolean,
    invZoom: number,
  ): Konva.Group | Konva.Shape | null {
    const canDrag = isSelectMode && !ann.locked;

    switch (ann.type) {
      case "rect": {
        return new Konva.Rect({
          id: ann.id,
          x: ann.x,
          y: ann.y,
          width: ann.width,
          height: ann.height,
          cornerRadius: ann.cornerRadius,
          stroke: ann.strokeWidth > 0 ? ann.strokeColor : undefined,
          strokeWidth: ann.strokeWidth,
          fill:
            ann.fillOpacity > 0
              ? hexToRgba(ann.fillColor, ann.fillOpacity)
              : undefined,
          fillEnabled: ann.fillOpacity > 0,
          hitStrokeWidth: Math.max(18 * invZoom, ann.strokeWidth),
          opacity: ann.opacity,
          draggable: canDrag,
        });
      }

      case "ellipse": {
        return new Konva.Ellipse({
          id: ann.id,
          x: ann.x + ann.width / 2,
          y: ann.y + ann.height / 2,
          radiusX: Math.max(1, ann.width / 2),
          radiusY: Math.max(1, ann.height / 2),
          stroke: ann.strokeWidth > 0 ? ann.strokeColor : undefined,
          strokeWidth: ann.strokeWidth,
          fill:
            ann.fillOpacity > 0
              ? hexToRgba(ann.fillColor, ann.fillOpacity)
              : undefined,
          fillEnabled: ann.fillOpacity > 0,
          hitStrokeWidth: Math.max(18 * invZoom, ann.strokeWidth),
          opacity: ann.opacity,
          draggable: canDrag,
        });
      }

      case "line": {
        return new Konva.Line({
          id: ann.id,
          points: [ann.x1, ann.y1, ann.x2, ann.y2],
          stroke: ann.strokeColor,
          strokeWidth: ann.strokeWidth,
          lineCap: "round",
          hitStrokeWidth: Math.max(20 * invZoom, ann.strokeWidth + 8),
          opacity: ann.opacity,
          draggable: canDrag,
        });
      }

      case "arrow": {
        const hitPad = Math.max(18 * invZoom, ann.strokeWidth + 8);
        return new Konva.Shape({
          id: ann.id,
          x: 0,
          y: 0,
          opacity: ann.opacity,
          draggable: canDrag,
          sceneFunc: (ctx: Konva.Context, shape: Konva.Shape) => {
            const geom = computeArrowGeometry(
              ann.x1,
              ann.y1,
              ann.x2,
              ann.y2,
              ann.strokeWidth,
              ann.headStyle,
            );
            ctx.strokeStyle = ann.strokeColor;
            ctx.lineWidth = ann.strokeWidth;
            ctx.lineCap = "round";
            ctx.lineJoin = "round";

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
                ctx.fillStyle = head.fillWithWhite
                  ? "#ffffff"
                  : ann.strokeColor;
                ctx.fill();
                if (head.fillWithWhite) {
                  ctx.lineWidth = Math.max(1.5, ann.strokeWidth * 0.75);
                  ctx.stroke();
                }
              } else {
                ctx.stroke();
              }
            }
            ctx.fillStrokeShape(shape);
          },
          hitFunc: (ctx: Konva.Context, shape: Konva.Shape) => {
            ctx.beginPath();
            ctx.moveTo(ann.x1, ann.y1);
            ctx.lineTo(ann.x2, ann.y2);
            ctx.lineWidth = hitPad;
            ctx.strokeShape(shape);
          },
        });
      }

      case "pen": {
        return new Konva.Line({
          id: ann.id,
          points: ann.points,
          stroke: ann.strokeColor,
          strokeWidth: ann.strokeWidth,
          lineCap: "round",
          lineJoin: "round",
          tension: 0.35,
          hitStrokeWidth: Math.max(18 * invZoom, ann.strokeWidth + 6),
          opacity: ann.opacity,
          draggable: canDrag,
        });
      }

      case "highlighter": {
        return new Konva.Line({
          id: ann.id,
          points: ann.points,
          stroke: ann.strokeColor,
          strokeWidth: ann.strokeWidth,
          lineCap: "round",
          lineJoin: "round",
          tension: 0.25,
          hitStrokeWidth: Math.max(20 * invZoom, ann.strokeWidth),
          opacity: clamp(ann.opacity, 0.08, 0.65),
          draggable: canDrag,
        });
      }

      case "text": {
        const group = new Konva.Group({
          id: ann.id,
          x: ann.x,
          y: ann.y,
          opacity: ann.opacity,
          draggable: canDrag,
        });

        const textNode = new Konva.Text({
          x: 0,
          y: 0,
          width: Math.max(40, ann.width),
          text: ann.text || "Text",
          fontSize: ann.fontSize,
          fontFamily:
            'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          fontStyle: ann.fontWeight === "normal" ? "normal" : "bold",
          align: ann.textAlign,
          fill: ann.strokeColor,
          padding: 8,
          lineHeight: 1.32,
        });

        const measuredHeight = Math.max(
          ann.fontSize * 1.32 + 16,
          textNode.height(),
        );
        const bgRect = new Konva.Rect({
          x: 0,
          y: 0,
          width: Math.max(40, ann.width),
          height: measuredHeight,
          cornerRadius: 6,
          fill:
            ann.fillOpacity > 0
              ? hexToRgba(ann.fillColor, ann.fillOpacity)
              : "rgba(0,0,0,0.001)",
        });

        group.add(bgRect);
        group.add(textNode);
        return group;
      }

      case "step": {
        const group = new Konva.Group({
          id: ann.id,
          x: ann.x,
          y: ann.y,
          opacity: ann.opacity,
          draggable: canDrag,
        });

        const circle = new Konva.Circle({
          x: 0,
          y: 0,
          radius: ann.radius,
          fill: ann.fillColor,
          stroke: ann.strokeColor,
          strokeWidth: 2.5,
          shadowColor: "rgba(15, 23, 42, 0.28)",
          shadowBlur: 6,
          shadowOffsetY: 2,
        });

        const fontSize = Math.round(ann.radius * 1.05);
        const label = new Konva.Text({
          x: -ann.radius,
          y: -fontSize / 2,
          width: ann.radius * 2,
          text: String(ann.stepNumber),
          fontSize,
          fontFamily:
            'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          fontStyle: "bold",
          align: "center",
          fill: ann.textColor,
          listening: false,
        });

        group.add(circle);
        group.add(label);
        return group;
      }

      case "blur":
      case "pixelate": {
        const group = new Konva.Group({
          id: ann.id,
          x: ann.x,
          y: ann.y,
          draggable: canDrag,
        });

        const previewCanvas = this.buildEffectPreviewCanvas(
          syncState.image,
          ann,
        );
        if (previewCanvas && syncState.image) {
          const offsetX = Math.max(0, Math.floor(ann.x)) - ann.x;
          const offsetY = Math.max(0, Math.floor(ann.y)) - ann.y;
          const imgNode = new Konva.Image({
            x: offsetX,
            y: offsetY,
            width: previewCanvas.width,
            height: previewCanvas.height,
            image: previewCanvas,
          });
          group.add(imgNode);
        }

        const guideRect = new Konva.Rect({
          x: 0,
          y: 0,
          width: ann.width,
          height: ann.height,
          fill: "rgba(255,255,255,0.001)",
          stroke: "rgba(245, 158, 11, 0.65)",
          strokeWidth: 1 * invZoom,
          dash: [4 * invZoom, 4 * invZoom],
        });
        group.add(guideRect);
        return group;
      }

      case "redact": {
        return new Konva.Rect({
          id: ann.id,
          x: ann.x,
          y: ann.y,
          width: ann.width,
          height: ann.height,
          fill: ann.fillColor,
          opacity: 1,
          draggable: canDrag,
        });
      }
    }
  }

  private bindAnnotationNodeEvents(
    node: Konva.Node,
    ann: AnnotationObject,
    isSelectMode: boolean,
  ): void {
    node.on("mouseenter", () => {
      if (!this.containerEl || !this.state || this.spacePressed) return;
      if (this.state.activeTool === "select") {
        this.containerEl.style.cursor = ann.locked ? "not-allowed" : "move";
      }
    });

    node.on("mouseleave", () => {
      this.updateCursor();
    });

    node.on("mousedown touchstart", (evt) => {
      if (
        !this.state ||
        this.spacePressed ||
        this.state.activeTool !== "select"
      )
        return;
      evt.cancelBubble = true;
      const nativeEvt = evt.evt as MouseEvent;
      if (nativeEvt.shiftKey) {
        const exists = this.state.selectedIds.includes(ann.id);
        const nextIds = exists
          ? this.state.selectedIds.filter((id) => id !== ann.id)
          : [...this.state.selectedIds, ann.id];
        this.callbacks.onSelectIds(nextIds);
      } else if (!this.state.selectedIds.includes(ann.id)) {
        this.callbacks.onSelectIds([ann.id]);
      }
    });

    if (ann.type === "text") {
      node.on("dblclick dbltap", (evt) => {
        if (ann.locked) return;
        evt.cancelBubble = true;
        this.callbacks.onRequestEditText(ann.id);
      });
    }

    if (!isSelectMode || ann.locked) return;

    let dragOriginPos = { x: node.x(), y: node.y() };

    node.on("dragstart", () => {
      dragOriginPos = { x: node.x(), y: node.y() };
    });

    node.on("dragend", () => {
      const dx = node.x() - dragOriginPos.x;
      const dy = node.y() - dragOriginPos.y;
      if (Math.abs(dx) < 0.25 && Math.abs(dy) < 0.25) return;

      node.position(dragOriginPos);
      this.callbacks.onCommitAnnotationsChange([
        {
          id: ann.id,
          transform: (prev) => translateAnnotation(prev, dx, dy),
        },
      ]);
    });

    node.on("transformend", () => {
      const scaleX = node.scaleX();
      const scaleY = node.scaleY();
      const nextX = node.x();
      const nextY = node.y();

      node.scaleX(1);
      node.scaleY(1);

      this.callbacks.onCommitAnnotationsChange([
        {
          id: ann.id,
          transform: (prev) =>
            this.applyTransformToAnnotation(prev, nextX, nextY, scaleX, scaleY),
        },
      ]);
    });
  }

  private applyTransformToAnnotation(
    ann: AnnotationObject,
    nodeX: number,
    nodeY: number,
    scaleX: number,
    scaleY: number,
  ): AnnotationObject {
    switch (ann.type) {
      case "rect":
      case "blur":
      case "pixelate":
      case "redact":
        return {
          ...ann,
          x: Math.round(nodeX * 100) / 100,
          y: Math.round(nodeY * 100) / 100,
          width: Math.max(
            8,
            Math.round(ann.width * Math.abs(scaleX) * 100) / 100,
          ),
          height: Math.max(
            8,
            Math.round(ann.height * Math.abs(scaleY) * 100) / 100,
          ),
        };
      case "ellipse": {
        const newW = Math.max(
          8,
          Math.round(ann.width * Math.abs(scaleX) * 100) / 100,
        );
        const newH = Math.max(
          8,
          Math.round(ann.height * Math.abs(scaleY) * 100) / 100,
        );
        return {
          ...ann,
          x: Math.round((nodeX - newW / 2) * 100) / 100,
          y: Math.round((nodeY - newH / 2) * 100) / 100,
          width: newW,
          height: newH,
        };
      }
      case "text": {
        return {
          ...ann,
          x: Math.round(nodeX * 100) / 100,
          y: Math.round(nodeY * 100) / 100,
          width: Math.max(
            48,
            Math.round(ann.width * Math.abs(scaleX) * 100) / 100,
          ),
        };
      }
      case "step": {
        const uniformScale = Math.max(Math.abs(scaleX), Math.abs(scaleY));
        return {
          ...ann,
          x: Math.round(nodeX * 100) / 100,
          y: Math.round(nodeY * 100) / 100,
          radius: clamp(
            Math.round(ann.radius * uniformScale * 10) / 10,
            10,
            96,
          ),
        };
      }
      case "pen":
      case "highlighter": {
        const oldBounds = getPointsBounds(ann.points);
        const newBounds = {
          x: oldBounds.x * scaleX + nodeX,
          y: oldBounds.y * scaleY + nodeY,
          width: Math.max(4, oldBounds.width * Math.abs(scaleX)),
          height: Math.max(4, oldBounds.height * Math.abs(scaleY)),
        };
        return {
          ...ann,
          points: scalePointsToBox(ann.points, oldBounds, newBounds),
        };
      }
      case "line":
      case "arrow":
        return ann;
    }
  }

  private syncSelectionOverlay(syncState: CanvasSyncState): void {
    if (!this.transformer || !this.endpointGroup) return;
    this.endpointGroup.destroyChildren();

    if (syncState.activeTool !== "select" || syncState.editingTextId) {
      this.transformer.nodes([]);
      return;
    }

    const selectedAnnotations = syncState.annotations.filter(
      (a) => a.visible && syncState.selectedIds.includes(a.id),
    );

    if (selectedAnnotations.length === 0) {
      this.transformer.nodes([]);
      return;
    }

    if (
      selectedAnnotations.length === 1 &&
      (selectedAnnotations[0]!.type === "line" ||
        selectedAnnotations[0]!.type === "arrow")
    ) {
      this.transformer.nodes([]);
      const lineOrArrow = selectedAnnotations[0]!;
      this.renderLineEndpointHandles(lineOrArrow, syncState.viewport.zoom);
      return;
    }

    const transformableNodes: Konva.Node[] = [];
    for (const ann of selectedAnnotations) {
      if (ann.locked) continue;
      if (ann.type === "line" || ann.type === "arrow") continue;
      const n = this.nodeMap.get(ann.id);
      if (n) transformableNodes.push(n);
    }

    if (
      transformableNodes.length === 1 &&
      selectedAnnotations[0]?.type === "text"
    ) {
      this.transformer.enabledAnchors(["middle-left", "middle-right"]);
      this.transformer.keepRatio(false);
    } else if (
      transformableNodes.length === 1 &&
      selectedAnnotations[0]?.type === "step"
    ) {
      this.transformer.enabledAnchors([
        "top-left",
        "top-right",
        "bottom-left",
        "bottom-right",
      ]);
      this.transformer.keepRatio(true);
    } else {
      this.transformer.enabledAnchors([
        "top-left",
        "top-center",
        "top-right",
        "middle-left",
        "middle-right",
        "bottom-left",
        "bottom-center",
        "bottom-right",
      ]);
      this.transformer.keepRatio(this.shiftPressed);
    }

    this.transformer.nodes(transformableNodes);
  }

  private renderLineEndpointHandles(
    ann: Extract<AnnotationObject, { type: "line" | "arrow" }>,
    zoom: number,
  ): void {
    if (!this.endpointGroup) return;
    const invZoom = 1 / (zoom || 1);

    const highlightLine = new Konva.Line({
      points: [ann.x1, ann.y1, ann.x2, ann.y2],
      stroke: "#8b5cf6",
      strokeWidth: 1.5 * invZoom,
      dash: [4 * invZoom, 4 * invZoom],
      listening: false,
    });
    this.endpointGroup.add(highlightLine);

    if (ann.locked) return;

    const createHandle = (
      endpoint: "start" | "end",
      hx: number,
      hy: number,
    ) => {
      const handle = new Konva.Circle({
        x: hx,
        y: hy,
        radius: 6 * invZoom,
        fill: "#ffffff",
        stroke: "#8b5cf6",
        strokeWidth: 2 * invZoom,
        hitStrokeWidth: 12 * invZoom,
      });

      handle.on("mouseenter", () => {
        if (this.containerEl) this.containerEl.style.cursor = "crosshair";
      });
      handle.on("mouseleave", () => this.updateCursor());

      handle.on("mousedown touchstart", (evt) => {
        evt.cancelBubble = true;
        this.gesture = {
          kind: "drag-endpoint",
          annotationId: ann.id,
          endpoint,
        };
      });

      return handle;
    };

    this.endpointGroup.add(createHandle("start", ann.x1, ann.y1));
    this.endpointGroup.add(createHandle("end", ann.x2, ann.y2));
  }

  private bindStageEvents(): void {
    if (!this.stage) return;

    this.stage.on("wheel", (evt) => {
      evt.evt.preventDefault();
      if (!this.stage || !this.state) return;

      const wheelEvt = evt.evt;
      const pointer = this.stage.getPointerPosition();
      if (!pointer) return;

      if (
        wheelEvt.ctrlKey ||
        wheelEvt.metaKey ||
        Math.abs(wheelEvt.deltaX) < 4
      ) {
        const factor = wheelEvt.deltaY < 0 ? 1.1 : 1 / 1.1;
        this.callbacks.onZoomAtPoint(factor, pointer.x, pointer.y);
      } else {
        this.callbacks.onViewportChange({
          panX: this.state.viewport.panX - wheelEvt.deltaX,
          panY: this.state.viewport.panY - wheelEvt.deltaY,
        });
      }
    });

    this.stage.on("mousedown touchstart", (evt) => {
      if (!this.state || !this.stage) return;
      const nativeEvt = evt.evt as MouseEvent;
      const isMiddleClick = "button" in nativeEvt && nativeEvt.button === 1;
      const isRightClick = "button" in nativeEvt && nativeEvt.button === 2;
      if (isRightClick) return;

      if (
        isMiddleClick ||
        this.spacePressed ||
        this.state.activeTool === "pan"
      ) {
        const clientX =
          "clientX" in nativeEvt
            ? nativeEvt.clientX
            : ((evt.evt as TouchEvent).touches[0]?.clientX ?? 0);
        const clientY =
          "clientY" in nativeEvt
            ? nativeEvt.clientY
            : ((evt.evt as TouchEvent).touches[0]?.clientY ?? 0);
        this.gesture = {
          kind: "pan",
          startClientX: clientX,
          startClientY: clientY,
          originPanX: this.state.viewport.panX,
          originPanY: this.state.viewport.panY,
        };
        this.updateCursor();
        return;
      }

      if (!this.state.image) return;
      const docPt = this.getPointerInDocument();
      if (!docPt) return;

      const tool = this.state.activeTool;

      if (tool === "select") {
        if (evt.target === this.stage) {
          if (!nativeEvt.shiftKey) {
            this.callbacks.onSelectIds([]);
          }
          this.gesture = {
            kind: "marquee",
            startDoc: docPt,
            additive: Boolean(nativeEvt.shiftKey),
          };
        }
        return;
      }

      if (tool === "step") {
        const nextNum = this.state.nextStepNumber;
        const s = this.state.styleDefaults;
        this.callbacks.onCreateAnnotation({
          id: createId("ann"),
          type: "step",
          name: `Step #${nextNum}`,
          visible: true,
          locked: false,
          x: Math.round(docPt.x),
          y: Math.round(docPt.y),
          radius: s.stepRadius,
          stepNumber: nextNum,
          fillColor: s.stepFillColor,
          strokeColor: "#ffffff",
          textColor: "#ffffff",
          opacity: 1,
        });
        return;
      }

      if (tool === "text") {
        evt.evt.preventDefault();
        const s = this.state.styleDefaults;
        const defaultWidth = Math.min(
          280,
          Math.max(140, this.state.image.width - docPt.x - 16),
        );
        const textId = createId("ann");
        this.callbacks.onCreateAnnotation(
          {
            id: textId,
            type: "text",
            name: "Text Callout",
            visible: true,
            locked: false,
            x: Math.round(docPt.x),
            y: Math.round(docPt.y),
            width: Math.round(defaultWidth),
            text: "",
            fontSize: s.fontSize,
            fontWeight: s.fontWeight,
            textAlign: s.textAlign,
            strokeColor: s.strokeColor,
            fillColor: "#0f172a",
            fillOpacity: s.textBgOpacity,
            opacity: 1,
          },
          true,
        );
        return;
      }

      if (
        tool === "rect" ||
        tool === "ellipse" ||
        tool === "blur" ||
        tool === "pixelate" ||
        tool === "redact"
      ) {
        this.gesture = {
          kind: "draw-box",
          tool,
          startDoc: docPt,
        };
        return;
      }

      if (tool === "line" || tool === "arrow") {
        this.gesture = {
          kind: "draw-line",
          tool,
          startDoc: docPt,
        };
        return;
      }

      if (tool === "pen" || tool === "highlighter") {
        this.gesture = {
          kind: "draw-freehand",
          tool,
          points: [docPt.x, docPt.y, docPt.x, docPt.y],
        };
        this.renderDraftGesture(docPt, false);
      }
    });

    this.stage.on("mousemove touchmove", (evt) => {
      if (!this.state || !this.stage) return;
      const docPt = this.getPointerInDocument();
      this.callbacks.onCursorCoordsChange(
        docPt ? { x: Math.round(docPt.x), y: Math.round(docPt.y) } : null,
      );

      if (!this.gesture) return;
      const nativeEvt = evt.evt as MouseEvent;
      const shift = Boolean(nativeEvt.shiftKey || this.shiftPressed);

      if (this.gesture.kind === "pan") {
        const clientX =
          "clientX" in nativeEvt
            ? nativeEvt.clientX
            : ((evt.evt as TouchEvent).touches[0]?.clientX ?? 0);
        const clientY =
          "clientY" in nativeEvt
            ? nativeEvt.clientY
            : ((evt.evt as TouchEvent).touches[0]?.clientY ?? 0);
        this.callbacks.onViewportChange({
          panX: this.gesture.originPanX + (clientX - this.gesture.startClientX),
          panY: this.gesture.originPanY + (clientY - this.gesture.startClientY),
        });
        return;
      }

      if (!docPt) return;

      if (this.gesture.kind === "marquee" && this.marqueeRect) {
        const box = normalizeRect(
          this.gesture.startDoc.x,
          this.gesture.startDoc.y,
          docPt.x,
          docPt.y,
        );
        const invZoom = 1 / (this.state.viewport.zoom || 1);
        this.marqueeRect.setAttrs({
          visible: true,
          x: box.x,
          y: box.y,
          width: box.width,
          height: box.height,
          strokeWidth: invZoom,
          dash: [4 * invZoom, 4 * invZoom],
        });
        this.overlayLayer?.batchDraw();
        return;
      }

      if (this.gesture.kind === "drag-endpoint") {
        this.renderEndpointDragDraft(
          this.gesture.annotationId,
          this.gesture.endpoint,
          docPt,
          shift,
        );
        return;
      }

      if (this.gesture.kind === "draw-freehand") {
        if (
          this.gesture.tool === "highlighter" &&
          shift &&
          this.gesture.points.length >= 2
        ) {
          const sx = this.gesture.points[0]!;
          const sy = this.gesture.points[1]!;
          const snapped = snapLineEndpoint(sx, sy, docPt.x, docPt.y, 90);
          this.gesture.points = [sx, sy, snapped.x, snapped.y];
        } else {
          this.gesture.points.push(docPt.x, docPt.y);
        }
      }

      this.renderDraftGesture(docPt, shift);
    });

    this.stage.on("mouseleave", () => {
      this.callbacks.onCursorCoordsChange(null);
    });

    this.stage.on("mouseup touchend", () => {
      if (this.gesture) {
        this.finishPointerGesture();
      }
    });
  }

  private renderEndpointDragDraft(
    annotationId: string,
    endpoint: "start" | "end",
    docPt: Point,
    shift: boolean,
  ): void {
    if (!this.state || !this.draftGroup) return;
    const ann = this.state.annotations.find((a) => a.id === annotationId);
    if (!ann || (ann.type !== "line" && ann.type !== "arrow")) return;

    const anchorX = endpoint === "start" ? ann.x2 : ann.x1;
    const anchorY = endpoint === "start" ? ann.y2 : ann.y1;
    const target = shift
      ? snapLineEndpoint(anchorX, anchorY, docPt.x, docPt.y, 45)
      : docPt;

    const x1 = endpoint === "start" ? target.x : ann.x1;
    const y1 = endpoint === "start" ? target.y : ann.y1;
    const x2 = endpoint === "end" ? target.x : ann.x2;
    const y2 = endpoint === "end" ? target.y : ann.y2;

    this.draftGroup.destroyChildren();
    this.draftGroup.add(
      new Konva.Line({
        points: [x1, y1, x2, y2],
        stroke: "#8b5cf6",
        strokeWidth: Math.max(2, ann.strokeWidth),
        lineCap: "round",
        dash: [6, 4],
      }),
    );
    this.overlayLayer?.batchDraw();
  }

  private renderDraftGesture(currentDoc: Point, shift: boolean): void {
    if (!this.state || !this.draftGroup || !this.gesture) return;
    this.draftGroup.destroyChildren();
    const s = this.state.styleDefaults;

    if (this.gesture.kind === "draw-box") {
      const box = normalizeRect(
        this.gesture.startDoc.x,
        this.gesture.startDoc.y,
        currentDoc.x,
        currentDoc.y,
        shift,
      );
      if (box.width < 2 && box.height < 2) return;

      switch (this.gesture.tool) {
        case "rect":
          this.draftGroup.add(
            new Konva.Rect({
              ...box,
              cornerRadius: s.cornerRadius,
              stroke: s.strokeColor,
              strokeWidth: s.strokeWidth,
              fill:
                s.fillOpacity > 0
                  ? hexToRgba(s.fillColor, s.fillOpacity)
                  : undefined,
              opacity: s.opacity,
            }),
          );
          break;
        case "ellipse":
          this.draftGroup.add(
            new Konva.Ellipse({
              x: box.x + box.width / 2,
              y: box.y + box.height / 2,
              radiusX: Math.max(1, box.width / 2),
              radiusY: Math.max(1, box.height / 2),
              stroke: s.strokeColor,
              strokeWidth: s.strokeWidth,
              fill:
                s.fillOpacity > 0
                  ? hexToRgba(s.fillColor, s.fillOpacity)
                  : undefined,
              opacity: s.opacity,
            }),
          );
          break;
        case "redact":
          this.draftGroup.add(
            new Konva.Rect({
              ...box,
              fill: s.redactColor,
              opacity: 1,
            }),
          );
          break;
        case "blur":
        case "pixelate":
          this.draftGroup.add(
            new Konva.Rect({
              ...box,
              fill: "rgba(245, 158, 11, 0.14)",
              stroke: "#f59e0b",
              strokeWidth: 1.5 / (this.state.viewport.zoom || 1),
              dash: [5, 4],
            }),
          );
          break;
      }
    } else if (this.gesture.kind === "draw-line") {
      const endPt = shift
        ? snapLineEndpoint(
            this.gesture.startDoc.x,
            this.gesture.startDoc.y,
            currentDoc.x,
            currentDoc.y,
            45,
          )
        : currentDoc;

      if (this.gesture.tool === "line") {
        this.draftGroup.add(
          new Konva.Line({
            points: [
              this.gesture.startDoc.x,
              this.gesture.startDoc.y,
              endPt.x,
              endPt.y,
            ],
            stroke: s.strokeColor,
            strokeWidth: s.strokeWidth,
            lineCap: "round",
            opacity: s.opacity,
          }),
        );
      } else {
        const previewArrow: AnnotationObject = {
          id: "draft_arrow",
          type: "arrow",
          name: "Draft",
          visible: true,
          locked: false,
          x1: this.gesture.startDoc.x,
          y1: this.gesture.startDoc.y,
          x2: endPt.x,
          y2: endPt.y,
          strokeColor: s.strokeColor,
          strokeWidth: s.strokeWidth,
          opacity: s.opacity,
          headStyle: s.headStyle,
        };
        const arrowNode = this.createNodeForAnnotation(
          previewArrow,
          this.state,
          false,
          1 / (this.state.viewport.zoom || 1),
        );
        if (arrowNode) this.draftGroup.add(arrowNode as Konva.Shape);
      }
    } else if (this.gesture.kind === "draw-freehand") {
      const isHl = this.gesture.tool === "highlighter";
      this.draftGroup.add(
        new Konva.Line({
          points: this.gesture.points,
          stroke: isHl ? s.highlighterColor : s.strokeColor,
          strokeWidth: isHl ? s.highlighterWidth : s.strokeWidth,
          opacity: isHl ? clamp(s.highlighterOpacity, 0.08, 0.65) : s.opacity,
          lineCap: "round",
          lineJoin: "round",
          tension: isHl ? 0.25 : 0.35,
        }),
      );
    }

    this.overlayLayer?.batchDraw();
  }

  private finishPointerGesture(): void {
    const activeGesture = this.gesture;
    this.gesture = null;
    this.draftGroup?.destroyChildren();
    this.marqueeRect?.visible(false);
    this.overlayLayer?.batchDraw();
    this.updateCursor();

    if (!activeGesture || !this.state) return;
    const docPt = this.getPointerInDocument();
    const s = this.state.styleDefaults;

    if (activeGesture.kind === "pan") {
      return;
    }

    if (activeGesture.kind === "marquee") {
      if (!docPt) return;
      const box = normalizeRect(
        activeGesture.startDoc.x,
        activeGesture.startDoc.y,
        docPt.x,
        docPt.y,
      );
      if (box.width < 4 && box.height < 4) return;
      const matched = this.state.annotations
        .filter(
          (a) =>
            a.visible &&
            !a.locked &&
            boxesIntersect(box, getAnnotationBounds(a)),
        )
        .map((a) => a.id);

      const combined = activeGesture.additive
        ? Array.from(new Set([...this.state.selectedIds, ...matched]))
        : matched;
      this.callbacks.onSelectIds(combined);
      return;
    }

    if (activeGesture.kind === "drag-endpoint") {
      if (!docPt) return;
      const ann = this.state.annotations.find(
        (a) => a.id === activeGesture.annotationId,
      );
      if (!ann || (ann.type !== "line" && ann.type !== "arrow")) return;

      const anchorX = activeGesture.endpoint === "start" ? ann.x2 : ann.x1;
      const anchorY = activeGesture.endpoint === "start" ? ann.y2 : ann.y1;
      const target = this.shiftPressed
        ? snapLineEndpoint(anchorX, anchorY, docPt.x, docPt.y, 45)
        : docPt;

      this.callbacks.onCommitAnnotationsChange([
        {
          id: ann.id,
          transform: (prev) => {
            if (prev.type !== "line" && prev.type !== "arrow") return prev;
            return activeGesture.endpoint === "start"
              ? {
                  ...prev,
                  x1: Math.round(target.x * 10) / 10,
                  y1: Math.round(target.y * 10) / 10,
                }
              : {
                  ...prev,
                  x2: Math.round(target.x * 10) / 10,
                  y2: Math.round(target.y * 10) / 10,
                };
          },
        },
      ]);
      return;
    }

    if (activeGesture.kind === "draw-box") {
      if (!docPt) return;
      const box = normalizeRect(
        activeGesture.startDoc.x,
        activeGesture.startDoc.y,
        docPt.x,
        docPt.y,
        this.shiftPressed,
      );
      if (box.width < 5 || box.height < 5) return;

      const countOfType =
        this.state.annotations.filter((a) => a.type === activeGesture.tool)
          .length + 1;
      const roundedBox = {
        x: Math.round(box.x),
        y: Math.round(box.y),
        width: Math.round(box.width),
        height: Math.round(box.height),
      };

      switch (activeGesture.tool) {
        case "rect":
          this.callbacks.onCreateAnnotation({
            id: createId("ann"),
            type: "rect",
            name: `Rectangle #${countOfType}`,
            visible: true,
            locked: false,
            ...roundedBox,
            strokeColor: s.strokeColor,
            strokeWidth: s.strokeWidth,
            fillColor: s.fillColor,
            fillOpacity: s.fillOpacity,
            opacity: s.opacity,
            cornerRadius: s.cornerRadius,
          });
          break;
        case "ellipse":
          this.callbacks.onCreateAnnotation({
            id: createId("ann"),
            type: "ellipse",
            name: `Ellipse #${countOfType}`,
            visible: true,
            locked: false,
            ...roundedBox,
            strokeColor: s.strokeColor,
            strokeWidth: s.strokeWidth,
            fillColor: s.fillColor,
            fillOpacity: s.fillOpacity,
            opacity: s.opacity,
          });
          break;
        case "blur":
          this.callbacks.onCreateAnnotation({
            id: createId("ann"),
            type: "blur",
            name: `Blur #${countOfType}`,
            visible: true,
            locked: false,
            ...roundedBox,
            blurRadius: s.blurRadius,
          });
          break;
        case "pixelate":
          this.callbacks.onCreateAnnotation({
            id: createId("ann"),
            type: "pixelate",
            name: `Pixelate #${countOfType}`,
            visible: true,
            locked: false,
            ...roundedBox,
            blockSize: s.blockSize,
          });
          break;
        case "redact":
          this.callbacks.onCreateAnnotation({
            id: createId("ann"),
            type: "redact",
            name: `Opaque Redact #${countOfType}`,
            visible: true,
            locked: false,
            ...roundedBox,
            fillColor: s.redactColor,
            opacity: 1,
          });
          break;
      }
      return;
    }

    if (activeGesture.kind === "draw-line") {
      if (!docPt) return;
      const endPt = this.shiftPressed
        ? snapLineEndpoint(
            activeGesture.startDoc.x,
            activeGesture.startDoc.y,
            docPt.x,
            docPt.y,
            45,
          )
        : docPt;

      if (
        Math.hypot(
          endPt.x - activeGesture.startDoc.x,
          endPt.y - activeGesture.startDoc.y,
        ) < 6
      ) {
        return;
      }

      const countOfType =
        this.state.annotations.filter((a) => a.type === activeGesture.tool)
          .length + 1;

      if (activeGesture.tool === "line") {
        this.callbacks.onCreateAnnotation({
          id: createId("ann"),
          type: "line",
          name: `Line #${countOfType}`,
          visible: true,
          locked: false,
          x1: Math.round(activeGesture.startDoc.x),
          y1: Math.round(activeGesture.startDoc.y),
          x2: Math.round(endPt.x),
          y2: Math.round(endPt.y),
          strokeColor: s.strokeColor,
          strokeWidth: s.strokeWidth,
          opacity: s.opacity,
        });
      } else {
        this.callbacks.onCreateAnnotation({
          id: createId("ann"),
          type: "arrow",
          name: `Arrow #${countOfType}`,
          visible: true,
          locked: false,
          x1: Math.round(activeGesture.startDoc.x),
          y1: Math.round(activeGesture.startDoc.y),
          x2: Math.round(endPt.x),
          y2: Math.round(endPt.y),
          strokeColor: s.strokeColor,
          strokeWidth: s.strokeWidth,
          opacity: s.opacity,
          headStyle: s.headStyle,
        });
      }
      return;
    }

    if (activeGesture.kind === "draw-freehand") {
      const simplified = simplifyPoints(activeGesture.points, 2.2).map(
        (v) => Math.round(v * 10) / 10,
      );
      if (simplified.length < 4) return;
      const dx = Math.abs(
        (simplified[simplified.length - 2] ?? 0) - (simplified[0] ?? 0),
      );
      const dy = Math.abs(
        (simplified[simplified.length - 1] ?? 0) - (simplified[1] ?? 0),
      );
      if (simplified.length === 4 && dx < 3 && dy < 3) return;

      const countOfType =
        this.state.annotations.filter((a) => a.type === activeGesture.tool)
          .length + 1;

      if (activeGesture.tool === "highlighter") {
        this.callbacks.onCreateAnnotation(
          {
            id: createId("ann"),
            type: "highlighter",
            name: `Highlight #${countOfType}`,
            visible: true,
            locked: false,
            points: simplified,
            strokeColor: s.highlighterColor,
            strokeWidth: s.highlighterWidth,
            opacity: clamp(s.highlighterOpacity, 0.08, 0.65),
          },
          false,
        );
      } else {
        this.callbacks.onCreateAnnotation(
          {
            id: createId("ann"),
            type: "pen",
            name: `Pen Stroke #${countOfType}`,
            visible: true,
            locked: false,
            points: simplified,
            strokeColor: s.strokeColor,
            strokeWidth: s.strokeWidth,
            opacity: s.opacity,
          },
          false,
        );
      }
    }
  }
}
