import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import type { User } from '../types'
import { authService } from '../services/auth'

interface AuthContextType {
  user: User | null
  loading: boolean
  login: (username: string, password: string) => Promise<void>
  register: (username: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('zerag_token')
    if (token) {
      authService.getMe()
        .then(setUser)
        .catch(() => localStorage.removeItem('zerag_token'))
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [])

  const login = async (username: string, password: string) => {
    const data = await authService.login(username, password)
    localStorage.setItem('zerag_token', data.access_token)
    const me = await authService.getMe()
    setUser(me)
  }

  const register = async (username: string, password: string) => {
    try {
      const data = await authService.register(username, password)
      localStorage.setItem('zerag_token', data.access_token)
      const me = await authService.getMe()
      setUser(me)
    } catch (err: unknown) {
      // 将后端错误消息透传给调用方
      if (err && typeof err === 'object' && 'response' in err) {
        const axiosErr = err as { response?: { data?: { detail?: string } } }
        const detail = axiosErr.response?.data?.detail
        if (detail) throw new Error(detail)
      }
      throw err
    }
  }

  const logout = () => {
    localStorage.removeItem('zerag_token')
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
