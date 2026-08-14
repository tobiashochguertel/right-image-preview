/**
 * Build the library for host `file:` installs (Media Lens, etc.).
 *
 * Usage:
 *   npm run pack:local
 *
 * Writes `.local-build-at` (gitignored) so **repo-root** `file:../right-image-preview`
 * links keep the top badge after rebuilds. Also copies to `.local-pack/right-image-preview/`.
 *
 * Clear stamp before npm publish: `npm run build:lib:release` (or prepublishOnly).
 */
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, '.local-pack', 'right-image-preview');
const stampPath = join(root, '.local-build-at');

function formatBuildAt(d = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

const buildAt = formatBuildAt();
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));

writeFileSync(stampPath, `${buildAt}\n`);
console.log(`[pack:local] building ${pkg.name}@${pkg.version} at ${buildAt}`);
console.log(`[pack:local] wrote ${stampPath}`);

const build = spawnSync(
  process.platform === 'win32' ? 'npm.cmd' : 'npm',
  ['run', 'build:lib'],
  {
    cwd: root,
    stdio: 'inherit',
    env: {
      ...process.env,
      RIP_LOCAL_BUILD_AT: buildAt,
      RIP_PACKAGE_VERSION: pkg.version,
    },
  },
);
if (build.status !== 0) {
  process.exit(build.status ?? 1);
}

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });
cpSync(join(root, 'dist'), join(outDir, 'dist'), { recursive: true });

const packedPkg = {
  name: pkg.name,
  version: pkg.version,
  description: pkg.description,
  license: pkg.license,
  type: pkg.type,
  main: pkg.main,
  module: pkg.module,
  types: pkg.types,
  exports: pkg.exports,
  sideEffects: pkg.sideEffects,
  peerDependencies: pkg.peerDependencies,
  ripLocalPack: {
    buildAt,
    source: root,
  },
};
writeFileSync(join(outDir, 'package.json'), `${JSON.stringify(packedPkg, null, 2)}\n`);
writeFileSync(
  join(outDir, 'LOCAL_PACK.txt'),
  [
    `${pkg.name}@${pkg.version}`,
    `local pack buildAt: ${buildAt}`,
    `source: ${root}`,
    '',
    'Host may depend on either:',
    `  "right-image-preview": "file:${root}"`,
    `  "right-image-preview": "file:${outDir}"`,
    '',
    'After pack:local with a file: link to the repo root, restart the host dev server',
    '(Vite may cache node_modules). If file: copies (not links), re-run npm install.',
    '',
  ].join('\n'),
);

for (const f of ['README.md', 'README.zh-CN.md', 'LICENSE']) {
  try {
    cpSync(join(root, f), join(outDir, f));
  } catch {
    /* optional */
  }
}

console.log(`[pack:local] ready → ${outDir}`);
console.log(`[pack:local] dist/ also stamped (repo-root file: links OK)`);
console.log(`[pack:local] badge: local v${pkg.version} · ${buildAt}`);
