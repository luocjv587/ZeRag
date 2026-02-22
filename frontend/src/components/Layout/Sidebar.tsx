import { NavLink } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'

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

export default function Sidebar() {
  const { user, logout } = useAuth()

  return (
    <aside className="w-56 h-screen bg-apple-gray-50 border-r border-apple-gray-200 flex flex-col shrink-0">
      {/* 品牌 Logo */}
      <div className="px-5 py-6 border-b border-apple-gray-200">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-apple-black rounded-lg flex items-center justify-center">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M4 6h16M4 10h10M4 14h12M4 18h8" stroke="white" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
          <span className="font-semibold text-apple-black text-sm tracking-tight">ZeRag</span>
        </div>
      </div>

      {/* 主导航 */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
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
      </nav>

      {/* 底部用户信息 */}
      <div className="px-4 py-4 border-t border-apple-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-apple-gray-200 rounded-full flex items-center justify-center">
              <span className="text-xs font-medium text-apple-gray-600">
                {user?.username?.charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <span className="text-xs text-apple-gray-600 font-medium">{user?.username}</span>
              {user?.is_admin && (
                <span className="ml-1.5 inline-block text-[9px] font-semibold text-white bg-apple-black rounded px-1 py-0.5 leading-none align-middle">
                  超管
                </span>
              )}
            </div>
          </div>
          <button
            onClick={logout}
            className="text-apple-gray-400 hover:text-apple-gray-700 transition-colors"
            title="退出登录"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
        </div>
      </div>
    </aside>
  )
}
