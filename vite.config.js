import { defineConfig } from 'vite';
import legacy from '@vitejs/plugin-legacy';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import path from 'path';

export default defineConfig({
  plugins: [
    legacy({
      targets: ['defaults', 'not IE 11']
    }),
    viteStaticCopy({
      targets: [
        { src: 'libs', dest: '.' },
        { src: 'bkcore', dest: '.' },
        { src: 'bkcore.coffee', dest: '.' },
        { src: 'launch.js', dest: '.' },
        { src: 'textures', dest: '.' },
        { src: 'textures.full', dest: '.' },
        { src: 'geometries', dest: '.' },
        { src: 'audio', dest: '.' },
        { src: 'css/help-*.png', dest: 'css' },
        { src: 'css/bg.jpg', dest: 'css' },
        { src: 'css/title.png', dest: 'css' },
        { src: 'css/mobile-*.jpg', dest: 'css' },
        { src: 'css/mobile-over.jpg', dest: 'css' },
        { src: 'css/*.eot', dest: 'css' },
        { src: 'css/*.svg', dest: 'css' },
        { src: 'css/*.ttf', dest: 'css' },
        { src: 'css/*.woff', dest: 'css' },
        { src: 'favicon.png', dest: '.' },
        { src: 'icon_*.png', dest: '.' }
      ]
    })
  ],
  resolve: {
    alias: {
      '~': path.resolve(__dirname, './src')
    }
  },
  build: {
    minify: 'terser',
    terserOptions: {
      compress: true,
      mangle: true
    },
    rollupOptions: {
      input: 'index.html',
      output: {
        entryFileNames: '[name]-[hash].js',
        chunkFileNames: '[name]-[hash].js',
        assetFileNames: '[name]-[hash][extname]'
      }
    }
  }
});
