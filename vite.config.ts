/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // GitHub Pages serves the site under https://<user>.github.io/<repo>/
  // Set base to the repo name so all asset paths resolve correctly.
  base: '/right-image-preview/',
  plugins: [react()],
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
