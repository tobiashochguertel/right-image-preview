import { useMemo, useState } from 'react';
import { ImagePreview } from '../components/ImagePreview';
import type { ImageItem } from '../components/ImagePreview';
import { gridStyle, sectionDescStyle, sectionHeadStyle } from './demoStyles';
import { DEMO_HIGH_RES_IMAGES, demoApproxMbLabel } from './demoHighResSources';
import type { DemoLocale, DemoStrings } from './demoLocale';
import { ThumbCard } from './shared';

type Demo3Item = ImageItem & { gridFallbackSrc: string };

function largeGallery(locale: DemoLocale): Demo3Item[] {
  const z = locale === 'zh';
  const loc = z ? 'zh' : 'en';
  const { carinaNebulaESO, northAmericaNebula } = DEMO_HIGH_RES_IMAGES;
  return [
    {
      src: carinaNebulaESO.src,
      minimapSrc: carinaNebulaESO.minimapSrc,
      gridFallbackSrc: carinaNebulaESO.gridFallbackSrc,
      alt: z ? '船底座大星云（ESO）' : 'Carina Nebula (ESO)',
      name: `${z ? '船底座大星云 · ESO' : 'Carina Nebula, ESO'}${demoApproxMbLabel(carinaNebulaESO.approxBytes, loc)}`,
    },
    {
      src: northAmericaNebula.src,
      minimapSrc: northAmericaNebula.minimapSrc,
      gridFallbackSrc: northAmericaNebula.gridFallbackSrc,
      alt: z ? '北美洲星云' : 'North America Nebula',
      name: `${z ? '北美洲星云' : 'North America Nebula'}${demoApproxMbLabel(northAmericaNebula.approxBytes, loc)}`,
    },
  ];
}

export function Demo3HighRes({ t, locale, previewLanguage }: { t: DemoStrings; locale: DemoLocale; previewLanguage: string }) {
  const items = useMemo(() => largeGallery(locale), [locale]);
  const [visible, setVisible] = useState(false);
  const [index, setIndex] = useState(0);

  return (
    <>
      <section>
        <h2 style={sectionHeadStyle}>{t.demo3Title}</h2>
        <p style={sectionDescStyle}>{t.demo3Desc}</p>
        <div style={gridStyle}>
          {items.map((img, idx) => (
            <ThumbCard
              key={img.src}
              src={img.minimapSrc ?? img.src}
              fallbackSrc={img.gridFallbackSrc}
              alt={img.alt ?? ''}
              label={img.name ?? img.alt ?? ''}
              ariaLabel={t.thumbAria(img.name ?? img.alt ?? '')}
              clickHint={t.thumbClickHint}
              onClick={() => {
                setIndex(idx);
                setVisible(true);
              }}
            />
          ))}
        </div>
      </section>

      <ImagePreview
        images={items}
        visible={visible}
        defaultIndex={index}
        initialMode="fit"
        firstZoomInStrategy="above-fit"
        zoomOutBelowMinBehaviour="noop"
        arrows="both"
        closeOnMaskClick
        wheelEnabled
        doubleClickEnabled
        switchImageResetTransform
        language={previewLanguage}
        onClose={() => setVisible(false)}
      />
    </>
  );
}
