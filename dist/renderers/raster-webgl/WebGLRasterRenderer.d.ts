import { RasterQuadTransform, RasterViewport } from './rasterQuad';
import { RasterTextureEntry } from './types';
export type WebGLContextEvent = 'lost' | 'restored' | 'restore-failed';
export declare class WebGLRasterRenderer {
    readonly canvas: HTMLCanvasElement;
    readonly gl: WebGL2RenderingContext;
    readonly maxTextureSize: number;
    private program;
    private buffer;
    private positionLocation;
    private texCoordLocation;
    private readonly listeners;
    private readonly onContextLost;
    private readonly onContextRestored;
    private lastContextFailure;
    constructor(canvas: HTMLCanvasElement);
    subscribeContext(listener: (event: WebGLContextEvent) => void): () => void;
    get contextFailure(): Error | null;
    resize(viewport: RasterViewport): void;
    upload(bitmap: ImageBitmap): Promise<WebGLTexture>;
    render(entry: RasterTextureEntry, viewport: RasterViewport, transform: RasterQuadTransform): boolean;
    dispose(): void;
    private initialize;
}
