import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

type Mode = 'login' | 'register'

export default function Login() {
  const [mode, setMode] = useState<Mode>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login, register } = useAuth()
  const navigate = useNavigate()

  const switchMode = (m: Mode) => {
    setMode(m)
    setError('')
    setUsername('')
    setPassword('')
    setConfirmPassword('')
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!username || !password) {
      setError('请输入用户名和密码')
      return
    }
    if (mode === 'register') {
      if (password !== confirmPassword) {
        setError('两次输入的密码不一致')
        return
      }
      if (password.length < 6) {
        setError('密码长度不能少于 6 位')
        return
      }
    }

    setLoading(true)
    setError('')
    try {
      if (mode === 'login') {
        await login(username, password)
      } else {
        await register(username, password)
      }
      navigate('/')
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message)
      } else {
        setError(mode === 'login' ? '用户名或密码错误' : '注册失败，请稍后重试')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo / 标题 */}
        <div className="mb-10 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-apple-black rounded-2xl mb-6">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path
                d="M4 6h16M4 10h10M4 14h12M4 18h8"
                stroke="white"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-semibold text-apple-black tracking-tight">ZeRag</h1>
          <p className="mt-1.5 text-sm text-apple-gray-400">智能数据库问答平台</p>
        </div>

        {/* 登录 / 注册 Tab */}
        <div className="flex bg-apple-gray-100 rounded-xl p-1 mb-6">
          <button
            type="button"
            onClick={() => switchMode('login')}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all duration-150 ${
              mode === 'login'
                ? 'bg-white text-apple-black shadow-sm'
                : 'text-apple-gray-400 hover:text-apple-gray-600'
            }`}
          >
            登录
          </button>
          <button
            type="button"
            onClick={() => switchMode('register')}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all duration-150 ${
              mode === 'register'
                ? 'bg-white text-apple-black shadow-sm'
                : 'text-apple-gray-400 hover:text-apple-gray-600'
            }`}
          >
            注册
          </button>
        </div>

        {/* 表单 */}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <input
              type="text"
              placeholder="用户名"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="input-base"
              autoComplete="username"
              autoFocus
            />
          </div>
          <div>
            <input
              type="password"
              placeholder="密码"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-base"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />
          </div>

          {/* 注册时显示确认密码 */}
          {mode === 'register' && (
            <div>
              <input
                type="password"
                placeholder="确认密码"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="input-base"
                autoComplete="new-password"
              />
            </div>
          )}

          {/* 错误提示 */}
          {error && (
            <p className="text-xs text-red-500 text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full mt-1"
          >
            {loading ? (
              <span className="inline-flex items-center justify-center gap-2">
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
                {mode === 'login' ? '登录中...' : '注册中...'}
              </span>
            ) : mode === 'login' ? '登录' : '注册并登录'}
          </button>
        </form>

        {mode === 'register' && (
          <p className="mt-4 text-center text-xs text-apple-gray-300">
            注册即表示你同意使用平台服务，注册账号为普通用户权限
          </p>
        )}

        <p className="mt-8 text-center text-xs text-apple-gray-300">
          ZeRag · Powered by 通义千问
        </p>
      </div>
    </div>
  )
}
