import { beforeEach, describe, expect, it } from "vitest";
import { useEditorStore } from "@/store/editor-store";
import { registerImageAsset } from "@/import/image-loader";
import type { LoadedImageAsset, RectAnnotation } from "@/types/editor";

function makeDummyAsset(id = "img_test_1"): LoadedImageAsset {
  return {
    assetId: id,
    name: "test.png",
    mimeType: "image/png",
    width: 800,
    height: 600,
    byteSize: 4096,
    hasTransparency: false,
    dataUrl:
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    objectUrl: null,
    element: null,
  };
}

function makeRect(id: string, x = 20, y = 30): RectAnnotation {
  return {
    id,
    type: "rect",
    name: `Rect ${id}`,
    visible: true,
    locked: false,
    x,
    y,
    width: 120,
    height: 80,
    strokeColor: "#ef4444",
    strokeWidth: 3,
    fillColor: "#ef4444",
    fillOpacity: 0,
    opacity: 1,
    cornerRadius: 4,
  };
}

describe("Editor Store & History Engine", () => {
  beforeEach(() => {
    useEditorStore.getState().resetProject();
  });

  it("adds, duplicates, moves, deletes, and undoes/redoes annotations cleanly", () => {
    const asset = makeDummyAsset();
    registerImageAsset(asset);

    const store = useEditorStore.getState();
    store.loadBackgroundImage(asset);

    store.addAnnotation(makeRect("r1", 10, 20));
    expect(useEditorStore.getState().history.present.annotations).toHaveLength(
      1,
    );
    expect(useEditorStore.getState().selectedIds).toEqual(["r1"]);

    useEditorStore.getState().duplicateSelectedAnnotations();
    expect(useEditorStore.getState().history.present.annotations).toHaveLength(
      2,
    );
    const second = useEditorStore.getState().history.present.annotations[1]!;
    expect(second.type === "rect" && second.x).toBe(28);
    expect(second.type === "rect" && second.y).toBe(38);

    useEditorStore.getState().undo();
    expect(useEditorStore.getState().history.present.annotations).toHaveLength(
      1,
    );

    useEditorStore.getState().redo();
    expect(useEditorStore.getState().history.present.annotations).toHaveLength(
      2,
    );

    useEditorStore.getState().deleteSelectedAnnotations();
    expect(useEditorStore.getState().history.present.annotations).toHaveLength(
      1,
    );
  });

  it("prevents history spam and corruption during continuous pointer transactions", () => {
    const asset = makeDummyAsset("img_tx");
    registerImageAsset(asset);
    useEditorStore.getState().loadBackgroundImage(asset);
    useEditorStore.getState().addAnnotation(makeRect("r1", 10, 10));

    const pastBeforeDrag = useEditorStore.getState().history.past.length;

    useEditorStore.getState().beginGestureTransaction();
    for (let i = 1; i <= 30; i++) {
      useEditorStore
        .getState()
        .updateTransientAnnotations([makeRect("r1", 10 + i * 2, 10 + i)]);
    }
    expect(useEditorStore.getState().history.past.length).toBe(pastBeforeDrag);

    useEditorStore.getState().commitGestureTransaction();
    expect(useEditorStore.getState().history.past.length).toBe(
      pastBeforeDrag + 1,
    );
    const finalRect = useEditorStore.getState().history.present.annotations[0]!;
    expect(finalRect.type === "rect" && finalRect.x).toBe(70);

    useEditorStore.getState().undo();
    const revertedRect =
      useEditorStore.getState().history.present.annotations[0]!;
    expect(revertedRect.type === "rect" && revertedRect.x).toBe(10);
  });

  it("cancels uncommitted gesture transactions cleanly on Escape", () => {
    const asset = makeDummyAsset("img_cancel");
    registerImageAsset(asset);
    useEditorStore.getState().loadBackgroundImage(asset);
    useEditorStore.getState().addAnnotation(makeRect("r1", 50, 50));

    useEditorStore.getState().beginGestureTransaction();
    useEditorStore
      .getState()
      .updateTransientAnnotations([makeRect("r1", 300, 300)]);
    useEditorStore.getState().cancelGestureTransaction();

    const current = useEditorStore.getState().history.present.annotations[0]!;
    expect(current.type === "rect" && current.x).toBe(50);
  });

  it("protects locked annotations from deletion and nudging", () => {
    const asset = makeDummyAsset("img_lock");
    registerImageAsset(asset);
    useEditorStore.getState().loadBackgroundImage(asset);
    useEditorStore.getState().addAnnotation(makeRect("r_locked", 40, 40));

    useEditorStore.getState().toggleLockAnnotation("r_locked");
    expect(
      useEditorStore.getState().history.present.annotations[0]?.locked,
    ).toBe(true);

    useEditorStore.getState().deleteSelectedAnnotations();
    expect(useEditorStore.getState().history.present.annotations).toHaveLength(
      1,
    );

    useEditorStore.getState().nudgeSelectedAnnotations(10, 10);
    const lockedRect =
      useEditorStore.getState().history.present.annotations[0]!;
    expect(lockedRect.type === "rect" && lockedRect.x).toBe(40);
  });

  it("converts decorative blur or pixelate into 100% opaque redaction", () => {
    const asset = makeDummyAsset("img_conv");
    registerImageAsset(asset);
    useEditorStore.getState().loadBackgroundImage(asset);
    useEditorStore.getState().addAnnotation({
      id: "b1",
      type: "blur",
      name: "Blur #1",
      visible: true,
      locked: false,
      x: 100,
      y: 120,
      width: 200,
      height: 60,
      blurRadius: 16,
    });

    useEditorStore.getState().convertToOpaqueRedaction("b1");
    const converted = useEditorStore.getState().history.present.annotations[0]!;
    expect(converted.type).toBe("redact");
    if (converted.type === "redact") {
      expect(converted.opacity).toBe(1);
      expect(converted.width).toBe(200);
      expect(converted.height).toBe(60);
    }
  });

  it("clears annotations while preserving background screenshot", () => {
    const asset = makeDummyAsset("img_keep");
    registerImageAsset(asset);
    useEditorStore.getState().loadBackgroundImage(asset);
    useEditorStore.getState().addAnnotation(makeRect("r1"));
    useEditorStore.getState().addAnnotation(makeRect("r2"));

    useEditorStore.getState().clearAnnotationsOnly();
    expect(useEditorStore.getState().history.present.annotations).toHaveLength(
      0,
    );
    expect(useEditorStore.getState().history.present.backgroundAssetId).toBe(
      "img_keep",
    );
  });

  it("coalesces a continuous slider drag into a single undo step", () => {
    const asset = makeDummyAsset("img_coalesce");
    registerImageAsset(asset);
    useEditorStore.getState().loadBackgroundImage(asset);
    useEditorStore.getState().addAnnotation(makeRect("r1"));
    const pastBefore = useEditorStore.getState().history.past.length;

    for (const width of [4, 5, 6, 7, 8]) {
      useEditorStore.getState().updateAnnotation(
        "r1",
        (p) => (p.type === "rect" ? { ...p, strokeWidth: width } : p),
        { coalesceKey: "r1:stroke-thickness" },
      );
    }

    const state = useEditorStore.getState();
    expect(state.history.past.length).toBe(pastBefore + 1);
    const rect = state.history.present.annotations[0]!;
    expect(rect.type === "rect" && rect.strokeWidth).toBe(8);

    useEditorStore.getState().undo();
    const restored = useEditorStore.getState().history.present.annotations[0]!;
    expect(restored.type === "rect" && restored.strokeWidth).toBe(3);
  });

  it("does not coalesce across an intervening document change", () => {
    const asset = makeDummyAsset("img_coalesce_2");
    registerImageAsset(asset);
    useEditorStore.getState().loadBackgroundImage(asset);
    useEditorStore.getState().addAnnotation(makeRect("r1"));

    const setWidth = (w: number) =>
      useEditorStore.getState().updateAnnotation(
        "r1",
        (p) => (p.type === "rect" ? { ...p, strokeWidth: w } : p),
        { coalesceKey: "r1:stroke-thickness" },
      );

    setWidth(5);
    useEditorStore.getState().addAnnotation(makeRect("r2"));
    const pastAfterAdd = useEditorStore.getState().history.past.length;
    setWidth(9);

    expect(useEditorStore.getState().history.past.length).toBe(pastAfterAdd + 1);
    useEditorStore.getState().undo();
    expect(useEditorStore.getState().history.present.annotations).toHaveLength(2);
  });

  it("leaves the dirty flag untouched when there is nothing to undo or redo", () => {
    useEditorStore.getState().undo();
    useEditorStore.getState().redo();
    expect(useEditorStore.getState().isDirty).toBe(false);
  });
});
