import '@testing-library/jest-dom/vitest';

if (typeof globalThis.ImageData === 'undefined') {
  class PolyfillImageData {
    readonly data: Uint8ClampedArray;
    readonly width: number;
    readonly height: number;
    readonly colorSpace: PredefinedColorSpace = 'srgb';

    constructor(
      swOrData: number | Uint8ClampedArray,
      sh: number,
       maybeSh?: number
    ) {
      if (typeof swOrData === 'number') {
        this.width = swOrData;
        this.height = sh;
        this.data = new Uint8ClampedArray(swOrData * sh * 4);
      } else {
        this.data = swOrData;
        this.width = sh;
        this.height = maybeSh ?? Math.floor(swOrData.length / (4 * sh));
      }
    }
  }
  Object.defineProperty(globalThis, 'ImageData', {
    value: PolyfillImageData,
    writable: true,
    configurable: true,
  });
}
