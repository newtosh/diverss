import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

// Project GitHub Pages: https://<user>.github.io/diverss/
export default defineConfig({
  base: '/diverss/',
  plugins: [vue(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    // Prefer 5173; if taken, Vite increments (see scripts/dev-web.mjs / dev-local.mjs).
    strictPort: false,
  },
  preview: {
    strictPort: false,
  },
})
