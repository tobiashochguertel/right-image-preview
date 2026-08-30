import { describe, expect, it } from 'vitest';
import { DEMO_HIGH_RES_IMAGES } from '../src/demos/demoHighResSources';
import { DEMO_REMOTE_PRELOAD_IMAGES, demoRemotePreloadItems } from '../src/demos/demoRemotePreloadSources';
import { WIKI_MINIMAP_PX, wikiOriginal, wikiThumb } from '../src/demos/wikiCommons';

describe('demoRemotePreloadSources', () => {
  it('exposes Wikimedia CORS thumbs in the 1280–1920px range', () => {
    expect(DEMO_REMOTE_PRELOAD_IMAGES.length).toBeGreaterThanOrEqual(8);
    for (const row of DEMO_REMOTE_PRELOAD_IMAGES) {
      expect(row.src).toMatch(/\/(1280|1920)px-/);
      expect(row.minimapSrc).toMatch(`/${WIKI_MINIMAP_PX}px-`);
      expect(row.minimapSrc).not.toMatch(/\/500px-/);
      expect(row.src).toContain('upload.wikimedia.org');
    }
  });

  it('uses a 120px North America Nebula thumb, not 500px', () => {
    const na = DEMO_REMOTE_PRELOAD_IMAGES.find((row) => row.commonsFile === 'The_North_America_Nebula.jpg');
    expect(na?.minimapSrc).toContain('/120px-The_North_America_Nebula.jpg');
    expect(na?.src).toContain('/1280px-The_North_America_Nebula.jpg');
  });

  it('maps locale names onto ImageItem fields', () => {
    const zh = demoRemotePreloadItems('zh');
    const en = demoRemotePreloadItems('en');
    expect(zh[0]?.name).toBe(DEMO_REMOTE_PRELOAD_IMAGES[0]?.nameZh);
    expect(en[0]?.name).toBe(DEMO_REMOTE_PRELOAD_IMAGES[0]?.nameEn);
    expect(zh[0]?.src).toBe(en[0]?.src);
  });
});

describe('wikiCommons', () => {
  it('percent-encodes parentheses in both path segments', () => {
    expect(wikiThumb('4/45', 'ESO_-_The_Carina_Nebula_(by).jpg', 330)).toBe(
      'https://upload.wikimedia.org/wikipedia/commons/thumb/4/45/ESO_-_The_Carina_Nebula_%28by%29.jpg/330px-ESO_-_The_Carina_Nebula_%28by%29.jpg',
    );
    expect(wikiOriginal('4/45', 'ESO_-_The_Carina_Nebula_(by).jpg')).toBe(
      'https://upload.wikimedia.org/wikipedia/commons/4/45/ESO_-_The_Carina_Nebula_%28by%29.jpg',
    );
  });
});

describe('demoHighResSources', () => {
  it('does not use the unreliable 500px North America thumb', () => {
    const { northAmericaNebula, carinaNebulaESO } = DEMO_HIGH_RES_IMAGES;
    expect(northAmericaNebula.minimapSrc).toContain('/1280px-The_North_America_Nebula.jpg');
    expect(northAmericaNebula.minimapSrc).not.toMatch(/\/500px-/);
    expect(carinaNebulaESO.minimapSrc).not.toMatch(/\/500px-/);
  });
});
