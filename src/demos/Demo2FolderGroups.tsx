import { useMemo, useState } from 'react';
import { ImagePreview } from '../components/ImagePreview';
import type { ImageGroup, ImageItem } from '../components/ImagePreview';
import { gridStyle, sectionDescStyle, sectionHeadStyle } from './demoStyles';
import type { DemoLocale, DemoStrings } from './demoLocale';
import { ThumbCard } from './shared';

const CITY_IMAGES: ImageItem[] = [
  { src: 'https://picsum.photos/seed/city-bld/1600/1000', alt: '现代楼群', name: 'buildings-01.jpg' },
  { src: 'https://picsum.photos/seed/city-sky/2000/1200', alt: '夜间天际线', name: 'skyline-night.jpg' },
  { src: 'https://picsum.photos/seed/city-aly/800/1200', alt: '街道小巷', name: 'alley.jpg' },
];

const NATURE_IMAGES: ImageItem[] = [
  { src: 'https://picsum.photos/seed/nat-vly/2400/1600', alt: '山谷晨雾', name: 'valley-mist.jpg' },
  { src: 'https://picsum.photos/seed/nat-wfl/1800/1200', alt: '瀑布', name: 'waterfall.jpg' },
  { src: 'https://picsum.photos/seed/nat-fld/3200/2000', alt: '花田', name: 'flower-field.jpg' },
];

const OCEAN_IMAGES: ImageItem[] = [
  { src: 'https://picsum.photos/seed/sea-wide/3000/1500', alt: '海天一色', name: 'ocean-wide.jpg' },
  { src: 'https://picsum.photos/seed/sea-rock/1200/1600', alt: '礁石近景（竖）', name: 'rocks-close.jpg' },
  { src: 'https://picsum.photos/seed/sea-bch/2000/1400', alt: '沙滩', name: 'beach.jpg' },
  { src: 'https://picsum.photos/seed/sea-fs/1600/1000', alt: '渔船日落', name: 'fishing-sunset.jpg' },
];

interface FolderGroup {
  name: string;
  images: ImageItem[];
}

const FOLDER_GROUP_NAMES: Record<DemoLocale, [string, string, string]> = {
  zh: ['🏙 城市建筑', '🌿 自然风光', '🌊 海洋沙滩'],
  en: ['🏙 City', '🌿 Nature', '🌊 Ocean & beach'],
};

function buildFolderData(locale: DemoLocale): { folderGroups: FolderGroup[]; groupedImages: ImageGroup[] } {
  const names = FOLDER_GROUP_NAMES[locale];
  const folderGroups: FolderGroup[] = [
    { name: names[0], images: CITY_IMAGES },
    { name: names[1], images: NATURE_IMAGES },
    { name: names[2], images: OCEAN_IMAGES },
  ];
  const groupedImages: ImageGroup[] = folderGroups.map((g) => ({
    name: g.name,
    images: g.images,
  }));
  return { folderGroups, groupedImages };
}

export function Demo2FolderGroups({ t, locale, previewLanguage }: { t: DemoStrings; locale: DemoLocale; previewLanguage: string }) {
  const { folderGroups, groupedImages } = useMemo(() => buildFolderData(locale), [locale]);
  const [visible, setVisible] = useState(false);
  const [selection, setSelection] = useState({ defaultGroupIndex: 0, defaultIndexInGroup: 0 });

  const open = (folderIdx: number, imageIdxInFolder: number) => {
    setSelection({ defaultGroupIndex: folderIdx, defaultIndexInGroup: imageIdxInFolder });
    setVisible(true);
  };

  return (
    <>
      <section>
        <h2 style={sectionHeadStyle}>{t.demo2Title}</h2>
        <p style={sectionDescStyle}>{t.demo2Desc}</p>

        {folderGroups.map((group, gi) => (
          <div key={group.name} style={{ marginBottom: 28 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                marginBottom: 10,
              }}
            >
              <span style={{ fontSize: 15, fontWeight: 600 }}>{group.name}</span>
              <span
                style={{
                  fontSize: 12,
                  color: '#666',
                  background: '#1a1d27',
                  borderRadius: 20,
                  padding: '2px 8px',
                }}
              >
                {t.photosBadge(group.images.length)}
              </span>
            </div>
            <div style={gridStyle}>
              {group.images.map((img, ii) => (
                <ThumbCard
                  key={img.src}
                  src={img.src}
                  alt={img.alt ?? ''}
                  label={img.name ?? img.alt ?? ''}
                  ariaLabel={t.thumbAria(img.name ?? img.alt ?? '')}
                  clickHint={t.thumbClickHint}
                  onClick={() => open(gi, ii)}
                />
              ))}
            </div>
          </div>
        ))}
      </section>

      <ImagePreview
        groupedImages={groupedImages}
        visible={visible}
        defaultGroupedSelection={selection}
        initialMode="fit"
        firstZoomInStrategy="above-fit"
        zoomOutBelowMinBehaviour="noop"
        arrows="side"
        wheelEnabled
        doubleClickEnabled
        switchImageResetTransform
        showFlip
        language={previewLanguage}
        onClose={() => setVisible(false)}
      />
    </>
  );
}
