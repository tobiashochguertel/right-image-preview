/** `browse` is the far-neighbor LOD; `display` is viewport-sized Screen; `full` is current-only. */
export type RasterTextureQuality = 'preview' | 'browse' | 'display' | 'full';
export interface RasterTextureEntry {
    key: string;
    resourceKey: string;
    quality: RasterTextureQuality;
    texture: WebGLTexture;
    textureWidth: number;
    textureHeight: number;
    naturalWidth: number;
    naturalHeight: number;
    estimatedBytes: number;
    lastUsedAt: number;
    readyAt: number;
    textureLimited: boolean;
}
