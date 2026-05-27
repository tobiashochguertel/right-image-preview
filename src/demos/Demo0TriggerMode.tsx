import type { CSSProperties } from 'react';
import { ImagePreview } from '../components/ImagePreview';
import { gridStyle, sectionDescStyle, sectionHeadStyle } from './demoStyles';
import type { DemoStrings } from './demoLocale';

const FULL = 'https://picsum.photos/seed/demo0-full/1920/1280';
const THUMB = 'https://picsum.photos/seed/demo0-full/200/200';

const btnStyle: CSSProperties = {
  padding: '10px 18px',
  borderRadius: 9,
  border: '1px solid rgba(255,255,255,0.2)',
  background: 'rgba(88,101,242,0.25)',
  color: '#e8e8e8',
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
};

/**
 * Uncontrolled “trigger” mode: one child element opens the preview; `src` / `images` stay on
 * `ImagePreview` — the trigger can be a different small image, a button, or any single React element.
 */
export function Demo0TriggerMode({
  t,
  previewLanguage,
}: {
  t: DemoStrings;
  previewLanguage: string;
}) {
  return (
    <section>
      <h2 style={sectionHeadStyle}>{t.demo0Title}</h2>
      <p style={sectionDescStyle}>{t.demo0Desc}</p>
      <div style={gridStyle}>
        <ImagePreview
          images={[{ src: FULL, name: 'demo0-lakeside.jpg', alt: '' }]}
          initialMode="fit"
          firstZoomInStrategy="above-fit"
          zoomOutBelowMinBehaviour="noop"
          arrows="both"
          closeOnMaskClick
          wheelEnabled
          doubleClickEnabled
          switchImageResetTransform
          language={previewLanguage}
        >
          <img
            src={THUMB}
            alt=""
            width={120}
            height={120}
            style={{
              display: 'block',
              width: 120,
              height: 120,
              objectFit: 'cover',
              borderRadius: 10,
              border: '1px solid rgba(255,255,255,0.12)',
              cursor: 'pointer',
            }}
            loading="lazy"
            decoding="async"
          />
        </ImagePreview>

        <ImagePreview
          images={[{ src: FULL, name: 'demo0-lakeside.jpg', alt: '' }]}
          initialMode="fit"
          firstZoomInStrategy="above-fit"
          zoomOutBelowMinBehaviour="noop"
          arrows="both"
          closeOnMaskClick
          wheelEnabled
          doubleClickEnabled
          switchImageResetTransform
          language={previewLanguage}
        >
          <button type="button" style={btnStyle}>
            {t.demo0Button}
          </button>
        </ImagePreview>
      </div>
    </section>
  );
}
