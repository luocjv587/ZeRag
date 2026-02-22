import api from './api'
import type { TokenResponse, User } from '../types'

export const authService = {
  async login(username: string, password: string): Promise<TokenResponse> {
    const res = await api.post<TokenResponse>('/api/v1/auth/login', { username, password })
    return res.data
  },

  async register(username: string, password: string): Promise<TokenResponse> {
    const res = await api.post<TokenResponse>('/api/v1/auth/register', { username, password })
    return res.data
  },

  async getMe(): Promise<User> {
    const res = await api.get<User>('/api/v1/auth/me')
    return res.data
  },
}
