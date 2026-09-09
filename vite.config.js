import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

// Served from the root of a custom subdomain (see CNAME), so base stays '/'.
// If you ever move to a project path like example.com/clean-sheet/, override at
// build time instead of editing this file:  npm run build -- --base=/clean-sheet/
export default defineConfig({
  base: '/',
  plugins: [react()],
  build: {
    rollupOptions: {
      // render/ is the video frame renderer — a build artefact Playwright drives,
      // never a page a coach visits. It is a SEPARATE ENTRY rather than a route in
      // App.jsx so none of it ships in the bundle the library page downloads, and
      // so there is no dead route sitting in the router for someone to find.
      //
      // It is also OPT-IN, because the deploy workflow publishes the whole of
      // dist/ to GitHub Pages — building it by default would put an internal tool
      // (and a 165KB chunk holding every drill's JSON) at a public URL on
      // coaching.lukebriscoe.com. `npm run render` sets BUILD_RENDER; CI never does.
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        ...(process.env.BUILD_RENDER
          ? { render: fileURLToPath(new URL('./render/index.html', import.meta.url)) }
          : {}),
      },
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
