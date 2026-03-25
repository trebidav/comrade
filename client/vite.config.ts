import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { execSync } from 'child_process'

let commitHash = process.env.RAILWAY_GIT_COMMIT_SHA?.slice(0, 7) ?? 'unknown'
try {
  commitHash = execSync('git rev-parse --short HEAD').toString().trim()
} catch {
  // No .git in build container — use RAILWAY_GIT_COMMIT_SHA or fallback
}

export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: {
    __COMMIT_HASH__: JSON.stringify(commitHash),
  },
  base: process.env.NODE_ENV === 'production' ? '/static/' : '/',
  envDir: '..',
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://localhost:8000',
        ws: true,
      },
      '/media': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})
