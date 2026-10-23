import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    chunkSizeWarningLimit: 900, // three.js сам по себе около 700 КБ
    rollupOptions: {
      output: {
        // three.js выносим отдельно: он редко меняется и хорошо кэшируется
        manualChunks: { three: ['three'] },
      },
    },
  },
});
