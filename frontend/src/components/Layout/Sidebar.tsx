import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { authService } from '../../services/auth'

const navItems = [
  {
    to: '/',
    label: '智能问答',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
      </svg>
    ),
  },
  {
    to: '/data-sources',
    label: '数据源',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <ellipse cx="12" cy="5" rx="9" ry="3" />
        <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
        <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
      </svg>
    ),
  },
  {
    to: '/history',
    label: '问答历史',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    ),
  },
]

const toolItems = [
  {
    to: '/tools',
    label: '工具箱',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" />
      </svg>
    ),
  },
]

// ── 修改密码弹窗 ──────────────────────────────────────────────────────────────

function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const [oldPwd, setOldPwd] = useState('')
  const [newPwd, setNewPwd] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const handleSubmit = async () => {
    setError('')
    if (!oldPwd || !newPwd || !confirm) { setError('请填写所有字段'); return }
    if (newPwd.length < 6) { setError('新密码至少 6 位'); return }
    if (newPwd !== confirm) { setError('两次输入的密码不一致'); return }
    setLoading(true)
    try {
      await authService.changePassword(oldPwd, newPwd)
      setSuccess(true)
      setTimeout(onClose, 1200)
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? '修改失败'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-apple-lg w-full max-w-sm p-4 md:p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-apple-black">修改密码</h2>
          <button onClick={onClose} className="btn-ghost p-1">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {success ? (
          <div className="text-center py-4">
            <div className="w-12 h-12 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <p className="text-sm text-apple-gray-600">密码修改成功</p>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              <input
                placeholder="原密码"
                type="password"
                value={oldPwd}
                onChange={(e) => setOldPwd(e.target.value)}
                className="input-base"
              />
              <input
                placeholder="新密码（至少 6 位）"
                type="password"
                value={newPwd}
                onChange={(e) => setNewPwd(e.target.value)}
                className="input-base"
              />
              <input
                placeholder="确认新密码"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                className="input-base"
              />
              {error && <p className="text-xs text-red-500">{error}</p>}
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={onClose} className="btn-secondary flex-1">取消</button>
              <button onClick={handleSubmit} disabled={loading} className="btn-primary flex-1">
                {loading ? '修改中…' : '确认修改'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── 主组件 ───────────────────────────────────────────────────────────────────

interface SidebarProps {
  isOpen?: boolean
  onClose?: () => void
}

export default function Sidebar({ isOpen = true, onClose }: SidebarProps) {
  const { user, logout } = useAuth()
  const [showChangePwd, setShowChangePwd] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)

  const handleNavClick = () => {
    // 移动端点击导航项后自动关闭侧边栏
    if (onClose && window.innerWidth < 768) {
      onClose()
    }
  }

  return (
    <>
      {/* 移动端遮罩层 */}
      {onClose && isOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-40 md:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`
          fixed md:static inset-y-0 left-0 z-50
          w-64 md:w-56 h-screen bg-apple-gray-50 border-r border-apple-gray-200
          flex flex-col shrink-0
          transform transition-transform duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
      >
        {/* 品牌 Logo */}
        <div className="px-5 py-6 border-b border-apple-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-apple-black rounded-lg flex items-center justify-center">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M4 6h16M4 10h10M4 14h12M4 18h8" stroke="white" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </div>
            <span className="font-semibold text-apple-black text-sm tracking-tight">ZeRag</span>
          </div>
          {/* 移动端关闭按钮 */}
          {onClose && (
            <button
              onClick={onClose}
              className="md:hidden p-1.5 rounded-lg hover:bg-apple-gray-200 transition-colors"
              aria-label="关闭菜单"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>

        {/* 主导航 */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              onClick={handleNavClick}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors duration-100 ${
                  isActive
                    ? 'bg-apple-black text-white'
                    : 'text-apple-gray-500 hover:bg-apple-gray-200 hover:text-apple-gray-900'
                }`
              }
            >
              {item.icon}
              {item.label}
            </NavLink>
          ))}

          {/* 工具箱分区 */}
          <div className="pt-3 pb-1">
            <p className="px-3 text-[10px] font-medium text-apple-gray-300 uppercase tracking-wider">工具</p>
          </div>
          {toolItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={handleNavClick}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors duration-100 ${
                  isActive
                    ? 'bg-apple-black text-white'
                    : 'text-apple-gray-500 hover:bg-apple-gray-200 hover:text-apple-gray-900'
                }`
              }
            >
              {item.icon}
              {item.label}
            </NavLink>
          ))}

          {/* 管理员入口 */}
          {user?.is_admin && (
            <>
              <div className="pt-3 pb-1">
                <p className="px-3 text-[10px] font-medium text-apple-gray-300 uppercase tracking-wider">管理</p>
              </div>
              <NavLink
                to="/admin"
                onClick={handleNavClick}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors duration-100 ${
                    isActive
                      ? 'bg-apple-black text-white'
                      : 'text-apple-gray-500 hover:bg-apple-gray-200 hover:text-apple-gray-900'
                  }`
                }
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 00-3-3.87" />
                  <path d="M16 3.13a4 4 0 010 7.75" />
                </svg>
                用户管理
              </NavLink>
            </>
          )}
        </nav>

        {/* 底部用户信息 */}
        <div className="px-4 py-4 border-t border-apple-gray-200">
          <div className="flex items-center justify-between">
            {/* 用户名 + 菜单 */}
            <button
              onClick={() => setShowUserMenu((v) => !v)}
              className="flex items-center gap-2.5 flex-1 min-w-0 rounded-lg hover:bg-apple-gray-200 px-1 py-1 transition-colors text-left"
            >
              <div className="w-7 h-7 bg-apple-gray-200 rounded-full flex items-center justify-center shrink-0">
                <span className="text-xs font-medium text-apple-gray-600">
                  {user?.username?.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="min-w-0">
                <span className="text-xs text-apple-gray-600 font-medium truncate block">{user?.username}</span>
                {user?.is_admin && (
                  <span className="text-[9px] font-semibold text-white bg-apple-black rounded px-1 py-0.5 leading-none">
                    超管
                  </span>
                )}
              </div>
            </button>

            {/* 退出按钮 */}
            <button
              onClick={logout}
              className="text-apple-gray-400 hover:text-apple-gray-700 transition-colors ml-1 shrink-0"
              title="退出登录"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </button>
          </div>

          {/* 用户下拉菜单 */}
          {showUserMenu && (
            <div className="mt-2 bg-white border border-apple-gray-200 rounded-xl shadow-sm overflow-hidden">
              <button
                onClick={() => { setShowChangePwd(true); setShowUserMenu(false) }}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-apple-gray-600 hover:bg-apple-gray-50 transition-colors text-left"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0110 0v4" />
                </svg>
                修改密码
              </button>
              <button
                onClick={() => { logout(); setShowUserMenu(false) }}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-red-500 hover:bg-red-50 transition-colors text-left"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
                退出登录
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* 修改密码弹窗 */}
      {showChangePwd && <ChangePasswordModal onClose={() => setShowChangePwd(false)} />}
    </>
  )
}
