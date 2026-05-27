/**
 * Demo 3: full `src` and progressive `minimapSrc` URLs on Tencent COS (Singapore).
 *
 * Originals and license: Wikimedia Commons (see `commonsPage` below).
 *
 * @see https://commons.wikimedia.org/wiki/File:ESO_-_The_Carina_Nebula_(by).jpg — ESO
 * @see https://commons.wikimedia.org/wiki/File:The_North_America_Nebula.jpg — Martin Pugh et al.
 */
const COS_BASE =
  'https://public-img-1253867148.cos.ap-singapore.myqcloud.com/img-in-projects/right-image-viewers';

export const DEMO_HIGH_RES_IMAGES = {
  carinaNebulaESO: {
    src: `${COS_BASE}/ESO_-_The_Carina_Nebula_%28by%29.jpg`,
    minimapSrc: `${COS_BASE}/carina-nebula-thumb.jpg`,
    commonsPage: 'https://commons.wikimedia.org/wiki/File:ESO_-_The_Carina_Nebula_(by).jpg',
    approxBytes: 12_246_989,
  },
  northAmericaNebula: {
    src: `${COS_BASE}/The_North_America_Nebula.jpg`,
    minimapSrc: `${COS_BASE}/north-america-nebula-thumb.jpg`,
    commonsPage: 'https://commons.wikimedia.org/wiki/File:The_North_America_Nebula.jpg',
    approxBytes: 16_394_595,
  },
} as const;

export function demoApproxMbLabel(bytes: number, locale: 'en' | 'zh'): string {
  const mb = bytes / (1024 * 1024);
  const r = Math.round(mb * 10) / 10;
  const s = Number.isInteger(r) ? `${r}` : r.toFixed(1);
  return locale === 'zh' ? `（约 ${s} MB）` : ` (~${s} MB)`;
}
