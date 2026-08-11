import { useState } from 'react';
import { ImagePreview } from '../components/ImagePreview';
import type { ImageItem } from '../components/ImagePreview';
import { gridStyle, sectionDescStyle, sectionHeadStyle } from './demoStyles';
import type { DemoStrings } from './demoLocale';
import { ThumbCard } from './shared';

const CONTAINED_GALLERY: ImageItem[] = [
  {
    src: 'https://picsum.photos/seed/emb-a/1600/1066',
    minimapSrc: 'https://picsum.photos/seed/emb-a/240/160',
    alt: 'Embedded A',
    name: 'embedded-a.jpg',
  },
  {
    src: 'https://picsum.photos/seed/emb-b/1600/1066',
    minimapSrc: 'https://picsum.photos/seed/emb-b/240/160',
    alt: 'Embedded B',
    name: 'embedded-b.jpg',
  },
  {
    src: 'https://picsum.photos/seed/emb-c/1600/1066',
    minimapSrc: 'https://picsum.photos/seed/emb-c/240/160',
    alt: 'Embedded C',
    name: 'embedded-c.jpg',
  },
  {
    src: 'https://picsum.photos/seed/emb-d/1600/1066',
    minimapSrc: 'https://picsum.photos/seed/emb-d/240/160',
    alt: 'Embedded D',
    name: 'embedded-d.jpg',
  },
  {
    src: 'https://picsum.photos/seed/emb-e/1600/1066',
    minimapSrc: 'https://picsum.photos/seed/emb-e/240/160',
    alt: 'Embedded E',
    name: 'embedded-e.jpg',
  },
];

export function Demo5ContainedWorkspace({
  t,
  previewLanguage,
}: {
  t: DemoStrings;
  previewLanguage: string;
}) {
  const [index, setIndex] = useState(0);
  const [open, setOpen] = useState(true);
  const [preloadLog, setPreloadLog] = useState<number[]>([]);

  return (
    <section>
      <h2 style={sectionHeadStyle}>{t.demo5Title}</h2>
      <p style={sectionDescStyle}>{t.demo5Desc}</p>

      <div style={gridStyle}>
        {CONTAINED_GALLERY.map((img, i) => (
          <ThumbCard
            key={img.src}
            src={img.minimapSrc ?? img.src}
            alt={img.alt ?? ''}
            label={img.name ?? img.alt ?? ''}
            ariaLabel={t.thumbAria(img.name ?? img.alt ?? '')}
            clickHint={t.thumbClickHint}
            onClick={() => {
              setIndex(i);
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
          minHeight: 420,
          background: 'rgba(12,14,22,0.9)',
        }}
      >
        <aside
          style={{
            width: 148,
            flexShrink: 0,
            padding: '14px 12px',
            background: 'rgba(18,22,34,0.95)',
            borderRight: '1px solid rgba(255,255,255,0.08)',
            fontSize: 13,
            color: 'rgba(180,190,215,0.9)',
          }}
        >
          <div style={{ fontWeight: 650, marginBottom: 10, color: '#e4e8f4' }}>
            {t.demo5SidebarTitle}
          </div>
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
            }}
          >
            {open ? t.demo5HidePreview : t.demo5ShowPreview}
          </button>
          {preloadLog.length > 0 && (
            <p style={{ margin: '12px 0 0', fontSize: 11, color: '#888', lineHeight: 1.45 }}>
              {t.demo5PreloadHint}: [{preloadLog.join(', ')}]
            </p>
          )}
        </aside>

        <div style={{ position: 'relative', flex: 1, minWidth: 0, minHeight: 420 }}>
          {open ? (
            <ImagePreview
              presentation="contained"
              images={CONTAINED_GALLERY}
              visible
              index={index}
              onIndexChange={setIndex}
              preloadRadius={1}
              onPreloadIndexesChange={setPreloadLog}
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
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#666',
                fontSize: 14,
              }}
            >
              {t.demo5EmptyWorkspace}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
