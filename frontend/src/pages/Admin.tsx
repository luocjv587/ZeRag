import { useState, useEffect } from 'react'
import type { AdminUserInfo, PlatformStats } from '../types'
import { authService } from '../services/auth'
import { useAuth } from '../contexts/AuthContext'
import { Navigate } from 'react-router-dom'

// ── 小工具 ──────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <div className="card px-5 py-4">
      <p className="text-xs text-apple-gray-400">{label}</p>
      <p className="text-2xl font-semibold text-apple-black mt-1">{value}</p>
      {sub && <p className="text-[10px] text-apple-gray-300 mt-0.5">{sub}</p>}
    </div>
  )
}

// ── 创建/编辑用户弹窗 ─────────────────────────────────────────────────────────

interface UserFormProps {
  mode: 'create' | 'edit' | 'reset'
  user?: AdminUserInfo
  onClose: () => void
  onSuccess: () => void
  showToast: (msg: string) => void
}

function UserModal({ mode, user, onClose, onSuccess, showToast }: UserFormProps) {
  const [username, setUsername] = useState(user?.username ?? '')
  const [password, setPassword] = useState('')
  const [isAdmin, setIsAdmin] = useState(user?.is_admin ?? false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    if (mode === 'create') {
      if (!username.trim() || !password) { showToast('请填写用户名和密码'); return }
      setLoading(true)
      try {
        await authService.adminCreateUser({ username: username.trim(), password, is_admin: isAdmin })
        showToast('用户创建成功')
        onSuccess()
        onClose()
      } catch (e: unknown) {
        const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? '创建失败'
        showToast(msg)
      } finally { setLoading(false) }
    } else if (mode === 'edit' && user) {
      setLoading(true)
      try {
        const updates: { username?: string; is_admin?: boolean } = {}
        if (username.trim() !== user.username) updates.username = username.trim()
        if (isAdmin !== user.is_admin) updates.is_admin = isAdmin
        if (Object.keys(updates).length) {
          await authService.adminUpdateUser(user.id, updates)
        }
        showToast('已保存')
        onSuccess()
        onClose()
      } catch (e: unknown) {
        const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? '更新失败'
        showToast(msg)
      } finally { setLoading(false) }
    } else if (mode === 'reset' && user) {
      if (!password) { showToast('请输入新密码'); return }
      setLoading(true)
      try {
        await authService.adminResetPassword(user.id, password)
        showToast('密码已重置')
        onClose()
      } catch {
        showToast('重置失败')
      } finally { setLoading(false) }
    }
  }

  const titles = { create: '创建用户', edit: '编辑用户', reset: '重置密码' }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-apple-lg w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-apple-black">{titles[mode]}</h2>
          <button onClick={onClose} className="btn-ghost p-1">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="space-y-3">
          {mode !== 'reset' && (
            <input
              placeholder="用户名"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="input-base"
            />
          )}
          {(mode === 'create' || mode === 'reset') && (
            <input
              placeholder={mode === 'reset' ? '新密码（至少 6 位）' : '密码（至少 6 位）'}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-base"
            />
          )}
          {mode !== 'reset' && (
            <label className="flex items-center gap-2 px-1 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isAdmin}
                onChange={(e) => setIsAdmin(e.target.checked)}
                className="w-4 h-4 rounded accent-apple-black"
              />
              <span className="text-sm text-apple-gray-600">管理员权限</span>
            </label>
          )}
        </div>

        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="btn-secondary flex-1">取消</button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="btn-primary flex-1"
          >
            {loading ? '处理中…' : '确认'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── 主组件 ──────────────────────────────────────────────────────────────────

export default function Admin() {
  const { user: currentUser } = useAuth()
  const [users, setUsers] = useState<AdminUserInfo[]>([])
  const [stats, setStats] = useState<PlatformStats | null>(null)
  const [modal, setModal] = useState<{
    mode: 'create' | 'edit' | 'reset'
    user?: AdminUserInfo
  } | null>(null)
  const [toast, setToast] = useState('')
  const [toggling, setToggling] = useState<number | null>(null)
  const [deleting, setDeleting] = useState<number | null>(null)

  if (!currentUser?.is_admin) return <Navigate to="/" replace />

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 2500)
  }

  const fetchData = () => {
    authService.adminListUsers().then(setUsers).catch(() => {})
    authService.adminGetStats().then(setStats).catch(() => {})
  }

  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => { fetchData() }, [])

  const handleToggleActive = async (u: AdminUserInfo) => {
    if (u.id === currentUser?.id) { showToast('不能禁用自己的账号'); return }
    setToggling(u.id)
    try {
      await authService.adminUpdateUser(u.id, { is_active: !u.is_active })
      fetchData()
      showToast(u.is_active ? '已禁用' : '已启用')
    } finally { setToggling(null) }
  }

  const handleDelete = async (u: AdminUserInfo) => {
    if (!confirm(`确认删除用户「${u.username}」？此操作不可恢复。`)) return
    setDeleting(u.id)
    try {
      await authService.adminDeleteUser(u.id)
      fetchData()
      showToast('用户已删除')
    } catch {
      showToast('删除失败')
    } finally { setDeleting(null) }
  }

  return (
    <div className="p-4 md:p-8 pt-16 md:pt-8">
      {/* 标题 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 md:mb-8">
        <div>
          <h1 className="text-lg md:text-xl font-semibold text-apple-black">管理员后台</h1>
          <p className="text-xs md:text-sm text-apple-gray-400 mt-0.5">用户管理与平台统计</p>
        </div>
        <button
          onClick={() => setModal({ mode: 'create' })}
          className="btn-primary flex items-center justify-center gap-2 w-full sm:w-auto"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          创建用户
        </button>
      </div>

      {/* 统计卡片 */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6 md:mb-8">
          <StatCard label="总用户数" value={stats.total_users} sub={`${stats.active_users} 活跃`} />
          <StatCard label="数据源" value={stats.total_data_sources} />
          <StatCard label="问答总量" value={stats.total_qa_history} />
          <StatCard label="活跃账号" value={stats.active_users} sub={`${stats.total_users - stats.active_users} 已禁用`} />
        </div>
      )}

      {/* 用户列表 */}
      <div className="card overflow-hidden">
        <div className="px-5 py-3 border-b border-apple-gray-100 flex items-center justify-between">
          <p className="text-sm font-medium text-apple-black">用户列表</p>
          <p className="text-xs text-apple-gray-400">{users.length} 个用户</p>
        </div>
        <div className="divide-y divide-apple-gray-100">
          {users.length === 0 && (
            <p className="text-sm text-apple-gray-400 text-center py-10">暂无用户</p>
          )}
          {users.map((u) => (
            <div key={u.id} className="px-5 py-3.5 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 bg-apple-gray-100 rounded-full flex items-center justify-center shrink-0">
                  <span className="text-xs font-medium text-apple-gray-600">
                    {u.username.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-apple-black">{u.username}</span>
                    {u.is_admin && (
                      <span className="text-[9px] font-semibold text-white bg-apple-black rounded px-1.5 py-0.5 leading-none">
                        超管
                      </span>
                    )}
                    {u.id === currentUser?.id && (
                      <span className="text-[9px] text-apple-gray-400 border border-apple-gray-200 rounded px-1.5 py-0.5 leading-none">
                        当前
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-apple-gray-300 mt-0.5">
                    ID: {u.id} · 注册于 {new Date(u.created_at).toLocaleDateString('zh-CN')}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {/* 启用/禁用状态 */}
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  u.is_active
                    ? 'bg-green-50 text-green-600'
                    : 'bg-red-50 text-red-500'
                }`}>
                  {u.is_active ? '正常' : '已禁用'}
                </span>

                <button
                  onClick={() => setModal({ mode: 'edit', user: u })}
                  className="btn-ghost text-xs"
                >
                  编辑
                </button>
                <button
                  onClick={() => setModal({ mode: 'reset', user: u })}
                  className="btn-ghost text-xs"
                >
                  重置密码
                </button>
                <button
                  onClick={() => handleToggleActive(u)}
                  disabled={toggling === u.id || u.id === currentUser?.id}
                  className="btn-ghost text-xs"
                >
                  {toggling === u.id ? '…' : u.is_active ? '禁用' : '启用'}
                </button>
                <button
                  onClick={() => handleDelete(u)}
                  disabled={deleting === u.id || u.id === currentUser?.id}
                  className="btn-ghost text-xs text-red-400 hover:text-red-600 hover:bg-red-50"
                >
                  {deleting === u.id ? '…' : '删除'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 弹窗 */}
      {modal && (
        <UserModal
          mode={modal.mode}
          user={modal.user}
          onClose={() => setModal(null)}
          onSuccess={fetchData}
          showToast={showToast}
        />
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-apple-black text-white text-sm px-5 py-2.5 rounded-full shadow-apple-lg z-50">
          {toast}
        </div>
      )}
    </div>
  )
}
