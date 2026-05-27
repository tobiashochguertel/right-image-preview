import { useCallback, useEffect, useState, type MutableRefObject } from 'react';
import { ImagePreview } from '../components/ImagePreview';
import type { ImageItem } from '../components/ImagePreview';
import { gridStyle, sectionDescStyle, sectionHeadStyle } from './demoStyles';
import type { DemoStrings } from './demoLocale';
import { ThumbCard } from './shared';

const SINGLE_GALLERY: ImageItem[] = [
  { src: 'https://picsum.photos/seed/sg-mtn/1920/1280', alt: '山间云雾', name: 'mountain-mist.jpg' },
  {
    src: 'https://picsum.photos/seed/sg-fst/1280/1920',
    alt: '竖幅树林',
    name: 'forest-portrait-this-is-a-very-very-long-long-file-name-so-that-it-can-be-tested-with-a-very-long-file-name.jpg',
  },
  { src: 'https://picsum.photos/seed/sg-cst/2400/1600', alt: '海岸线', name: 'coastline.jpg' },
  { src: 'https://picsum.photos/seed/sg-town/1600/1200', alt: '古镇街道', name: 'old-town.jpg' },
  { src: 'https://picsum.photos/seed/sg-sun/3000/2000', alt: '草原日落', name: 'grassland-sunset.jpg' },
];

export function Demo1SingleGallery({
  t,
  previewLanguage,
  launchRef,
}: {
  t: DemoStrings;
  previewLanguage: string;
  /** Filled with a function that opens this demo (optional index). Used by the hero “Try” CTA. */
  launchRef?: MutableRefObject<(index?: number) => void>;
}) {
  const [visible, setVisible] = useState(false);
  const [index, setIndex] = useState(0);

  const open = useCallback((i = 0) => {
    setIndex(i);
    setVisible(true);
  }, []);

  useEffect(() => {
    if (!launchRef) return;
    launchRef.current = open;
    return () => {
      launchRef.current = () => {};
    };
  }, [launchRef, open]);

  return (
    <>
      <section id="live-demo">
        <h2 style={sectionHeadStyle}>{t.demo1Title}</h2>
        <p style={sectionDescStyle}>{t.demo1Desc}</p>
        <div style={gridStyle}>
          {SINGLE_GALLERY.map((img, i) => (
            <ThumbCard
              key={img.src}
              src={img.src}
              alt={img.alt ?? ''}
              label={img.name ?? img.alt ?? ''}
              ariaLabel={t.thumbAria(img.name ?? img.alt ?? '')}
              clickHint={t.thumbClickHint}
              onClick={() => open(i)}
            />
          ))}
        </div>
      </section>

      <ImagePreview
        images={SINGLE_GALLERY}
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
