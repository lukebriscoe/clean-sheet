import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Served from the root of a custom subdomain (see CNAME), so base stays '/'.
// If you ever move to a project path like example.com/clean-sheet/, override at
// build time instead of editing this file:  npm run build -- --base=/clean-sheet/
export default defineConfig({
  base: '/',
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        // Firebase is by far the heaviest dependency — keep it out of the entry
        // chunk so the library page paints before it lands.
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          firebase: ['firebase/app', 'firebase/firestore'],
          markdown: ['marked', 'dompurify'],
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.{js,jsx}'],
  },
})
