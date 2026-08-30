/**
 * Demo 3: full `src` and progressive `minimapSrc` from Wikimedia Commons.
 *
 * The Raster pipeline loads these with `fetch` (Web Worker). The host must send
 * `Access-Control-Allow-Origin`. Wikimedia does; the previous Tencent COS copies
 * did not, so the overlay stayed blank while the grid `<img>` thumbs still loaded.
 *
 * North America Nebula’s 500px thumb 400s on some edges; the 1280px derivative
 * is the size that loads in the browser, so the overlay progressive layer uses
 * that instead of waiting on the 16 MB original.
 *
 * @see https://commons.wikimedia.org/wiki/File:ESO_-_The_Carina_Nebula_(by).jpg — ESO
 * @see https://commons.wikimedia.org/wiki/File:The_North_America_Nebula.jpg — Martin Pugh et al.
 */
import { wikiOriginal, wikiThumb } from './wikiCommons';

const CARINA = 'ESO_-_The_Carina_Nebula_(by).jpg';
const NORTH_AMERICA = 'The_North_America_Nebula.jpg';

export const DEMO_HIGH_RES_IMAGES = {
  carinaNebulaESO: {
    src: wikiOriginal('4/45', CARINA),
    minimapSrc: wikiThumb('4/45', CARINA, 330),
    /** Grid `<img>` fallback if the small thumb 400s. */
    gridFallbackSrc: wikiThumb('4/45', CARINA, 1280),
    commonsPage: 'https://commons.wikimedia.org/wiki/File:ESO_-_The_Carina_Nebula_(by).jpg',
    approxBytes: 12_246_989,
  },
  northAmericaNebula: {
    src: wikiOriginal('f/f2', NORTH_AMERICA),
    minimapSrc: wikiThumb('f/f2', NORTH_AMERICA, 1280),
    gridFallbackSrc: wikiThumb('f/f2', NORTH_AMERICA, 1920),
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
