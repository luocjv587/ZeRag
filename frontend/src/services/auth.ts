import api from './api'
import type { TokenResponse, User, AdminUserInfo, PlatformStats } from '../types'

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

  async changePassword(oldPassword: string, newPassword: string): Promise<void> {
    await api.post('/api/v1/auth/change-password', {
      old_password: oldPassword,
      new_password: newPassword,
    })
  },

  async refreshToken(): Promise<TokenResponse> {
    const res = await api.post<TokenResponse>('/api/v1/auth/refresh')
    return res.data
  },

  // ── 管理员接口 ────────────────────────────────────────────────────────────

  async adminListUsers(): Promise<AdminUserInfo[]> {
    const res = await api.get<AdminUserInfo[]>('/api/v1/admin/users')
    return res.data
  },

  async adminCreateUser(data: {
    username: string
    password: string
    is_admin?: boolean
  }): Promise<AdminUserInfo> {
    const res = await api.post<AdminUserInfo>('/api/v1/admin/users', data)
    return res.data
  },

  async adminUpdateUser(
    uid: number,
    data: { is_active?: boolean; is_admin?: boolean; username?: string },
  ): Promise<AdminUserInfo> {
    const res = await api.patch<AdminUserInfo>(`/api/v1/admin/users/${uid}`, data)
    return res.data
  },

  async adminDeleteUser(uid: number): Promise<void> {
    await api.delete(`/api/v1/admin/users/${uid}`)
  },

  async adminResetPassword(uid: number, newPassword: string): Promise<void> {
    await api.post(`/api/v1/admin/users/${uid}/reset-password`, {
      new_password: newPassword,
    })
  },

  async adminGetStats(): Promise<PlatformStats> {
    const res = await api.get<PlatformStats>('/api/v1/admin/stats')
    return res.data
  },
}
