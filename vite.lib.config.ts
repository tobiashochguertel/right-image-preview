import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import dts from 'vite-plugin-dts';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'path';

const root = resolve(__dirname);
const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
const stampPath = resolve(root, '.local-build-at');

/** Prefer env (pack:local); else persist file so `file:../right-image-preview` host links keep the badge. */
function resolveLocalBuildAt() {
  if (process.env.RIP_LOCAL_BUILD_AT) return process.env.RIP_LOCAL_BUILD_AT;
  if (process.env.RIP_CLEAR_LOCAL_BUILD === '1') return '';
  if (existsSync(stampPath)) {
    return readFileSync(stampPath, 'utf8').trim();
  }
  return '';
}

const localBuildAt = resolveLocalBuildAt();
const packageVersion = process.env.RIP_PACKAGE_VERSION ?? pkg.version;

// Library build config — used by `npm run build:lib` / `npm publish` / `pack:local`.
// Separate from vite.config.ts which is for the demo app + tests.
export default defineConfig({
  publicDir: false, // don't copy public/ assets into the library dist
  define: {
    // Empty for npm publish; set by `scripts/pack-local.mjs` / `.local-build-at`.
    __RIP_LOCAL_BUILD_AT__: JSON.stringify(localBuildAt),
    __RIP_PACKAGE_VERSION__: JSON.stringify(packageVersion),
  },
  plugins: [
    react(),
    dts({
      tsconfigPath: './tsconfig.lib.json',
      // Single bundled .d.ts hits API Extractor + TS 6.x issues (empty `export {}`); flat emit works.
      rollupTypes: false,
      insertTypesEntry: true,
    }),
  ],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/components/ImagePreview/index.ts'),
      name: 'RightImagePreview',
      formats: ['es', 'cjs'],
      fileName: (format) => `index.${format === 'es' ? 'mjs' : 'cjs'}`,
    },
    rollupOptions: {
      external: ['react', 'react-dom', 'react/jsx-runtime'],
      output: {
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM',
          'react/jsx-runtime': 'jsxRuntime',
        },
      },
    },
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
  },
});
