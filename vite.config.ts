/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    // Client tests only. The relay server (server/) has its own vitest run with
    // its own deps; including it here would break `npm test` in CI, where the
    // root job never installs server/node_modules.
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
