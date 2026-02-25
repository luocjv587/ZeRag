/**
 * API 基础 URL 配置
 * 
 * 开发环境：使用 http://localhost:8000（通过 Vite proxy）
 * 生产环境：使用 /api（相对路径，通过反向代理到后端 8000 端口）
 */
export const API_BASE_URL = import.meta.env.DEV
  ? 'http://localhost:8000'
  : '/api'
