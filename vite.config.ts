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
    // Önizleme sürümünde servis çalışanı yok: kayıt modülü boş bir modülle değiştirilir
    resolve: embed ? { alias: { 'virtual:pwa-register': '/src/pwa-stub.ts' } } : {},
    build: embed ? { outDir: 'dist-embed', chunkSizeWarningLimit: 2000 } : { chunkSizeWarningLimit: 900 },
    plugins: [
      react(),
      tailwindcss(),
      embed
        ? viteSingleFile()
        : VitePWA({
            // Yeni sürüm hazır olunca kullanıcıya sorulur; form doldururken sayfa kendiliğinden yenilenmez
            registerType: 'prompt',
            includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
            manifest: {
              id: './',
              name: 'Luma Cakes · Sipariş Atölyesi',
              short_name: 'Luma Cakes',
              description: 'Butik pastane için sipariş, müşteri, takvim, fiyat listesi ve stok yönetimi',
              lang: 'tr',
              dir: 'ltr',
              start_url: './',
              scope: './',
              display: 'standalone',
              display_override: ['standalone'],
              orientation: 'any',
              background_color: '#faf6f2',
              theme_color: '#faf6f2',
              categories: ['business', 'productivity', 'food'],
              icons: [
                { src: 'pwa-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
                { src: 'pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
                { src: 'pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
              ],
              // Android'de simgeye basılı tutunca çıkan kısayollar
              shortcuts: [
                { name: 'Yeni sipariş', short_name: 'Yeni sipariş', url: './#/siparisler/yeni', icons: [{ src: 'pwa-192.png', sizes: '192x192' }] },
                { name: 'Takvim', short_name: 'Takvim', url: './#/takvim', icons: [{ src: 'pwa-192.png', sizes: '192x192' }] },
                { name: 'Fiyat listesi', short_name: 'Fiyatlar', url: './#/fiyat-listesi', icons: [{ src: 'pwa-192.png', sizes: '192x192' }] },
              ],
            },
            workbox: {
              globPatterns: ['**/*.{js,css,html,svg,png,woff,woff2}'],
              // iPhone / iPad açılış ekranları yalnızca yüklemede kullanılır; çevrimdışı önbelleğe alınmaz
              globIgnores: ['**/splash/**'],
            },
          }),
    ],
  }
})
