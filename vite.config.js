import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/',
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        // Firebase va en su propio archivo: cambia poco y el navegador lo guarda en caché
        manualChunks: { firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore'] }
      }
    }
  }
})
