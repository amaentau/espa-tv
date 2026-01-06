import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  plugins: [svelte()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    proxy: {
      '/auth': 'http://localhost:3000',
      '/devices': 'http://localhost:3000',
      '/config': 'http://localhost:3000',
      '/entries': 'http://localhost:3000',
      '/entry': 'http://localhost:3000',
    }
  }
});

