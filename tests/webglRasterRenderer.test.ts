import { describe, expect, it, vi } from 'vitest';

import { WebGLRasterRenderer } from '../src/components/ImagePreview/renderers/raster-webgl/WebGLRasterRenderer';
import type { RasterTextureEntry } from '../src/components/ImagePreview/renderers/raster-webgl/types';

describe('WebGLRasterRenderer texture binding safety', () => {
  it('restores the stage texture binding after a background upload', async () => {
    const stageTexture = { id: 'stage' } as unknown as WebGLTexture;
    const uploadedTexture = { id: 'neighbor' } as unknown as WebGLTexture;
    let boundTexture: WebGLTexture | null = stageTexture;
    const gl = {
      TEXTURE_2D: 1,
      TEXTURE_BINDING_2D: 2,
      UNPACK_FLIP_Y_WEBGL: 3,
      UNPACK_PREMULTIPLY_ALPHA_WEBGL: 4,
      TEXTURE_WRAP_S: 5,
      TEXTURE_WRAP_T: 6,
      CLAMP_TO_EDGE: 7,
      TEXTURE_MIN_FILTER: 8,
      TEXTURE_MAG_FILTER: 9,
      LINEAR: 10,
      RGBA: 11,
      UNSIGNED_BYTE: 12,
      NO_ERROR: 0,
      SYNC_GPU_COMMANDS_COMPLETE: 13,
      ALREADY_SIGNALED: 14,
      CONDITION_SATISFIED: 15,
      WAIT_FAILED: 16,
      createTexture: vi.fn(() => uploadedTexture),
      isTexture: vi.fn((texture: WebGLTexture) => texture === stageTexture),
      getParameter: vi.fn(() => boundTexture),
      bindTexture: vi.fn((_target: number, texture: WebGLTexture | null) => {
        boundTexture = texture;
      }),
      pixelStorei: vi.fn(),
      texParameteri: vi.fn(),
      texImage2D: vi.fn(),
      getError: vi.fn(() => 0),
      fenceSync: vi.fn(() => ({}) as WebGLSync),
      flush: vi.fn(),
      clientWaitSync: vi.fn(() => 14),
      deleteSync: vi.fn(),
      deleteTexture: vi.fn(),
    } as unknown as WebGL2RenderingContext;
    const renderer = rendererWith(gl);

    await expect(renderer.upload({ width: 1, height: 1 } as ImageBitmap))
      .resolves.toBe(uploadedTexture);

    expect(boundTexture).toBe(stageTexture);
    expect(gl.bindTexture).toHaveBeenLastCalledWith(gl.TEXTURE_2D, stageTexture);
  });

  it('refuses to draw an evicted texture handle', () => {
    const drawArrays = vi.fn();
    const gl = {
      isContextLost: vi.fn(() => false),
      isTexture: vi.fn(() => false),
      drawArrays,
    } as unknown as WebGL2RenderingContext;
    const renderer = rendererWith(gl);

    expect(renderer.render(entry(), { width: 800, height: 600, dpr: 1 }, {
      scale: 1,
      translateX: 0,
      translateY: 0,
      rotation: 0,
      flipH: false,
      flipV: false,
    })).toBe(false);
    expect(drawArrays).not.toHaveBeenCalled();
  });

  it('classifies texture creation failure for the safe fallback route', async () => {
    const gl = {
      createTexture: vi.fn(() => null),
    } as unknown as WebGL2RenderingContext;
    const renderer = rendererWith(gl);

    await expect(renderer.upload({ width: 1, height: 1 } as ImageBitmap)).rejects
      .toEqual(expect.objectContaining({
        reason: 'texture-create-failed',
      }));
  });

  it('classifies texture upload failure for the safe fallback route', async () => {
    const texture = {} as WebGLTexture;
    const gl = {
      TEXTURE_2D: 1,
      TEXTURE_BINDING_2D: 2,
      UNPACK_FLIP_Y_WEBGL: 3,
      UNPACK_PREMULTIPLY_ALPHA_WEBGL: 4,
      TEXTURE_WRAP_S: 5,
      TEXTURE_WRAP_T: 6,
      CLAMP_TO_EDGE: 7,
      TEXTURE_MIN_FILTER: 8,
      TEXTURE_MAG_FILTER: 9,
      LINEAR: 10,
      RGBA: 11,
      UNSIGNED_BYTE: 12,
      NO_ERROR: 0,
      createTexture: vi.fn(() => texture),
      getParameter: vi.fn(() => null),
      bindTexture: vi.fn(),
      isTexture: vi.fn(() => false),
      pixelStorei: vi.fn(),
      texParameteri: vi.fn(),
      texImage2D: vi.fn(() => {
        throw new Error('driver rejected upload');
      }),
      getError: vi.fn(() => 0),
      deleteTexture: vi.fn(),
    } as unknown as WebGL2RenderingContext;
    const renderer = rendererWith(gl);

    await expect(renderer.upload({ width: 1, height: 1 } as ImageBitmap)).rejects
      .toEqual(expect.objectContaining({
        reason: 'texture-upload-failed',
      }));
    expect(gl.deleteTexture).toHaveBeenCalledWith(texture);
  });

  it('treats a WebGL error flag after texImage2D as an upload failure', async () => {
    const texture = {} as WebGLTexture;
    const gl = {
      TEXTURE_2D: 1,
      TEXTURE_BINDING_2D: 2,
      UNPACK_FLIP_Y_WEBGL: 3,
      UNPACK_PREMULTIPLY_ALPHA_WEBGL: 4,
      TEXTURE_WRAP_S: 5,
      TEXTURE_WRAP_T: 6,
      CLAMP_TO_EDGE: 7,
      TEXTURE_MIN_FILTER: 8,
      TEXTURE_MAG_FILTER: 9,
      LINEAR: 10,
      RGBA: 11,
      UNSIGNED_BYTE: 12,
      NO_ERROR: 0,
      OUT_OF_MEMORY: 0x0505,
      createTexture: vi.fn(() => texture),
      getParameter: vi.fn(() => null),
      bindTexture: vi.fn(),
      isTexture: vi.fn(() => false),
      pixelStorei: vi.fn(),
      texParameteri: vi.fn(),
      texImage2D: vi.fn(),
      getError: vi.fn(() => 0x0505),
      deleteTexture: vi.fn(),
    } as unknown as WebGL2RenderingContext;
    const renderer = rendererWith(gl);

    await expect(renderer.upload({ width: 1, height: 1 } as ImageBitmap)).rejects
      .toEqual(expect.objectContaining({
        reason: 'texture-upload-failed',
      }));
    expect(gl.deleteTexture).toHaveBeenCalledWith(texture);
  });
});

function rendererWith(gl: WebGL2RenderingContext): WebGLRasterRenderer {
  const renderer = Object.create(WebGLRasterRenderer.prototype) as WebGLRasterRenderer;
  Object.assign(renderer, { gl });
  return renderer;
}

function entry(): RasterTextureEntry {
  return {
    key: 'current|display',
    resourceKey: 'current',
    quality: 'display',
    texture: {} as WebGLTexture,
    textureWidth: 1,
    textureHeight: 1,
    naturalWidth: 1,
    naturalHeight: 1,
    estimatedBytes: 4,
    lastUsedAt: 0,
    readyAt: 0,
    textureLimited: false,
  };
}
