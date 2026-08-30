/**
 * Demo 6 remote gallery: Wikimedia Commons JPEGs with CORS (`Access-Control-Allow-Origin: *`).
 * `src` is a 1280–1920px derivative (about 1000–3000px as requested). `minimapSrc` is a 120px
 * generated thumb (500px is not generated for every file and 400s in the browser).
 */
import { WIKI_MINIMAP_PX, wikiThumb } from './wikiCommons';

export interface DemoRemotePreloadImage {
  src: string;
  minimapSrc: string;
  nameEn: string;
  nameZh: string;
  commonsFile: string;
}

export const DEMO_REMOTE_PRELOAD_IMAGES: readonly DemoRemotePreloadImage[] = [
  {
    commonsFile: 'The_Earth_seen_from_Apollo_17.jpg',
    src: wikiThumb('9/97', 'The_Earth_seen_from_Apollo_17.jpg', 1920),
    minimapSrc: wikiThumb('9/97', 'The_Earth_seen_from_Apollo_17.jpg', WIKI_MINIMAP_PX),
    nameEn: 'Earth from Apollo 17',
    nameZh: '阿波罗 17 号拍摄的地球',
  },
  {
    commonsFile: 'Mount_Everest_as_seen_from_Drukair2.jpg',
    src: wikiThumb('3/36', 'Mount_Everest_as_seen_from_Drukair2.jpg', 1920),
    minimapSrc: wikiThumb('3/36', 'Mount_Everest_as_seen_from_Drukair2.jpg', WIKI_MINIMAP_PX),
    nameEn: 'Mount Everest from Drukair',
    nameZh: '不丹航空视角的珠峰',
  },
  {
    commonsFile: 'Andromeda_Galaxy_(with_h-alpha).jpg',
    src: wikiThumb('9/98', 'Andromeda_Galaxy_(with_h-alpha).jpg', 1920),
    minimapSrc: wikiThumb('9/98', 'Andromeda_Galaxy_(with_h-alpha).jpg', WIKI_MINIMAP_PX),
    nameEn: 'Andromeda Galaxy',
    nameZh: '仙女座星系',
  },
  {
    commonsFile: 'Eilean_Donan_Castle,_Scotland_-_Jan_2011.jpg',
    src: wikiThumb('6/67', 'Eilean_Donan_Castle,_Scotland_-_Jan_2011.jpg', 1920),
    minimapSrc: wikiThumb('6/67', 'Eilean_Donan_Castle,_Scotland_-_Jan_2011.jpg', WIKI_MINIMAP_PX),
    nameEn: 'Eilean Donan Castle',
    nameZh: '苏格兰艾琳·多南城堡',
  },
  {
    commonsFile: 'Great_Wave_off_Kanagawa2.jpg',
    src: wikiThumb('0/0d', 'Great_Wave_off_Kanagawa2.jpg', 1920),
    minimapSrc: wikiThumb('0/0d', 'Great_Wave_off_Kanagawa2.jpg', WIKI_MINIMAP_PX),
    nameEn: 'The Great Wave off Kanagawa',
    nameZh: '神奈川冲浪里',
  },
  {
    commonsFile: 'Cat_November_2010-1a.jpg',
    src: wikiThumb('4/4d', 'Cat_November_2010-1a.jpg', 1280),
    minimapSrc: wikiThumb('4/4d', 'Cat_November_2010-1a.jpg', WIKI_MINIMAP_PX),
    nameEn: 'Tabby cat',
    nameZh: '虎斑猫',
  },
  {
    commonsFile: 'Van_Gogh_-_Starry_Night_-_Google_Art_Project.jpg',
    src: wikiThumb('e/ea', 'Van_Gogh_-_Starry_Night_-_Google_Art_Project.jpg', 1280),
    minimapSrc: wikiThumb('e/ea', 'Van_Gogh_-_Starry_Night_-_Google_Art_Project.jpg', WIKI_MINIMAP_PX),
    nameEn: 'The Starry Night',
    nameZh: '星月夜',
  },
  {
    commonsFile: 'ESO_-_The_Carina_Nebula_(by).jpg',
    src: wikiThumb('4/45', 'ESO_-_The_Carina_Nebula_(by).jpg', 1280),
    minimapSrc: wikiThumb('4/45', 'ESO_-_The_Carina_Nebula_(by).jpg', WIKI_MINIMAP_PX),
    nameEn: 'Carina Nebula (ESO)',
    nameZh: '船底座大星云（ESO）',
  },
  {
    commonsFile: 'The_North_America_Nebula.jpg',
    src: wikiThumb('f/f2', 'The_North_America_Nebula.jpg', 1280),
    minimapSrc: wikiThumb('f/f2', 'The_North_America_Nebula.jpg', WIKI_MINIMAP_PX),
    nameEn: 'North America Nebula',
    nameZh: '北美洲星云',
  },
  {
    commonsFile: 'Hubble_ultra_deep_field.jpg',
    src: wikiThumb('2/2f', 'Hubble_ultra_deep_field.jpg', 1920),
    minimapSrc: wikiThumb('2/2f', 'Hubble_ultra_deep_field.jpg', WIKI_MINIMAP_PX),
    nameEn: 'Hubble Ultra Deep Field',
    nameZh: '哈勃超深空',
  },
  {
    commonsFile: 'Red_Apple.jpg',
    src: wikiThumb('1/15', 'Red_Apple.jpg', 1280),
    minimapSrc: wikiThumb('1/15', 'Red_Apple.jpg', WIKI_MINIMAP_PX),
    nameEn: 'Red apple',
    nameZh: '红苹果',
  },
];

export function demoRemotePreloadItems(locale: 'en' | 'zh') {
  const zh = locale === 'zh';
  return DEMO_REMOTE_PRELOAD_IMAGES.map((row) => ({
    src: row.src,
    minimapSrc: row.minimapSrc,
    alt: zh ? row.nameZh : row.nameEn,
    name: zh ? row.nameZh : row.nameEn,
  }));
}
