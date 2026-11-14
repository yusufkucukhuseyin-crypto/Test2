import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import { viteSingleFile } from 'vite-plugin-singlefile'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // "embed" modu: tek dosyalık önizleme sürümü (servis çalışanı yok, her şey HTML içinde)
  const embed = mode === 'embed'
  return {
    // Göreli yol: uygulama herhangi bir klasörde/alan adında barındırılabilir
    base: './',
    define: embed ? { 'import.meta.env.VITE_EMBED': JSON.stringify('1') } : {},
    build: embed ? { outDir: 'dist-embed', chunkSizeWarningLimit: 2000 } : { chunkSizeWarningLimit: 900 },
    plugins: [
      react(),
      tailwindcss(),
      embed
        ? viteSingleFile()
        : VitePWA({
            registerType: 'autoUpdate',
            includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
            manifest: {
              name: 'Luma Cakes · Sipariş Atölyesi',
              short_name: 'Luma Cakes',
              description: 'Butik pastane için müşteri, sipariş, takvim, üretim planı ve stok yönetimi',
              lang: 'tr',
              start_url: './',
              scope: './',
              display: 'standalone',
              orientation: 'any',
              background_color: '#faf6f2',
              theme_color: '#faf6f2',
              icons: [
                { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
                { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
                { src: 'pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
              ],
            },
            workbox: {
              globPatterns: ['**/*.{js,css,html,svg,png,woff,woff2}'],
            },
          }),
    ],
  }
})
