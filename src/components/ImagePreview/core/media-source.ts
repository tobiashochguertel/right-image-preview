export type MediaSource =
  | {
      type: 'url';
      href: string;
      /**
       * Trusted source size supplied by the host when a custom protocol (for
       * example Tauri `asset:`) cannot expose Content-Length to fetch.
       */
      contentLength?: number;
    }
  | { type: 'blob'; blob: Blob; mimeType?: string }
  | { type: 'bytes'; data: ArrayBuffer; mimeType?: string };

export interface MediaSourceInput {
  source?: MediaSource;
  /** Legacy URL input. `source` wins when both are present. */
  src?: string;
}

export interface MediaSourceUrlLease {
  href: string;
  /** True only when this lease created the object URL. */
  owned: boolean;
  dispose(): void;
}

export interface ObjectUrlApi {
  createObjectURL(blob: Blob): string;
  revokeObjectURL(href: string): void;
}

export interface ReadMediaSourceOptions {
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
  /** Throttled transfer progress for the complete media body. */
  onProgress?: (progress: MediaDownloadProgress) => void;
}

export interface MediaDownloadProgress {
  loadedBytes: number;
  /** Present only when the response exposes a trustworthy Content-Length. */
  totalBytes?: number;
  /** 0–1 when totalBytes is known; omitted for an indeterminate transfer. */
  progress?: number;
  complete: boolean;
}

const DEFAULT_PREFIX_BYTES = 128 * 1024;

export function resolveMediaSource(input: MediaSourceInput): MediaSource | null {
  if (input.source) return input.source;
  if (typeof input.src === 'string' && input.src.length > 0) {
    return { type: 'url', href: input.src };
  }
  return null;
}

export function mediaSourceMimeType(source: MediaSource): string | undefined {
  if (source.type === 'url') return undefined;
  if (source.mimeType) return normalizeMimeType(source.mimeType);
  if (source.type === 'blob' && source.blob.type) return normalizeMimeType(source.blob.type);
  return undefined;
}

export function createMediaSourceUrlLease(
  source: MediaSource,
  objectUrlApi: ObjectUrlApi = URL,
): MediaSourceUrlLease {
  if (source.type === 'url') {
    return { href: source.href, owned: false, dispose() {} };
  }

  // Blob inputs are reused as-is. Bytes require one Blob because DOM media elements
  // cannot consume ArrayBuffer directly; the Blob is owned by the object URL lease.
  const blob = source.type === 'blob'
    ? source.blob
    : new Blob([source.data], { type: source.mimeType ?? '' });
  const href = objectUrlApi.createObjectURL(blob);
  let disposed = false;
  return {
    href,
    owned: true,
    dispose() {
      if (disposed) return;
      disposed = true;
      objectUrlApi.revokeObjectURL(href);
    },
  };
}

/**
 * Returns a decode-ready Blob without copying Blob inputs. URL sources are fetched;
 * byte sources necessarily allocate one Blob wrapper at this API boundary.
 */
export async function acquireMediaBlob(
  source: MediaSource,
  options: ReadMediaSourceOptions = {},
): Promise<Blob> {
  if (source.type === 'blob') {
    reportCompleteProgress(options.onProgress, source.blob.size);
    return source.blob;
  }
  if (source.type === 'bytes') {
    const blob = new Blob([source.data], { type: source.mimeType ?? '' });
    reportCompleteProgress(options.onProgress, blob.size);
    return blob;
  }
  const fetchImpl = options.fetchImpl ?? fetch;
  const response = await fetchImpl(source.href, { signal: options.signal });
  if (!response.ok) {
    throw new Error(`Failed to load media source: ${response.status} ${response.statusText}`);
  }
  const contentLength = parseContentLength(response.headers.get('content-length')) ??
    parseContentLength(source.contentLength);
  const contentType = response.headers.get('content-type') ?? '';
  if (!response.body) {
    const blob = await response.blob();
    reportCompleteProgress(options.onProgress, blob.size, contentLength);
    return blob;
  }

  const reader = response.body.getReader();
  const chunks: BlobPart[] = [];
  let loadedBytes = 0;
  let lastReportedBytes = 0;
  let lastReportedAt = performance.now();
  options.onProgress?.(toDownloadProgress(0, contentLength, false));
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      // ReadableStream byte chunks are valid BlobParts at runtime; the DOM lib's generic
      // ArrayBufferLike annotation is wider than BlobPart's ArrayBuffer-only typing.
      chunks.push(value as unknown as BlobPart);
      loadedBytes += value.byteLength;
      const now = performance.now();
      const ratioDelta = contentLength
        ? (loadedBytes - lastReportedBytes) / contentLength
        : 0;
      if (ratioDelta >= 0.01 || now - lastReportedAt >= 200) {
        options.onProgress?.(toDownloadProgress(loadedBytes, contentLength, false));
        lastReportedBytes = loadedBytes;
        lastReportedAt = now;
      }
    }
  } finally {
    reader.releaseLock();
  }
  const blob = new Blob(chunks, { type: contentType });
  reportCompleteProgress(options.onProgress, loadedBytes, contentLength);
  return blob;
}

function parseContentLength(value: string | number | null | undefined): number | undefined {
  if (value == null || value === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function toDownloadProgress(
  loadedBytes: number,
  totalBytes: number | undefined,
  complete: boolean,
): MediaDownloadProgress {
  return {
    loadedBytes,
    ...(totalBytes ? { totalBytes } : {}),
    ...(totalBytes
      ? { progress: complete ? 1 : Math.max(0, Math.min(1, loadedBytes / totalBytes)) }
      : {}),
    complete,
  };
}

function reportCompleteProgress(
  onProgress: ReadMediaSourceOptions['onProgress'],
  loadedBytes: number,
  totalBytes = loadedBytes,
): void {
  onProgress?.({
    loadedBytes,
    totalBytes,
    progress: 1,
    complete: true,
  });
}

/** Read only the prefix needed by format sniffing. */
export async function readMediaSourcePrefix(
  source: MediaSource,
  maxBytes = DEFAULT_PREFIX_BYTES,
  options: ReadMediaSourceOptions = {},
): Promise<Uint8Array> {
  const limit = normalizePrefixLimit(maxBytes);
  if (source.type === 'bytes') {
    return new Uint8Array(source.data, 0, Math.min(limit, source.data.byteLength));
  }
  if (source.type === 'blob') {
    return new Uint8Array(await source.blob.slice(0, limit).arrayBuffer());
  }

  const fetchImpl = options.fetchImpl ?? fetch;
  const response = await fetchImpl(source.href, {
    headers: { Range: `bytes=0-${limit - 1}` },
    signal: options.signal,
  });
  if (!response.ok) {
    throw new Error(`Failed to inspect media source: ${response.status} ${response.statusText}`);
  }
  if (!response.body) {
    const bytes = new Uint8Array(await response.arrayBuffer());
    return bytes.subarray(0, limit);
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (length < limit) {
      const { done, value } = await reader.read();
      if (done) break;
      const remaining = limit - length;
      const chunk = value.byteLength > remaining ? value.subarray(0, remaining) : value;
      chunks.push(chunk);
      length += chunk.byteLength;
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }
  const prefix = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    prefix.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return prefix;
}

function normalizePrefixLimit(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return DEFAULT_PREFIX_BYTES;
  return Math.max(1, Math.floor(value));
}

function normalizeMimeType(value: string): string | undefined {
  const mime = value.split(';', 1)[0]?.trim().toLowerCase();
  return mime || undefined;
}
