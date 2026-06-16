import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: true,
    port: 3000
  },
  build: {
    rollupOptions: {
      output: {
        // Separa el vendor (cambia poco entre deploys -> mejor cache del navegador)
        // del codigo de la app. No altera ninguna logica.
        manualChunks: {
          react: ['react', 'react-dom'],
          supabase: ['@supabase/supabase-js'],
          icons: ['@phosphor-icons/react']
        }
      }
    }
  }
})
