import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

// Vercel (and local): base `/`. Override with VITE_BASE=/gardenrss/ for legacy Pages.
const base = process.env.VITE_BASE || '/'

export default defineConfig({
  base,
  plugins: [vue(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    strictPort: false,
  },
  preview: {
    strictPort: false,
  },
})
