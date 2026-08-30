import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const IMAGE_EXT = /\.(jpe?g|png|webp)$/i;

export function mimeForImageFilename(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  return 'image/jpeg';
}

/** Encode each path segment so nested Unicode names stay valid URLs. */
export function encodeLocalTestImagePath(rel: string): string {
  return rel.split('/').filter(Boolean).map(encodeURIComponent).join('/');
}

export interface LocalTestImageEntry {
  /** Path relative to `test-images/`, POSIX slashes. */
  rel: string;
  name: string;
  src: string;
  minimapSrc: string;
}

/**
 * Recursively list raster files under `rootDir`.
 * Skips `thumbs/` at the root (generated minimap cache) and dotfiles.
 * `minimapSrc` always points at `/thumbs/<rel>`; the dev server creates a 320px file on first request.
 */
export function listLocalTestImages(rootDir: string, mount: string): LocalTestImageEntry[] {
  if (!fs.existsSync(rootDir) || !fs.statSync(rootDir).isDirectory()) return [];
  const rels: string[] = [];
  walkImageFiles(rootDir, '', rels);
  rels.sort((a, b) => a.localeCompare(b, 'en'));
  return rels.map((rel) => {
    const encoded = encodeLocalTestImagePath(rel);
    return {
      rel,
      name: rel,
      src: `${mount}/${encoded}`,
      // Always the thumbs URL; the dev middleware generates a 320px file on first request.
      minimapSrc: `${mount}/thumbs/${encoded}`,
    };
  });
}

function walkImageFiles(abs: string, relPrefix: string, out: string[]): void {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(abs, { withFileTypes: true });
  } catch {
    return;
  }
  for (const ent of entries) {
    if (ent.name.startsWith('.')) continue;
    if (!relPrefix && ent.name === 'thumbs') continue;
    const rel = relPrefix ? `${relPrefix}/${ent.name}` : ent.name;
    const full = path.join(abs, ent.name);
    if (ent.isDirectory()) {
      walkImageFiles(full, rel, out);
    } else if (ent.isFile() && IMAGE_EXT.test(ent.name)) {
      out.push(rel);
    }
  }
}

/** Resolve a path under `rootDir`, rejecting `..` escapes. */
export function resolveUnderRoot(rootDir: string, rel: string): string | null {
  if (!rel || rel.includes('..')) return null;
  const rootResolved = path.resolve(rootDir);
  const filePath = path.resolve(rootDir, rel);
  if (filePath !== rootResolved && !filePath.startsWith(rootResolved + path.sep)) return null;
  return filePath;
}

export function resolveLocalTestOriginal(rootDir: string, rel: string): string | null {
  const filePath = resolveUnderRoot(rootDir, rel);
  if (!filePath || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) return null;
  return filePath;
}

/**
 * Serve a 320px thumb, generating it with `sips` on first request when possible.
 * Falls back to the original if generation is unavailable.
 */
export function resolveLocalTestThumb(rootDir: string, rel: string): string | null {
  const original = resolveLocalTestOriginal(rootDir, rel);
  if (!original) return null;
  const thumb = resolveUnderRoot(rootDir, path.join('thumbs', rel));
  if (!thumb) return original;
  if (fs.existsSync(thumb) && fs.statSync(thumb).isFile()) return thumb;
  try {
    fs.mkdirSync(path.dirname(thumb), { recursive: true });
    const result = spawnSync('sips', ['-Z', '320', original, '--out', thumb], { stdio: 'ignore' });
    if (result.status === 0 && fs.existsSync(thumb) && fs.statSync(thumb).isFile()) return thumb;
  } catch {
    /* ignore missing sips / unreadable originals */
  }
  return original;
}
