import type {
  RasterDecodeWorkerRequest,
  RasterDecodeWorkerResponse,
} from './rasterDecodeProtocol';

interface RasterDecodeWorkerScope {
  onmessage: ((event: MessageEvent<RasterDecodeWorkerRequest>) => void) | null;
  postMessage(message: RasterDecodeWorkerResponse, transfer: Transferable[]): void;
}

const workerScope = self as unknown as RasterDecodeWorkerScope;

workerScope.onmessage = async (event) => {
  const {
    id,
    blob,
    url,
    contentLength,
    resizeWidth,
    resizeHeight,
    fitWidth,
    fitHeight,
    maxTextureSize,
  } = event.data;
  try {
    const decodeBlob = blob ?? await fetchRasterBlob(id, url, contentLength);
    let bitmap = resizeWidth && resizeHeight
      ? await createImageBitmap(decodeBlob, {
          imageOrientation: 'from-image',
          resizeWidth,
          resizeHeight,
          resizeQuality: 'high',
        })
      : await createImageBitmap(decodeBlob, { imageOrientation: 'from-image' });
    const naturalWidth = bitmap.width;
    const naturalHeight = bitmap.height;
    if (!resizeWidth || !resizeHeight) {
      const target = fitDecodeTarget(
        naturalWidth,
        naturalHeight,
        fitWidth,
        fitHeight,
        maxTextureSize,
      );
      if (target.width !== bitmap.width || target.height !== bitmap.height) {
        const resized = await createImageBitmap(bitmap, 0, 0, bitmap.width, bitmap.height, {
          resizeWidth: target.width,
          resizeHeight: target.height,
          resizeQuality: 'high',
        });
        bitmap.close();
        bitmap = resized;
      }
    }
    workerScope.postMessage({
      id,
      bitmap,
      naturalWidth,
      naturalHeight,
    }, [bitmap]);
  } catch (error) {
    workerScope.postMessage({
      id,
      error: error instanceof Error ? error.message : String(error),
    }, []);
  }
};

/** URL 原图的读取、分块收集和 Blob 组装全部留在 Worker，避免大文件合并阻塞 UI。 */
async function fetchRasterBlob(
  id: number,
  url: string,
  trustedContentLength: number | undefined,
): Promise<Blob> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load media source: ${response.status} ${response.statusText}`);
  }
  const headerLength = Number(response.headers.get('content-length'));
  const totalBytes = Number.isFinite(headerLength) && headerLength > 0
    ? headerLength
    : trustedContentLength && trustedContentLength > 0
      ? trustedContentLength
      : undefined;
  const contentType = response.headers.get('content-type') ?? '';
  if (!response.body) {
    const result = await response.blob();
    postProgress(id, result.size, totalBytes ?? result.size, true);
    return result;
  }

  const reader = response.body.getReader();
  const chunks: BlobPart[] = [];
  let loadedBytes = 0;
  let lastReportedBytes = 0;
  let lastReportedAt = performance.now();
  postProgress(id, 0, totalBytes, false);
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value as unknown as BlobPart);
      loadedBytes += value.byteLength;
      const now = performance.now();
      const ratioDelta = totalBytes ? (loadedBytes - lastReportedBytes) / totalBytes : 0;
      if (ratioDelta >= 0.01 || now - lastReportedAt >= 200) {
        postProgress(id, loadedBytes, totalBytes, false);
        lastReportedBytes = loadedBytes;
        lastReportedAt = now;
      }
    }
  } finally {
    reader.releaseLock();
  }
  const result = new Blob(chunks, { type: contentType });
  postProgress(id, loadedBytes, totalBytes ?? loadedBytes, true);
  return result;
}

function postProgress(
  id: number,
  loadedBytes: number,
  totalBytes: number | undefined,
  complete: boolean,
): void {
  workerScope.postMessage({
    id,
    progress: {
      loadedBytes,
      ...(totalBytes ? { totalBytes } : {}),
      ...(totalBytes
        ? { progress: complete ? 1 : Math.max(0, Math.min(1, loadedBytes / totalBytes)) }
        : {}),
      complete,
    },
  }, []);
}

function fitDecodeTarget(
  naturalWidth: number,
  naturalHeight: number,
  fitWidth: number | undefined,
  fitHeight: number | undefined,
  maxTextureSize: number | undefined,
): { width: number; height: number } {
  const fitScale = fitWidth && fitHeight
    ? Math.min(1, fitWidth / naturalWidth, fitHeight / naturalHeight)
    : 1;
  const safeLimit = Math.max(1, Math.floor(maxTextureSize ?? Number.POSITIVE_INFINITY));
  const limitedScale = Math.min(fitScale, safeLimit / Math.max(naturalWidth, naturalHeight));
  return {
    width: Math.max(1, Math.round(naturalWidth * limitedScale)),
    height: Math.max(1, Math.round(naturalHeight * limitedScale)),
  };
}
