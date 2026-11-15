import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Relative base so the build works from file:// inside Capacitor's WebView.
  base: './',
  build: {
    target: 'es2020',
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 2000,
  },
  server: { host: true },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
