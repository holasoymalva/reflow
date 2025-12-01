import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { copyFileSync } from 'fs';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'copy-manifest',
      closeBundle() {
        copyFileSync('manifest.json', 'dist/manifest.json');
      }
    }
  ],
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        background: resolve(__dirname, 'src/background/service-worker.ts'),
        popup: resolve(__dirname, 'src/ui/popup.html'),
        options: resolve(__dirname, 'src/ui/options.html')
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: '[name].js',
        assetFileNames: '[name].[ext]'
      }
    },
    minify: false,
    sourcemap: true
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src')
    }
  }
});
