import { buildRasterQuad, type RasterQuadTransform, type RasterViewport } from './rasterQuad';
import { RASTER_FRAGMENT_SHADER, RASTER_VERTEX_SHADER } from './shaders';
import type { RasterTextureEntry } from './types';
import { RasterRendererFallbackError } from './rasterRendererState';

export type WebGLContextEvent = 'lost' | 'restored' | 'restore-failed';

export class WebGLRasterRenderer {
  readonly canvas: HTMLCanvasElement;
  readonly gl: WebGL2RenderingContext;
  readonly maxTextureSize: number;
  private program: WebGLProgram | null = null;
  private buffer: WebGLBuffer | null = null;
  private positionLocation = -1;
  private texCoordLocation = -1;
  private readonly listeners = new Set<(event: WebGLContextEvent) => void>();
  private readonly onContextLost: (event: Event) => void;
  private readonly onContextRestored: () => void;
  private lastContextFailure: Error | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const gl = canvas.getContext('webgl2', {
      alpha: true,
      antialias: false,
      depth: false,
      desynchronized: true,
      powerPreference: 'default',
      preserveDrawingBuffer: false,
      stencil: false,
    });
    if (!gl) {
      throw new RasterRendererFallbackError(
        'webgl2-unavailable',
        'WebGL2 is not available',
      );
    }
    this.gl = gl;
    this.maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE) as number;
    try {
      this.initialize();
    } catch (cause) {
      throw new RasterRendererFallbackError(
        'renderer-initialization-failed',
        'Unable to initialize the WebGL2 Raster renderer',
        cause,
      );
    }
    this.onContextLost = (event) => {
      event.preventDefault();
      this.listeners.forEach((listener) => listener('lost'));
    };
    this.onContextRestored = () => {
      try {
        this.initialize();
        this.lastContextFailure = null;
        this.listeners.forEach((listener) => listener('restored'));
      } catch (cause) {
        this.lastContextFailure = cause instanceof Error ? cause : new Error(String(cause));
        this.listeners.forEach((listener) => listener('restore-failed'));
      }
    };
    canvas.addEventListener('webglcontextlost', this.onContextLost);
    canvas.addEventListener('webglcontextrestored', this.onContextRestored);
  }

  subscribeContext(listener: (event: WebGLContextEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  get contextFailure(): Error | null {
    return this.lastContextFailure;
  }

  resize(viewport: RasterViewport): void {
    const width = Math.max(1, Math.round(viewport.width * viewport.dpr));
    const height = Math.max(1, Math.round(viewport.height * viewport.dpr));
    if (this.canvas.width !== width) this.canvas.width = width;
    if (this.canvas.height !== height) this.canvas.height = height;
    this.gl.viewport(0, 0, width, height);
  }

  async upload(bitmap: ImageBitmap): Promise<WebGLTexture> {
    const gl = this.gl;
    const texture = gl.createTexture();
    if (!texture) {
      throw new RasterRendererFallbackError(
        'texture-create-failed',
        'Unable to create WebGL texture',
      );
    }
    const previousTexture = gl.getParameter(gl.TEXTURE_BINDING_2D) as WebGLTexture | null;
    try {
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, bitmap);
      const uploadError = gl.getError();
      if (uploadError !== gl.NO_ERROR) {
        throw new RasterRendererFallbackError(
          'texture-upload-failed',
          `WebGL texture upload failed with error 0x${uploadError.toString(16)}`,
        );
      }
      const fence = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      if (!fence) throw new Error('Unable to create WebGL upload fence');
      gl.flush();
      try {
        await waitForFence(gl, fence);
      } finally {
        gl.deleteSync(fence);
      }
      return texture;
    } catch (error) {
      gl.deleteTexture(texture);
      if (error instanceof RasterRendererFallbackError) throw error;
      throw new RasterRendererFallbackError(
        'texture-upload-failed',
        'Unable to upload the Raster texture',
        error,
      );
    } finally {
      // 上传邻图不能污染主舞台的 sampler 绑定；绘制路径还会再次显式绑定。
      gl.bindTexture(
        gl.TEXTURE_2D,
        previousTexture && gl.isTexture(previousTexture) ? previousTexture : null,
      );
    }
  }

  render(
    entry: RasterTextureEntry,
    viewport: RasterViewport,
    transform: RasterQuadTransform,
  ): boolean {
    if (this.gl.isContextLost() || !this.gl.isTexture(entry.texture)) return false;
    if (!this.program || !this.buffer) throw new Error('WebGL renderer is not initialized');
    const gl = this.gl;
    this.resize(viewport);
    const vertices = buildRasterQuad(entry.naturalWidth, entry.naturalHeight, viewport, transform);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(this.program);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(this.positionLocation);
    gl.vertexAttribPointer(this.positionLocation, 2, gl.FLOAT, false, 16, 0);
    gl.enableVertexAttribArray(this.texCoordLocation);
    gl.vertexAttribPointer(this.texCoordLocation, 2, gl.FLOAT, false, 16, 8);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, entry.texture);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.flush();
    return true;
  }

  dispose(): void {
    this.canvas.removeEventListener('webglcontextlost', this.onContextLost);
    this.canvas.removeEventListener('webglcontextrestored', this.onContextRestored);
    if (this.buffer) this.gl.deleteBuffer(this.buffer);
    if (this.program) this.gl.deleteProgram(this.program);
    this.buffer = null;
    this.program = null;
    this.listeners.clear();
  }

  private initialize(): void {
    if (this.buffer) this.gl.deleteBuffer(this.buffer);
    if (this.program) this.gl.deleteProgram(this.program);
    const program = createProgram(this.gl, RASTER_VERTEX_SHADER, RASTER_FRAGMENT_SHADER);
    const buffer = this.gl.createBuffer();
    if (!buffer) {
      this.gl.deleteProgram(program);
      throw new Error('Unable to create WebGL vertex buffer');
    }
    this.program = program;
    this.buffer = buffer;
    this.positionLocation = this.gl.getAttribLocation(program, 'a_position');
    this.texCoordLocation = this.gl.getAttribLocation(program, 'a_texCoord');
    this.gl.useProgram(program);
    this.gl.uniform1i(this.gl.getUniformLocation(program, 'u_texture'), 0);
  }
}

function createProgram(gl: WebGL2RenderingContext, vertexSource: string, fragmentSource: string): WebGLProgram {
  const vertex = compileShader(gl, gl.VERTEX_SHADER, vertexSource);
  const fragment = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
  const program = gl.createProgram();
  if (!program) throw new Error('Unable to create WebGL program');
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const message = gl.getProgramInfoLog(program) ?? 'unknown link error';
    gl.deleteProgram(program);
    throw new Error('WebGL program link failed: ' + message);
  }
  return program;
}

function compileShader(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('Unable to create WebGL shader');
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader) ?? 'unknown compile error';
    gl.deleteShader(shader);
    throw new Error('WebGL shader compile failed: ' + message);
  }
  return shader;
}

function waitForFence(gl: WebGL2RenderingContext, fence: WebGLSync, timeoutMs = 5000): Promise<void> {
  const startedAt = performance.now();
  return new Promise((resolve, reject) => {
    const poll = () => {
      const status = gl.clientWaitSync(fence, 0, 0);
      if (status === gl.ALREADY_SIGNALED || status === gl.CONDITION_SATISFIED) resolve();
      else if (status === gl.WAIT_FAILED) reject(new Error('WebGL upload fence failed'));
      else if (performance.now() - startedAt >= timeoutMs) {
        reject(new Error('WebGL upload exceeded ' + timeoutMs + 'ms'));
      } else requestAnimationFrame(poll);
    };
    poll();
  });
}
