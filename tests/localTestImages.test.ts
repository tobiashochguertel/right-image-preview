import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  encodeLocalTestImagePath,
  listLocalTestImages,
  mimeForImageFilename,
} from '../scripts/localTestImages';

describe('localTestImages', () => {
  const dirs: string[] = [];

  afterEach(() => {
    for (const dir of dirs.splice(0)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('encodes nested Unicode segments without encoding slashes', () => {
    expect(encodeLocalTestImagePath('佳能/DSC_1.jpg')).toBe(
      `${encodeURIComponent('佳能')}/DSC_1.jpg`,
    );
  });

  it('maps common raster extensions to MIME types', () => {
    expect(mimeForImageFilename('a.PNG')).toBe('image/png');
    expect(mimeForImageFilename('a.webp')).toBe('image/webp');
    expect(mimeForImageFilename('a.JPG')).toBe('image/jpeg');
  });

  it('lists nested files without requiring thumbs or a fixed count', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rip-test-images-'));
    dirs.push(root);
    fs.mkdirSync(path.join(root, 'album', 'set'), { recursive: true });
    fs.mkdirSync(path.join(root, 'thumbs', 'album'), { recursive: true });
    fs.writeFileSync(path.join(root, 'root.jpg'), 'x');
    fs.writeFileSync(path.join(root, 'album', 'set', 'nested.png'), 'x');
    fs.writeFileSync(path.join(root, 'thumbs', 'root.jpg'), 't');
    fs.writeFileSync(path.join(root, 'thumbs', 'ignored.jpg'), 't');
    fs.writeFileSync(path.join(root, '.hidden.jpg'), 'x');

    const listed = listLocalTestImages(root, '/__local_test_images__');
    expect(listed.map((row) => row.rel)).toEqual(['album/set/nested.png', 'root.jpg']);
    expect(listed[0]?.minimapSrc).toBe(
      '/__local_test_images__/thumbs/album/set/nested.png',
    );
    expect(listed[1]?.minimapSrc).toBe('/__local_test_images__/thumbs/root.jpg');
  });
});
