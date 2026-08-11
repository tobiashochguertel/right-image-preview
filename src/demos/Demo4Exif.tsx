import { useCallback, useState } from 'react';
import { ImagePreview } from '../components/ImagePreview';
import type { ImageItem } from '../components/ImagePreview';
import { gridStyle, sectionDescStyle, sectionHeadStyle } from './demoStyles';
import type { DemoStrings } from './demoLocale';
import { ThumbCard } from './shared';

/**
 * Mock EXIF as if a desktop host (Node / Python / Rust) had parsed local files
 * and attached metadata to each {@link ImageItem}.
 */
const INITIAL_EXIF_GALLERY: ImageItem[] = [
  {
    id: 'exif-fuji-lake',
    src: 'https://picsum.photos/seed/exif-fuji/2400/1600',
    alt: '湖边晨雾',
    name: 'DSCF4821.RAF',
    exif: {
      fileName: 'DSCF4821.RAF',
      fileSize: '48.2 MB',
      mimeType: 'image/x-fuji-raf',
      width: 6240,
      height: 4160,
      colorSpace: 'Adobe RGB',
      orientation: 1,
      make: 'FUJIFILM',
      model: 'X-T5',
      lens: 'XF33mmF1.4 R LM WR',
      software: 'Adobe Lightroom Classic 13.2',
      dateTimeOriginal: '2024-10-12 06:48:22',
      dateTimeDigitized: '2024-10-12 06:48:22',
      exposureTime: '1/250',
      fNumber: 'f/2.0',
      iso: 160,
      focalLength: '33 mm',
      focalLength35mm: '50 mm',
      exposureProgram: 'Aperture priority',
      meteringMode: 'Multi-segment',
      flash: 'Off',
      whiteBalance: 'Auto',
      exposureBias: '−0.3 EV',
      gpsLatitude: '35.3606° N',
      gpsLongitude: '138.7274° E',
      gpsAltitude: '3772 m',
      extra: [
        { key: 'filmSimulation', label: 'Film simulation', value: 'Astia / Soft', group: 'camera' },
        { key: 'copyright', label: 'Copyright', value: '© Demo Photographer', group: 'other' },
      ],
    },
  },
  {
    id: 'exif-phone-street',
    src: 'https://picsum.photos/seed/exif-phone/1600/2000',
    alt: '街景手机照',
    name: 'IMG_2048.HEIC',
    exif: {
      fileName: 'IMG_2048.HEIC',
      fileSize: '3.1 MB',
      mimeType: 'image/heic',
      width: 4032,
      height: 3024,
      make: 'Apple',
      model: 'iPhone 15 Pro',
      lens: 'iPhone 15 Pro back triple camera 6.86mm f/1.78',
      software: '17.5.1',
      dateTimeOriginal: '2025-03-01 18:22:09',
      exposureTime: '1/120',
      fNumber: 'f/1.8',
      iso: 200,
      focalLength: '6.86 mm',
      focalLength35mm: '24 mm',
      flash: 'Off',
      whiteBalance: 'Auto',
      extra: [{ key: 'hdr', label: 'HDR', value: true, group: 'exposure' }],
    },
  },
  {
    id: 'exif-empty',
    src: 'https://picsum.photos/seed/exif-empty/1800/1200',
    alt: '无元数据示意图',
    name: 'screenshot-export.png',
  },
];

export function Demo4Exif({
  t,
  previewLanguage,
}: {
  t: DemoStrings;
  previewLanguage: string;
}) {
  const [images, setImages] = useState<ImageItem[]>(INITIAL_EXIF_GALLERY);
  const [visible, setVisible] = useState(false);
  const [index, setIndex] = useState(0);

  const open = useCallback((i = 0) => {
    setIndex(i);
    setVisible(true);
  }, []);

  const handleDelete = useCallback((index: number, item: ImageItem) => {
    setImages((prev) => {
      if (item.id != null) return prev.filter((img) => img.id !== item.id);
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  return (
    <>
      <section>
        <h2 style={sectionHeadStyle}>{t.demo4Title}</h2>
        <p style={sectionDescStyle}>{t.demo4Desc}</p>
        <div style={gridStyle}>
          {images.map((img, i) => (
            <ThumbCard
              key={img.id ?? img.src}
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
        images={images}
        visible={visible && images.length > 0}
        defaultIndex={Math.min(index, Math.max(0, images.length - 1))}
        initialMode="fit"
        showExif
        initialExifOpen
        showDelete
        onDeleteImage={handleDelete}
        arrows="both"
        closeOnMaskClick
        wheelEnabled
        doubleClickEnabled
        thumbnails="classic"
        language={previewLanguage}
        onClose={() => setVisible(false)}
      />
    </>
  );
}
