import axios from 'axios'

const api = axios.create({
  // 生产环境通过 nginx 反代，使用相对路径；本地开发可通过 VITE_API_BASE_URL 指定
  baseURL: import.meta.env.VITE_API_BASE_URL ?? '',
  timeout: 60000,
})

// 请求拦截：自动附加 Token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('zerag_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// 响应拦截：401 自动跳转登录
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('zerag_token')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

export default api
