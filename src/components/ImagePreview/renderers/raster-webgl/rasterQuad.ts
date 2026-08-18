export interface RasterQuadTransform {
  scale: number;
  translateX: number;
  translateY: number;
  rotation: number;
  flipH: boolean;
  flipV: boolean;
}

export interface RasterViewport {
  width: number;
  height: number;
  dpr: number;
}

export function buildRasterQuad(
  naturalWidth: number,
  naturalHeight: number,
  viewport: RasterViewport,
  transform: RasterQuadTransform,
): Float32Array {
  const halfW = naturalWidth * transform.scale / 2;
  const halfH = naturalHeight * transform.scale / 2;
  const radians = transform.rotation * Math.PI / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const flipX = transform.flipH ? -1 : 1;
  const flipY = transform.flipV ? -1 : 1;
  const vertex = (x: number, y: number, u: number, v: number): number[] => {
    const fx = x * flipX;
    const fy = y * flipY;
    const rotatedX = fx * cos - fy * sin;
    const rotatedY = fx * sin + fy * cos;
    const screenX = viewport.width / 2 + transform.translateX + rotatedX;
    const screenY = viewport.height / 2 + transform.translateY + rotatedY;
    return [screenX / viewport.width * 2 - 1, 1 - screenY / viewport.height * 2, u, v];
  };
  return new Float32Array([
    ...vertex(-halfW, -halfH, 0, 0),
    ...vertex(halfW, -halfH, 1, 0),
    ...vertex(-halfW, halfH, 0, 1),
    ...vertex(halfW, halfH, 1, 1),
  ]);
}
