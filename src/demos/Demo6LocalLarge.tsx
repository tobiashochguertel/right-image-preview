import { useEffect, useRef, useState } from 'react';
import { ImagePreview } from '../components/ImagePreview';
import type {
  ImageItem,
  MainImageLoadStage,
  NeighborPreloadStatusMap,
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

type NavPath = 'fast-reveal' | 'cold';

interface NavTiming {
  index: number;
  path: NavPath;
  /** ms from navigate → thumbnail underlay stage */
  underlayMs: number | null;
  /** ms from navigate → sharp main (`full-ready`) */
  sharpMs: number;
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
  const [lastTiming, setLastTiming] = useState<NavTiming | null>(null);
  const [history, setHistory] = useState<NavTiming[]>([]);

  const navStartRef = useRef(0);
  const underlayAtRef = useRef<number | null>(null);
  const pathForNavRef = useRef<NavPath>('cold');
  const indexRef = useRef(0);
  const statusRef = useRef(preloadStatus);
  statusRef.current = preloadStatus;

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

  const beginNav = (nextIndex: number) => {
    indexRef.current = nextIndex;
    setIndex(nextIndex);
    navStartRef.current = performance.now();
    underlayAtRef.current = null;
    const phase = statusRef.current[nextIndex]?.phase;
    pathForNavRef.current = phase === 'display-ready' ? 'fast-reveal' : 'cold';
    setLastTiming(null);
  };

  const onStage = (stage: MainImageLoadStage) => {
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
  };

  if (!import.meta.env.DEV) {
    return null;
  }

  const currentPhase = preloadStatus[index]?.phase ?? '—';

  return (
    <section>
      <h2 style={sectionHeadStyle}>{t.demo6Title}</h2>
      <p style={sectionDescStyle}>{t.demo6Desc}</p>

      {available === false && (
        <p style={{ ...sectionDescStyle, color: '#e8a0a0' }}>{t.demo6Missing}</p>
      )}

      {available === true && images.length > 0 && (
        <>
          <div style={gridStyle}>
            {images.slice(0, 8).map((img, i) => (
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
              borderRadius: 12,
              overflow: 'hidden',
              border: '1px solid rgba(255,255,255,0.1)',
              minHeight: 480,
              background: 'rgba(12,14,22,0.9)',
            }}
          >
            <aside
              style={{
                width: 220,
                flexShrink: 0,
                padding: '14px 12px',
                background: 'rgba(18,22,34,0.95)',
                borderRight: '1px solid rgba(255,255,255,0.08)',
                fontSize: 12,
                color: 'rgba(180,190,215,0.9)',
                lineHeight: 1.45,
                overflow: 'auto',
              }}
            >
              <div style={{ fontWeight: 650, marginBottom: 8, color: '#e4e8f4', fontSize: 13 }}>
                {t.demo6SidebarTitle}
              </div>
              <p style={{ margin: '0 0 10px', color: '#888' }}>{t.demo6HowTo}</p>

              <label
                style={{
                  display: 'flex',
                  gap: 8,
                  alignItems: 'flex-start',
                  marginBottom: 12,
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
                  }}
                  style={{ marginTop: 2 }}
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

              <div
                style={{
                  padding: '10px 10px',
                  borderRadius: 8,
                  background: 'rgba(0,0,0,0.35)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                  fontSize: 11,
                }}
              >
                <div style={{ color: '#9aa3b5', marginBottom: 6 }}>{t.demo6MeterTitle}</div>
                <div>
                  index <b style={{ color: '#e8e8e8' }}>{index}</b> · strip{' '}
                  <b style={{ color: '#e8e8e8' }}>{String(currentPhase)}</b>
                </div>
                {lastTiming ? (
                  <>
                    <div style={{ marginTop: 8 }}>
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
                      sharp{' '}
                      <b style={{ color: '#e8e8e8' }}>{lastTiming.sharpMs} ms</b>
                    </div>
                  </>
                ) : (
                  <div style={{ marginTop: 8, color: '#666' }}>{t.demo6MeterIdle}</div>
                )}
              </div>

              <p style={{ margin: '10px 0 0', color: '#6a7388', fontSize: 11 }}>{t.demo6MeterHint}</p>

              {history.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <div style={{ color: '#9aa3b5', marginBottom: 4, fontSize: 11 }}>
                    {t.demo6HistoryTitle}
                  </div>
                  <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                    {history.map((row, i) => (
                      <li
                        key={`${row.index}-${row.sharpMs}-${i}`}
                        style={{
                          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                          fontSize: 10,
                          color: '#a8b0c0',
                          marginBottom: 4,
                        }}
                      >
                        #{row.index}{' '}
                        <span style={{ color: row.path === 'fast-reveal' ? '#6dcea0' : '#e0b35a' }}>
                          {row.path === 'fast-reveal' ? 'fast' : 'cold'}
                        </span>{' '}
                        u={row.underlayMs ?? '—'}ms → s={row.sharpMs}ms
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </aside>

            <div style={{ position: 'relative', flex: 1, minWidth: 0, minHeight: 480 }}>
              {open ? (
                <ImagePreview
                  presentation="contained"
                  images={images}
                  visible
                  index={index}
                  onIndexChange={beginNav}
                  preloadRadius={2}
                  preloadDisplaySlots={slotsOn ? 2 : 0}
                  preloadMemoryBudgetBytes={slotsOn ? 256 * 1024 * 1024 : undefined}
                  onPreloadStatusChange={setPreloadStatus}
                  onMainImageLoadStageChange={onStage}
                  progressiveMain
                  progressivePlaceholderMinMs={800}
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
                  overlayStyle={{ borderRadius: 0, zIndex: 1 }}
                  onClose={() => setOpen(false)}
                />
              ) : (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '100%',
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
