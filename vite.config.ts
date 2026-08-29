import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  // Pre-bundle every runtime dependency up front. Without this, hitting a
  // lazily-loaded route that pulls in a not-yet-optimised dependency makes Vite
  // re-optimise and force a full reload — which shows up as a mid-navigation
  // "failed to fetch dynamically imported module" and a dead screen.
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-dom/client', 'react-router-dom'],
  },
  build: {
    target: 'es2022',
  },
})
