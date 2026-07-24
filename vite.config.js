import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false
      }
    }
  },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      manifest: {
        name: 'Hi-HUBBLE',
        short_name: 'Hi-HUBBLE',
        description: 'Next-Gen Social Media Prototype',
        display: 'standalone',
        orientation: 'portrait',
        theme_color: '#000000',
        background_color: '#ffffff',
        icons: [
          {
            src: '/hihubble-mascot-circle.png', // Fallback/Default icon
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/hihubble-mascot-circle.png', 
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      },
      workbox: {
        // Stale-While-Revalidate Strategy for Images and Fonts
        runtimeCaching: [
          {
            urlPattern: ({ request }) => 
              request.destination === 'image' || request.destination === 'font',
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'pwa-assets-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 30 // 30 Days
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ]
      }
    })
  ]
});
