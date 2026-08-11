import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Demo0TriggerMode } from './demos/Demo0TriggerMode';
import { Demo1SingleGallery } from './demos/Demo1SingleGallery';
import { Demo2FolderGroups } from './demos/Demo2FolderGroups';
import { Demo3HighRes } from './demos/Demo3HighRes';
import { Demo4Exif } from './demos/Demo4Exif';
import {
  DEMO_LANG_STORAGE_KEY,
  DEMO_REPO_URL,
  readInitialLocale,
  STRINGS,
  type DemoLocale,
} from './demos/demoLocale';
import { codeBlockStyle, dividerStyle, featureCardStyle, featureGridStyle } from './demos/demoStyles';
import { LangSwitch } from './demos/shared';

const DEMO_ASSET_BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

/** File pixel widths of `public/demo/demo-viewer-*.jpg` (often @2x captures). */
const DEMO_VIEWER_SHOT_INTRINSIC_W = {
  flatList: 980,
  groupedToolbar: 1316,
  minimap: 358,
} as const;

const demoScreenshotFigureStyle: CSSProperties = {
  margin: 0,
  width: 'fit-content',
  maxWidth: '100%',
};

const demoScreenshotImgBaseStyle: CSSProperties = {
  display: 'block',
  height: 'auto',
  borderRadius: 12,
  border: '1px solid rgba(255,255,255,0.1)',
  boxShadow: '0 12px 40px rgba(0,0,0,0.45)',
};

/** Layout at half intrinsic width (1× UI size for Retina screenshots); still shrinks on narrow viewports. */
function demoScreenshotStyle(intrinsicWidthPx: number): CSSProperties {
  const layoutW = Math.round(intrinsicWidthPx / 2);
  return {
    ...demoScreenshotImgBaseStyle,
    width: `min(100%, ${layoutW}px)`,
  };
}

export default function App() {
  const [locale, setLocale] = useState<DemoLocale>(readInitialLocale);
  const t = STRINGS[locale];
  const previewLanguage = locale === 'zh' ? 'zh-CN' : 'en';
  const demo1LaunchRef = useRef<(index?: number) => void>(() => {});

  useEffect(() => {
    document.documentElement.lang = locale === 'zh' ? 'zh-CN' : 'en';
    document.title =
      locale === 'zh'
        ? 'right-image-preview · 全屏图片查看器演示'
        : 'right-image-preview · full-featured image viewer demo';
    try {
      localStorage.setItem(DEMO_LANG_STORAGE_KEY, locale);
    } catch {
      /* ignore */
    }
  }, [locale]);

  return (
    <div
      style={{
        position: 'relative',
        minHeight: '100vh',
        background: 'radial-gradient(1200px 600px at 50% -20%, rgba(88,101,242,0.12), transparent 55%), #0f1117',
        color: '#e8e8e8',
        fontFamily: '"Inter", "PingFang SC", system-ui, sans-serif',
        padding: '36px 28px 56px',
        maxWidth: 1080,
        margin: '0 auto',
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 28,
          right: 28,
          zIndex: 2,
        }}
      >
        <LangSwitch locale={locale} onChange={setLocale} t={t} />
      </div>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <header
        style={{
          textAlign: 'center',
          padding: '28px 12px 40px',
          maxWidth: 720,
          margin: '0 auto',
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: 'rgba(136,153,200,0.85)',
          }}
        >
          {t.title}
        </p>
        <h1
          style={{
            margin: '14px 0 0',
            fontSize: 'clamp(1.45rem, 3.5vw, 2rem)',
            fontWeight: 700,
            lineHeight: 1.25,
            color: '#f2f4fb',
          }}
        >
          {t.heroTagline}
        </h1>
        <p
          style={{
            margin: '16px 0 0',
            fontSize: 15,
            lineHeight: 1.65,
            color: 'rgba(180,190,215,0.88)',
          }}
        >
          {t.heroLead}
        </p>
        <div
          style={{
            marginTop: 28,
            display: 'flex',
            flexWrap: 'wrap',
            gap: 12,
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <button
            type="button"
            onClick={() => demo1LaunchRef.current(0)}
            style={{
              padding: '12px 22px',
              borderRadius: 10,
              border: 'none',
              background: 'linear-gradient(180deg, #6b7cff 0%, #5865f2 100%)',
              color: '#fff',
              fontSize: 15,
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 8px 24px rgba(88,101,242,0.35)',
            }}
          >
            {t.heroCtaTry}
          </button>
          <a
            href={DEMO_REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              padding: '12px 22px',
              borderRadius: 10,
              border: '1px solid rgba(255,255,255,0.2)',
              background: 'rgba(18,21,30,0.6)',
              color: '#c8d0e8',
              fontSize: 15,
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            {t.heroCtaGitHub}
          </a>
        </div>
        <p style={{ margin: '18px 0 0', fontSize: 13, color: '#666' }}>{t.heroCtaScroll}</p>
      </header>

      {/* ── Features ─────────────────────────────────────────────────────── */}
      <section style={{ marginBottom: 44 }}>
        <h2 style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#888', margin: '0 0 18px' }}>
          {t.featuresTitle}
        </h2>
        <div style={featureGridStyle}>
          {t.features.map((f) => (
            <div key={f.title} style={featureCardStyle}>
              <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 650, color: '#e4e8f4' }}>{f.title}</h3>
              <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: 'rgba(160,170,195,0.92)' }}>{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Screenshots (core UI) ─────────────────────────────────────────── */}
      <section style={{ marginBottom: 44 }}>
        <h2 style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#888', margin: '0 0 10px' }}>
          {t.screenshotsTitle}
        </h2>
        <p style={{ margin: '0 0 20px', fontSize: 14, color: 'rgba(160,170,195,0.92)', lineHeight: 1.6, maxWidth: 720 }}>
          {t.screenshotsLead}
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
          <figure style={demoScreenshotFigureStyle}>
            <img
              src={`${DEMO_ASSET_BASE}/demo/demo-viewer-toolbar-flat-list.jpg`}
              alt={t.screenshotToolbarFlatAlt}
              style={demoScreenshotStyle(DEMO_VIEWER_SHOT_INTRINSIC_W.flatList)}
              loading="lazy"
              decoding="async"
            />
            <figcaption style={{ margin: '12px 0 0', fontSize: 13, color: '#777', lineHeight: 1.55 }}>
              {t.screenshotToolbarFlatCaption}
            </figcaption>
          </figure>
          <figure style={demoScreenshotFigureStyle}>
            <img
              src={`${DEMO_ASSET_BASE}/demo/demo-viewer-toolbar.jpg`}
              alt={t.screenshotToolbarAlt}
              style={demoScreenshotStyle(DEMO_VIEWER_SHOT_INTRINSIC_W.groupedToolbar)}
              loading="lazy"
              decoding="async"
            />
            <figcaption style={{ margin: '12px 0 0', fontSize: 13, color: '#777', lineHeight: 1.55 }}>
              {t.screenshotToolbarCaption}
            </figcaption>
          </figure>
          <figure style={demoScreenshotFigureStyle}>
            <img
              src={`${DEMO_ASSET_BASE}/demo/demo-viewer-minimap.jpg`}
              alt={t.screenshotMinimapAlt}
              style={demoScreenshotStyle(DEMO_VIEWER_SHOT_INTRINSIC_W.minimap)}
              loading="lazy"
              decoding="async"
            />
            <figcaption style={{ margin: '12px 0 0', fontSize: 13, color: '#777', lineHeight: 1.55 }}>
              {t.screenshotMinimapCaption}
            </figcaption>
          </figure>
        </div>
      </section>

      {/* ── Operations ─────────────────────────────────────────────────────── */}
      <section style={{ marginBottom: 44 }}>
        <h2 style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#888', margin: '0 0 16px' }}>
          {t.opsTitle}
        </h2>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            maxWidth: 560,
          }}
        >
          {t.opsRows.map(([key, desc]) => (
            <div
              key={key + desc}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 12,
                background: 'rgba(22,24,34,0.85)',
                borderRadius: 8,
                padding: '8px 12px',
                border: '1px solid rgba(255,255,255,0.06)',
              }}
            >
              <span
                style={{
                  flex: '0 0 auto',
                  minWidth: 120,
                  fontSize: 12,
                  fontWeight: 600,
                  color: '#9db0d8',
                }}
              >
                {key}
              </span>
              <span style={{ fontSize: 13, color: '#777', lineHeight: 1.5 }}>{desc}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── Usage ─────────────────────────────────────────────────────────── */}
      <section style={{ marginBottom: 48 }}>
        <h2 style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#888', margin: '0 0 10px' }}>
          {t.usageTitle}
        </h2>
        <p style={{ margin: 0, fontSize: 14, color: '#888' }}>{t.usageLead}</p>
        <pre style={codeBlockStyle}>{t.usageNpm}</pre>
        <p style={{ margin: '12px 0 0', fontSize: 13, color: '#666', lineHeight: 1.55 }}>
          {t.usageDocHint}{' '}
          <a href={DEMO_REPO_URL} style={{ color: '#8fa8ff' }}>
            {DEMO_REPO_URL.replace('https://', '')}
          </a>
        </p>
      </section>

      {/* ── Live demo: Demo 0 trigger, then Demo 1 … ─────────────────────── */}
      <section style={{ marginBottom: 8 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 6px', color: '#eaeef8' }}>{t.liveDemoTitle}</h2>
        <p style={{ margin: 0, fontSize: 14, color: '#888', lineHeight: 1.55 }}>{t.liveDemoSubtitle}</p>
      </section>

      <Demo0TriggerMode t={t} previewLanguage={previewLanguage} />

      <hr style={dividerStyle} />

      <Demo1SingleGallery t={t} previewLanguage={previewLanguage} launchRef={demo1LaunchRef} />

      <hr style={dividerStyle} />

      <div id="more-demos" style={{ scrollMarginTop: 24 }} />

      {/* Demo 2: `groupedImages` folders, classic strip (current group only), side arrows, flip, etc. */}
      <Demo2FolderGroups t={t} locale={locale} previewLanguage={previewLanguage} />

      <hr style={dividerStyle} />

      {/* Demo 3: full `src` + `minimapSrc` from COS; progressive load */}
      <Demo3HighRes t={t} locale={locale} previewLanguage={previewLanguage} />

      <hr style={dividerStyle} />

      {/* Demo 4: host-provided ImageItem.exif + toolbar toggle panel */}
      <Demo4Exif t={t} previewLanguage={previewLanguage} />
    </div>
  );
}
