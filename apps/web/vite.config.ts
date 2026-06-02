import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/v1': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  build: {
    target: 'es2015',
    minify: 'esbuild',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined
          if (id.includes('/react') || id.includes('\\react') || id.includes('react-dom') || id.includes('react-router-dom')) {
            return 'react-vendor'
          }
          if (id.includes('recharts') || id.includes('d3-') || id.includes('victory-vendor') || id.includes('reselect')) {
            return 'charts-vendor'
          }
          if (id.includes('lucide-react')) return 'icons-vendor'
          if (id.includes('axios') || id.includes('zustand') || id.includes('date-fns') || id.includes('qrcode')) {
            return 'app-vendor'
          }
          return undefined
        },
      },
    },
  },
})
