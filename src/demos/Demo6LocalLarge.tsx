import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import {
  ImagePreview,
  detectRasterTextureBudgetBytes,
  rgbaTextureBytes,
  type ImageItem,
  type MainImageLoadStage,
  type NeighborPreloadStatusMap,
  type RasterPreloadPlanSnapshot,
} from '../components/ImagePreview';
import { gridStyle, sectionDescStyle, sectionHeadStyle } from './demoStyles';
import type { DemoStrings } from './demoLocale';
import { ThumbCard } from './shared';

/**
 * Dev-only gallery backed by gitignored `./test-images` (+ `thumbs/`).
 * Filenames are discovered at runtime via middleware — nothing private is hardcoded
 * or shipped in the published demo / git history.
 */
const MANIFEST_URL = '/__local_test_images__/manifest.json';

/** Fixed workspace chrome — avoids layout jump when image aspect / sidebar text changes. */
const DEMO6_WORKSPACE_H = 560;
const DEMO6_SIDEBAR_W = 300;
const DEMO6_HISTORY_MAX_H = 120;
const DEMO6_CONSOLE_SAMPLE_DELAY_MS = 800;

type NavPath = 'fast-reveal' | 'cold';

interface NavTiming {
  index: number;
  path: NavPath;
  /** ms from navigate → thumbnail underlay stage */
  underlayMs: number | null;
  /** ms from navigate → sharp main (`full-ready`) */
  sharpMs: number;
}

interface DimCache {
  [src: string]: { w: number; h: number };
}

function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n < 0) return '—';
  if (n < 1024) return `${Math.round(n)} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KiB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MiB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GiB`;
}

function bytesForSrc(src: string | undefined, dimBySrc: DimCache): number | null {
  if (!src) return null;
  const dim = dimBySrc[src];
  if (!dim) return null;
  return rgbaTextureBytes(dim.w, dim.h);
}

function splitRelativeIndexes(indexes: readonly number[], currentIndex: number) {
  return {
    next: indexes.filter((value) => value > currentIndex),
    prev: indexes.filter((value) => value < currentIndex),
  };
}

export function Demo6LocalLarge({
  t,
  previewLanguage,
}: {
  t: DemoStrings;
  previewLanguage: string;
}) {
  const [images, setImages] = useState<ImageItem[]>([]);
  const [index, setIndex] = useState(0);
  const [open, setOpen] = useState(true);
  const [available, setAvailable] = useState<boolean | null>(null);
  /** When off: no display-ready pool — every ←/→ is cold progressive (easier A/B). */
  const [slotsOn, setSlotsOn] = useState(true);
  const [preloadStatus, setPreloadStatus] = useState<NeighborPreloadStatusMap>({});
  const [lodPlan, setLodPlan] = useState<RasterPreloadPlanSnapshot | null>(null);
  const [dimBySrc, setDimBySrc] = useState<DimCache>({});
  const [lastTiming, setLastTiming] = useState<NavTiming | null>(null);
  const [history, setHistory] = useState<NavTiming[]>([]);
  const [autoCacheBudgetBytes] = useState(detectRasterTextureBudgetBytes);

  const navStartRef = useRef(0);
  const underlayAtRef = useRef<number | null>(null);
  const pathForNavRef = useRef<NavPath>('cold');
  const indexRef = useRef(0);
  const statusRef = useRef(preloadStatus);
  const dimProbeRef = useRef(new Set<string>());
  const diagnosticTimersRef = useRef(new Set<number>());
  const lastScheduledDiagnosticIndexRef = useRef<number | null>(null);

  useEffect(() => {
    statusRef.current = preloadStatus;
  }, [preloadStatus]);

  useEffect(() => {
    let cancelled = false;
    void fetch(MANIFEST_URL, { cache: 'no-store' })
      .then(async (r) => {
        if (!r.ok) throw new Error('missing');
        const data = (await r.json()) as {
          images?: { name: string; src: string; minimapSrc: string }[];
        };
        if (cancelled) return;
        const list = (data.images ?? []).map((row) => ({
          src: row.src,
          minimapSrc: row.minimapSrc,
          alt: row.name,
          name: row.name,
        }));
        setImages(list);
        setAvailable(list.length > 0);
      })
      .catch(() => {
        if (!cancelled) {
          setImages([]);
          setAvailable(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Probe natural size for display-ready / current (cache hit → dims without product API).
  useEffect(() => {
    const want = new Set<string>();
    for (const [k, entry] of Object.entries(preloadStatus)) {
      if (entry?.phase !== 'display-ready' && entry?.phase !== 'browse-ready') continue;
      const src = images[Number(k)]?.src;
      if (src) want.add(src);
    }
    const cur = images[index]?.src;
    if (cur) want.add(cur);

    for (const src of want) {
      if (dimBySrc[src] || dimProbeRef.current.has(src)) continue;
      dimProbeRef.current.add(src);
      const img = new Image();
      img.onload = () => {
        if (img.naturalWidth > 0 && img.naturalHeight > 0) {
          setDimBySrc((prev) =>
            prev[src]
              ? prev
              : { ...prev, [src]: { w: img.naturalWidth, h: img.naturalHeight } },
          );
        }
      };
      img.onerror = () => {
        dimProbeRef.current.delete(src);
      };
      img.src = src;
    }
  }, [preloadStatus, images, index, dimBySrc]);

  const beginNav = useCallback((nextIndex: number) => {
    indexRef.current = nextIndex;
    setIndex(nextIndex);
    navStartRef.current = performance.now();
    underlayAtRef.current = null;
    const phase = statusRef.current[nextIndex]?.phase;
    pathForNavRef.current = phase === 'display-ready' ? 'fast-reveal' : 'cold';
    setLastTiming(null);
  }, []);

  const onStage = useCallback((stage: MainImageLoadStage) => {
    const t0 = navStartRef.current;
    if (t0 <= 0) return;
    if (stage === 'thumbnail-placeholder' && underlayAtRef.current == null) {
      underlayAtRef.current = Math.round(performance.now() - t0);
    }
    if (stage === 'full-ready') {
      const row: NavTiming = {
        index: indexRef.current,
        path: pathForNavRef.current,
        underlayMs: underlayAtRef.current,
        sharpMs: Math.round(performance.now() - t0),
      };
      setLastTiming(row);
      setHistory((h) => [row, ...h].slice(0, 8));
    }
  }, []);

  const activeNeighborIndexes = useMemo(() => {
    if (!slotsOn) return [] as number[];
    return Object.entries(preloadStatus)
      .filter(([key, entry]) =>
        Number(key) !== index &&
        (entry?.phase === 'display-ready' || entry?.phase === 'browse-ready'))
      .map(([key]) => Number(key))
      .filter(Number.isFinite);
  }, [slotsOn, index, preloadStatus]);

  const ramView = useMemo(() => {
    const curSrc = images[index]?.src;
    const currentBytes = preloadStatus[index]?.textureBytes ?? bytesForSrc(curSrc, dimBySrc);
    let neighborsBytes = 0;
    for (const idx of activeNeighborIndexes) {
      neighborsBytes += preloadStatus[idx]?.textureBytes ?? 0;
    }
    const withPreload = !slotsOn
      ? currentBytes
      : currentBytes != null
        ? currentBytes + neighborsBytes
        : neighborsBytes > 0
          ? neighborsBytes
          : null;
    const withoutPreload = currentBytes;
    const extra = slotsOn ? neighborsBytes : 0;
    return {
      currentBytes,
      neighborsBytes,
      neighborIndexes: activeNeighborIndexes,
      withPreload,
      withoutPreload,
      extra,
    };
  }, [images, index, dimBySrc, activeNeighborIndexes, slotsOn, preloadStatus]);

  const screenPlan = useMemo(() => splitRelativeIndexes([
    ...(lodPlan?.screenForwardIndexes ?? []),
    ...(lodPlan?.screenBackwardIndexes ?? []),
  ], index), [lodPlan, index]);
  const browsePlan = useMemo(() => splitRelativeIndexes([
    ...(lodPlan?.browseForwardIndexes ?? []),
    ...(lodPlan?.browseBackwardIndexes ?? []),
  ], index), [lodPlan, index]);
  const residentLods = useMemo(() => {
    const screen: number[] = [];
    const browse: number[] = [];
    Object.entries(preloadStatus).forEach(([key, entry]) => {
      const flatIndex = Number(key);
      if (!Number.isFinite(flatIndex) || flatIndex === index) return;
      if (entry?.phase === 'display-ready') screen.push(flatIndex);
      if (entry?.phase === 'browse-ready') browse.push(flatIndex);
    });
    return {
      screen: splitRelativeIndexes(screen, index),
      browse: splitRelativeIndexes(browse, index),
    };
  }, [preloadStatus, index]);
  const diagnosticSnapshot = useMemo(() => ({
    sampledIndex: index,
    imageName: images[index]?.name ?? images[index]?.alt ?? images[index]?.src ?? null,
    preloadEnabled: slotsOn,
    memory: {
      nowBytes: ramView.withPreload,
      now: ramView.withPreload == null ? null : formatBytes(ramView.withPreload),
      currentBytes: ramView.currentBytes,
      current: ramView.currentBytes == null ? null : formatBytes(ramView.currentBytes),
      neighborBytes: ramView.neighborsBytes,
      neighbors: formatBytes(ramView.neighborsBytes),
      neighborIndexes: ramView.neighborIndexes,
      ifOffBytes: ramView.withoutPreload,
      ifOff: ramView.withoutPreload == null ? null : formatBytes(ramView.withoutPreload),
      extraBytes: ramView.extra,
      extra: formatBytes(ramView.extra),
      budgetBytes: autoCacheBudgetBytes,
      budget: formatBytes(autoCacheBudgetBytes),
    },
    viewport: lodPlan?.viewport ?? null,
    planned: {
      screen: screenPlan,
      browse: browsePlan,
    },
    resident: residentLods,
    nearbyPhases: {
      prev: preloadStatus[index - 1]?.phase ?? null,
      current: preloadStatus[index]?.phase ?? null,
      next: preloadStatus[index + 1]?.phase ?? null,
    },
  }), [
    index,
    images,
    slotsOn,
    ramView,
    autoCacheBudgetBytes,
    lodPlan?.viewport,
    screenPlan,
    browsePlan,
    residentLods,
    preloadStatus,
  ]);
  const diagnosticSnapshotRef = useRef(diagnosticSnapshot);

  useEffect(() => {
    diagnosticSnapshotRef.current = diagnosticSnapshot;
  }, [diagnosticSnapshot]);

  useEffect(() => {
    if (!import.meta.env.DEV || available !== true || images.length === 0) return;
    if (lastScheduledDiagnosticIndexRef.current === index) return;
    lastScheduledDiagnosticIndexRef.current = index;
    const requestedIndex = index;
    const timer = window.setTimeout(() => {
      diagnosticTimersRef.current.delete(timer);
      const sampled = diagnosticSnapshotRef.current;
      console.info(
        `[Demo 6 GPU diagnostics]\n${JSON.stringify({
          navigation: {
            requestedIndex,
            sampledIndex: sampled.sampledIndex,
            sampleDelayMs: DEMO6_CONSOLE_SAMPLE_DELAY_MS,
            sampledSameVisit: requestedIndex === sampled.sampledIndex,
          },
          ...sampled,
        }, null, 2)}`,
      );
    }, DEMO6_CONSOLE_SAMPLE_DELAY_MS);
    diagnosticTimersRef.current.add(timer);
  }, [available, images.length, index]);

  useEffect(() => () => {
    diagnosticTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    diagnosticTimersRef.current.clear();
  }, []);

  if (!import.meta.env.DEV) {
    return null;
  }

  const currentPhase = preloadStatus[index]?.phase ?? '—';
  const nextPhase = preloadStatus[index + 1]?.phase ?? '—';
  const prevPhase = preloadStatus[index - 1]?.phase ?? '—';

  const mono: CSSProperties = {
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    fontSize: 11,
  };

  const line: CSSProperties = {
    height: 16,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  };

  const diagnosticLine: CSSProperties = {
    minHeight: 16,
    lineHeight: '16px',
    whiteSpace: 'normal',
    overflowWrap: 'anywhere',
    wordBreak: 'break-word',
  };

  return (
    <section>
      <h2 style={sectionHeadStyle}>{t.demo6Title}</h2>
      <p style={sectionDescStyle}>{t.demo6Desc}</p>

      {available === false && (
        <p style={{ ...sectionDescStyle, color: '#e8a0a0' }}>{t.demo6Missing}</p>
      )}

      {available === true && images.length > 0 && (
        <>
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              justifyContent: 'space-between',
              gap: 12,
              marginBottom: 10,
            }}
          >
            <span style={{ fontSize: 13, color: '#9aa3b5' }}>{t.photosBadge(images.length)}</span>
            <span style={{ fontSize: 11, color: '#666' }}>{t.demo6GridHint}</span>
          </div>
          <div
            style={{
              ...gridStyle,
              maxHeight: 340,
              overflowY: 'auto',
              paddingRight: 4,
              marginBottom: 4,
            }}
          >
            {images.map((img, i) => (
              <ThumbCard
                key={img.src}
                src={img.minimapSrc ?? img.src}
                alt={img.alt ?? ''}
                label={img.name ?? img.alt ?? ''}
                ariaLabel={t.thumbAria(img.name ?? img.alt ?? '')}
                clickHint={t.thumbClickHint}
                onClick={() => {
                  beginNav(i);
                  setOpen(true);
                }}
              />
            ))}
          </div>

          <div
            style={{
              marginTop: 20,
              display: 'flex',
              width: '100%',
              height: DEMO6_WORKSPACE_H,
              maxHeight: DEMO6_WORKSPACE_H,
              borderRadius: 12,
              overflow: 'hidden',
              border: '1px solid rgba(255,255,255,0.1)',
              background: 'rgba(12,14,22,0.9)',
              boxSizing: 'border-box',
            }}
          >
            <aside
              style={{
                width: DEMO6_SIDEBAR_W,
                minWidth: DEMO6_SIDEBAR_W,
                maxWidth: DEMO6_SIDEBAR_W,
                height: '100%',
                flexShrink: 0,
                padding: '14px 12px',
                boxSizing: 'border-box',
                background: 'rgba(18,22,34,0.95)',
                borderRight: '1px solid rgba(255,255,255,0.08)',
                fontSize: 12,
                color: 'rgba(180,190,215,0.9)',
                lineHeight: 1.45,
                overflowX: 'hidden',
                overflowY: 'auto',
              }}
            >
              <div style={{ fontWeight: 650, marginBottom: 8, color: '#e4e8f4', fontSize: 13 }}>
                {t.demo6SidebarTitle}
              </div>
              <p
                title={t.demo6HowTo}
                style={{
                  margin: '0 0 10px',
                  color: '#888',
                  fontSize: 11,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  cursor: 'help',
                }}
              >
                {t.demo6HowToShort}
              </p>

              <label
                style={{
                  display: 'flex',
                  gap: 8,
                  alignItems: 'center',
                  marginBottom: 10,
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={slotsOn}
                  onChange={(e) => {
                    setSlotsOn(e.target.checked);
                    setHistory([]);
                    setLastTiming(null);
                    setPreloadStatus({});
                  }}
                />
                <span>{t.demo6SlotsToggle}</span>
              </label>

              <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '8px 10px',
                  borderRadius: 8,
                  border: '1px solid rgba(255,255,255,0.12)',
                  background: open ? 'rgba(88,101,242,0.25)' : 'transparent',
                  color: '#cdd5e0',
                  cursor: 'pointer',
                  fontSize: 13,
                  marginBottom: 12,
                }}
              >
                {open ? t.demo5HidePreview : t.demo5ShowPreview}
              </button>

              {/* ── RAM: meaningful numbers only ── */}
              <div
                style={{
                  padding: '10px 10px',
                  borderRadius: 8,
                  background: 'rgba(0,0,0,0.35)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  marginBottom: 10,
                  ...mono,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'baseline',
                    marginBottom: 8,
                    gap: 8,
                  }}
                >
                  <span style={{ color: '#9aa3b5' }}>{t.demo6PoolTitle}</span>
                  <span
                    title={t.demo6PoolHint}
                    style={{
                      color: '#666',
                      fontSize: 10,
                      cursor: 'help',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      maxWidth: 140,
                    }}
                  >
                    {t.demo6PoolHintShort}
                  </span>
                </div>

                <div style={{ ...line, color: slotsOn ? '#6dcea0' : '#e0b35a', marginBottom: 6 }}>
                  {slotsOn ? t.demo6PoolModeOn : t.demo6PoolModeOff}
                </div>

                <div style={line}>
                  {t.demo6PoolNow}{' '}
                  <b style={{ color: '#e8e8e8' }}>
                    {ramView.withPreload != null ? formatBytes(ramView.withPreload) : '—'}
                  </b>
                </div>
                <div style={{ ...line, color: '#8a93a8', marginBottom: 6 }}>
                  {t.demo6PoolCurrent}{' '}
                  {ramView.currentBytes != null ? formatBytes(ramView.currentBytes) : '—'}
                  {slotsOn ? (
                    <>
                      {' + '}
                      {t.demo6PoolNeighbors} {formatBytes(ramView.neighborsBytes)}
                      {ramView.neighborIndexes.length > 0
                        ? ` [${ramView.neighborIndexes.join(',')}]`
                        : ''}
                    </>
                  ) : null}
                </div>

                <div style={line}>
                  {t.demo6PoolIfOff}{' '}
                  <b style={{ color: '#e8e8e8' }}>
                    {ramView.withoutPreload != null ? formatBytes(ramView.withoutPreload) : '—'}
                  </b>
                </div>
                <div style={{ ...line, color: '#6dcea0', marginBottom: 6 }}>
                  {t.demo6PoolExtra}{' '}
                  <b>
                    {slotsOn
                      ? ramView.extra != null
                        ? formatBytes(ramView.extra)
                        : '—'
                      : formatBytes(0)}
                  </b>
                </div>

                <div style={{ ...line, color: '#666', fontSize: 10 }}>
                  {t.demo6PoolCap} {formatBytes(autoCacheBudgetBytes)}
                </div>
                <div style={{ ...diagnosticLine, color: '#aab2c3', fontSize: 10 }}>
                  viewport{' '}
                  {lodPlan
                    ? `${Math.round(lodPlan.viewport.cssWidth)}×${Math.round(lodPlan.viewport.cssHeight)} CSS · DPR ${lodPlan.viewport.dpr.toFixed(2)} · ${lodPlan.viewport.pixelWidth}×${lodPlan.viewport.pixelHeight} px`
                    : '—'}
                </div>
                <div style={{ ...diagnosticLine, color: '#6ea8ff', fontSize: 10 }}>
                  Screen LOD · next {screenPlan.next.length} [{screenPlan.next.join(', ')}]
                  {' · '}prev {screenPlan.prev.length} [{screenPlan.prev.join(', ')}]
                </div>
                <div style={{ ...diagnosticLine, color: '#c084fc', fontSize: 10 }}>
                  Browse LOD · next {browsePlan.next.length} [{browsePlan.next.join(', ')}]
                  {' · '}prev {browsePlan.prev.length} [{browsePlan.prev.join(', ')}]
                </div>
              </div>

              {/* ── Last nav ── */}
              <div
                style={{
                  padding: '10px 10px',
                  borderRadius: 8,
                  background: 'rgba(0,0,0,0.35)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  minHeight: 118,
                  boxSizing: 'border-box',
                  ...mono,
                }}
              >
                <div
                  style={{ color: '#9aa3b5', marginBottom: 6, cursor: 'help' }}
                  title={t.demo6MeterHint}
                >
                  {t.demo6MeterTitle}
                </div>
                <div style={{ height: 16 }}>
                  index <b style={{ color: '#e8e8e8' }}>{index}</b>
                </div>
                <div
                  style={{
                    height: 16,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  prev <b style={{ color: '#e8e8e8' }}>{String(prevPhase)}</b>
                  {' · '}here <b style={{ color: '#e8e8e8' }}>{String(currentPhase)}</b>
                  {' · '}next <b style={{ color: '#e8e8e8' }}>{String(nextPhase)}</b>
                </div>
                <div style={{ marginTop: 8, minHeight: 48 }}>
                  {lastTiming ? (
                    <>
                      <div>
                        path{' '}
                        <b
                          style={{
                            color: lastTiming.path === 'fast-reveal' ? '#6dcea0' : '#e0b35a',
                          }}
                        >
                          {lastTiming.path}
                        </b>
                      </div>
                      <div>
                        underlay{' '}
                        <b style={{ color: '#e8e8e8' }}>
                          {lastTiming.underlayMs == null ? '—' : `${lastTiming.underlayMs} ms`}
                        </b>
                      </div>
                      <div>
                        sharp <b style={{ color: '#e8e8e8' }}>{lastTiming.sharpMs} ms</b>
                      </div>
                    </>
                  ) : (
                    <div style={{ color: '#666' }}>{t.demo6MeterIdle}</div>
                  )}
                </div>
              </div>

              <div style={{ marginTop: 12 }}>
                <div style={{ color: '#9aa3b5', marginBottom: 4, fontSize: 11 }}>
                  {t.demo6HistoryTitle}
                </div>
                <ul
                  style={{
                    margin: 0,
                    padding: 0,
                    listStyle: 'none',
                    height: DEMO6_HISTORY_MAX_H,
                    overflowY: 'auto',
                    overflowX: 'hidden',
                  }}
                >
                  {history.length === 0 ? (
                    <li style={{ ...mono, fontSize: 10, color: '#555' }}>—</li>
                  ) : (
                    history.map((row, i) => (
                      <li
                        key={`${row.index}-${row.sharpMs}-${i}`}
                        style={{
                          ...mono,
                          fontSize: 10,
                          color: '#a8b0c0',
                          marginBottom: 4,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        #{row.index}{' '}
                        <span style={{ color: row.path === 'fast-reveal' ? '#6dcea0' : '#e0b35a' }}>
                          {row.path === 'fast-reveal' ? 'fast' : 'cold'}
                        </span>{' '}
                        u={row.underlayMs ?? '—'}ms → s={row.sharpMs}ms
                      </li>
                    ))
                  )}
                </ul>
              </div>
            </aside>

            <div
              style={{
                position: 'relative',
                flex: '1 1 auto',
                width: 0,
                minWidth: 0,
                height: '100%',
                overflow: 'hidden',
              }}
            >
              {open ? (
                <ImagePreview
                  presentation="contained"
                  images={images}
                  visible
                  index={index}
                  onIndexChange={beginNav}
                  preloadRadius={slotsOn ? 'auto' : 0}
                  onPreloadStatusChange={setPreloadStatus}
                  onRasterPreloadPlanChange={setLodPlan}
                  onMainImageLoadStageChange={onStage}
                  progressiveMain
                  showThumbnails
                  showThumbnailPreloadStatus
                  thumbnailsScope="flat"
                  chrome="minimal"
                  showFlip={false}
                  arrows="side"
                  closeOnMaskClick={false}
                  wheelEnabled
                  doubleClickEnabled
                  language={previewLanguage}
                  overlayStyle={{
                    borderRadius: 0,
                    zIndex: 1,
                    position: 'absolute',
                    inset: 0,
                    width: '100%',
                    height: '100%',
                  }}
                  onClose={() => setOpen(false)}
                />
              ) : (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'absolute',
                    inset: 0,
                    color: '#666',
                    fontSize: 14,
                  }}
                >
                  {t.demo5EmptyWorkspace}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
