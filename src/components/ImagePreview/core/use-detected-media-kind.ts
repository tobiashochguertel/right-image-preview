import { useEffect, useMemo, useState } from 'react';

import { detectMediaKind, resolveMediaKind, type MediaKind } from './media-kind';
import type { MediaSource } from './media-source';

export interface UseDetectedMediaKindOptions {
  source: MediaSource;
  kind?: MediaKind;
  mimeType?: string;
  href?: string;
  fileName?: string;
}

/**
 * Resolves cheap host/MIME/name hints synchronously, then sniffs ambiguous bytes.
 * A stale detection can never overwrite the kind of a newer source.
 */
export function useDetectedMediaKind(options: UseDetectedMediaKindOptions): MediaKind {
  const { source, kind, mimeType, href, fileName } = options;
  const hinted = useMemo(() => {
    const primary = resolveMediaKind({ kind, mimeType, href });
    return primary === 'unknown' ? resolveMediaKind({ href: fileName }) : primary;
  }, [kind, mimeType, href, fileName]);
  const detectionKey = [kind, mimeType, href, fileName].join('\n');
  const [detection, setDetection] = useState<{
    source: MediaSource;
    key: string;
    kind: MediaKind;
  } | null>(null);

  useEffect(() => {
    let active = true;
    if (hinted !== 'unknown') return () => { active = false; };
    void detectMediaKind(source, { kind, mimeType, href }).then((next) => {
      if (active) setDetection({ source, key: detectionKey, kind: next });
    });
    return () => { active = false; };
  }, [source, kind, mimeType, href, hinted, detectionKey]);

  return detection?.source === source && detection.key === detectionKey
    ? detection.kind
    : hinted;
}
