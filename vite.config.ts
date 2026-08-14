/// <reference types="vitest/config" />
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

const rootDir = path.dirname(fileURLToPath(import.meta.url))
const testImagesDir = path.join(rootDir, 'test-images')
const MOUNT = '/__local_test_images__'

/**
 * Dev-only static serve of `./test-images` (large local JPGs for Demo 6).
 * Not copied into the GitHub Pages build. Never commit `test-images/` (gitignored).
 */
function serveLocalTestImages(): Plugin {
  return {
    name: 'serve-local-test-images',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url?.split('?')[0] ?? ''
        if (!url.startsWith(MOUNT + '/') && url !== MOUNT) {
          next()
          return
        }
        const rel = decodeURIComponent(url.slice(MOUNT.length).replace(/^\//, ''))

        if (rel === 'manifest.json') {
          if (!fs.existsSync(testImagesDir)) {
            res.statusCode = 404
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ images: [] }))
            return
          }
          const thumbsDir = path.join(testImagesDir, 'thumbs')
          const names = fs
            .readdirSync(testImagesDir)
            .filter((n) => /\.(jpe?g|png|webp)$/i.test(n) && fs.statSync(path.join(testImagesDir, n)).isFile())
            .sort()
          const images = names
            .filter((n) => fs.existsSync(path.join(thumbsDir, n)))
            .map((n) => ({
              name: n,
              src: `${MOUNT}/${encodeURIComponent(n)}`,
              minimapSrc: `${MOUNT}/thumbs/${encodeURIComponent(n)}`,
            }))
          res.statusCode = 200
          res.setHeader('Content-Type', 'application/json')
          res.setHeader('Cache-Control', 'no-store')
          res.end(JSON.stringify({ images }))
          return
        }

        if (!rel || rel.includes('..')) {
          res.statusCode = 400
          res.end('bad path')
          return
        }
        const filePath = path.join(testImagesDir, rel)
        if (!filePath.startsWith(testImagesDir) || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
          res.statusCode = 404
          res.end('not found')
          return
        }
        if (req.method === 'HEAD') {
          res.statusCode = 200
          res.setHeader('Content-Type', 'image/jpeg')
          res.setHeader('Cache-Control', 'no-store')
          res.end()
          return
        }
        res.statusCode = 200
        res.setHeader('Content-Type', 'image/jpeg')
        res.setHeader('Cache-Control', 'no-store')
        fs.createReadStream(filePath).pipe(res)
      })
    },
  }
}

export default defineConfig({
  // GitHub Pages serves the site under https://<user>.github.io/<repo>/
  // Set base to the repo name so all asset paths resolve correctly.
  base: '/right-image-preview/',
  define: {
    // Demo / vitest: no local-pack badge unless RIP_LOCAL_BUILD_AT is set.
    __RIP_LOCAL_BUILD_AT__: JSON.stringify(process.env.RIP_LOCAL_BUILD_AT ?? ''),
    __RIP_PACKAGE_VERSION__: JSON.stringify(process.env.RIP_PACKAGE_VERSION ?? '0.0.0-dev'),
  },
  plugins: [react(), serveLocalTestImages()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './tests/setup.ts',
    coverage: {
      provider: 'v8',
      include: ['src/components/ImagePreview/**/*.ts', 'src/components/ImagePreview/**/*.tsx'],
      exclude: [
        'src/components/ImagePreview/index.ts',
        'src/components/ImagePreview/locales/**',
        'src/components/ImagePreview/imagePreviewTuning.ts',
      ],
      reporter: ['text', 'lcov', 'html'],
      thresholds: {
        lines: 50,
        functions: 50,
      },
    },
  },
})
