import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
  build: {
    // 确保 Service Worker 和 Manifest 被正确复制
    rollupOptions: {
      output: {
        // 保持 public 目录中的文件结构
        assetFileNames: 'assets/[name].[ext]',
      },
    },
  },
  // PWA 相关：确保 public 目录文件可访问
  publicDir: 'public',
})
