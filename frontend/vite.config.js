import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      }
    }
  },
  build: {
    chunkSizeWarningLimit: 1100,
    // Let Vite/Rollup handle chunk splitting automatically.
    // Manual chunking causes load-order race conditions (createContext undefined).
    rollupOptions: {}
  }
})
