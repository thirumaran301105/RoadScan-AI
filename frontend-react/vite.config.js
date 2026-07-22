import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The backend (uvicorn, run from /backend) serves this build output as
// static files and also handles /api/*, /ws/* itself, so a plain build is
// enough - no base path tricks required.
export default defineConfig({
  plugins: [react()],
  server: {
    // During `npm run dev`, proxy API/WS calls to the FastAPI backend
    // running on 8000 so you can iterate on the UI with hot-reload.
    proxy: {
      '/api': 'http://localhost:8000',
      '/ws': { target: 'ws://localhost:8000', ws: true },
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
})
