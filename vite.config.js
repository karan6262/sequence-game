import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Sequence Pro',
        short_name: 'Sequence',
        theme_color: '#0a0f1a',
        background_color: '#0a0f1a',
        display: 'standalone',
        icons: [{ src: 'https://cdn-icons-png.flaticon.com/512/1055/1055662.png', sizes: '512x512', type: 'image/png' }]
      }
    })
  ]
})