import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { copyFileSync, existsSync, mkdirSync, readdirSync, renameSync, rmSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'copy-manifest-and-fix-html',
      closeBundle() {
        copyFileSync('manifest.json', 'dist/manifest.json');
        
        // Copy icons if they exist
        const iconsPath = join(__dirname, 'icons');
        const distIconsPath = join(__dirname, 'dist', 'icons');
        
        if (existsSync(iconsPath)) {
          if (!existsSync(distIconsPath)) {
            mkdirSync(distIconsPath, { recursive: true });
          }
          
          const iconFiles = ['icon16.png', 'icon48.png', 'icon128.png'];
          iconFiles.forEach(iconFile => {
            const srcIcon = join(iconsPath, iconFile);
            const destIcon = join(distIconsPath, iconFile);
            if (existsSync(srcIcon)) {
              copyFileSync(srcIcon, destIcon);
            }
          });
        }
        
        // Move HTML files from dist/src/ui to dist root and fix paths
        const srcUiPath = join(__dirname, 'dist', 'src', 'ui');
        const distPath = join(__dirname, 'dist');
        
        if (existsSync(srcUiPath)) {
          const files = readdirSync(srcUiPath);
          files.forEach(file => {
            if (file.endsWith('.html')) {
              const srcFile = join(srcUiPath, file);
              const destFile = join(distPath, file);
              
              // Read the HTML file and fix the paths
              let content = readFileSync(srcFile, 'utf-8');
              // Replace ../../ with ./ since we're moving to root
              content = content.replace(/\.\.\/..\//g, './');
              
              // Write the fixed content to the destination
              writeFileSync(destFile, content);
            }
          });
          
          // Clean up the src directory in dist
          rmSync(join(__dirname, 'dist', 'src'), { recursive: true, force: true });
        }
      }
    }
  ],
  base: './',
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        background: resolve(__dirname, 'src/background/service-worker.ts'),
        popup: resolve(__dirname, 'src/ui/popup.html'),
        options: resolve(__dirname, 'src/ui/options.html'),
        devtools: resolve(__dirname, 'src/ui/devtools.html'),
        panel: resolve(__dirname, 'src/ui/panel.html')
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: '[name].js',
        assetFileNames: '[name].[ext]'
      }
    },
    // Production optimizations
    minify: process.env.NODE_ENV === 'production' ? 'esbuild' : false,
    sourcemap: process.env.NODE_ENV === 'production' ? 'hidden' : true,
    target: 'es2020',
    // Optimize chunk size
    chunkSizeWarningLimit: 1000,
    // Enable tree-shaking
    reportCompressedSize: true
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src')
    }
  }
});
