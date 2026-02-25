import { useState, useEffect } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showPrompt, setShowPrompt] = useState(false)
  const [isInstalled, setIsInstalled] = useState(false)

  useEffect(() => {
    // 检查是否已安装
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true)
      return
    }

    // 监听 beforeinstallprompt 事件
    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      // 延迟显示提示，避免立即打扰用户
      setTimeout(() => {
        const dismissed = localStorage.getItem('pwa-install-dismissed')
        if (!dismissed) {
          setShowPrompt(true)
        }
      }, 3000)
    }

    window.addEventListener('beforeinstallprompt', handler)

    return () => {
      window.removeEventListener('beforeinstallprompt', handler)
    }
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) return

    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice

    if (outcome === 'accepted') {
      setShowPrompt(false)
      setIsInstalled(true)
    }

    setDeferredPrompt(null)
  }

  const handleDismiss = () => {
    setShowPrompt(false)
    localStorage.setItem('pwa-install-dismissed', 'true')
    // 24小时后重新显示
    setTimeout(() => {
      localStorage.removeItem('pwa-install-dismissed')
    }, 24 * 60 * 60 * 1000)
  }

  // 如果已安装或没有提示，不显示
  if (isInstalled || !showPrompt || !deferredPrompt) {
    return null
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-80 z-50 animate-slide-up">
      <div className="bg-white rounded-2xl shadow-apple-lg border border-apple-gray-200 p-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-apple-black rounded-xl flex items-center justify-center shrink-0">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 6h16M4 10h10M4 14h12M4 18h8" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-apple-black mb-1">
              安装 ZeRag
            </h3>
            <p className="text-xs text-apple-gray-500 mb-3">
              将应用添加到主屏幕，获得更好的使用体验
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleInstall}
                className="btn-primary text-xs px-4 py-2 flex-1"
              >
                安装
              </button>
              <button
                onClick={handleDismiss}
                className="btn-ghost text-xs px-3 py-2"
              >
                稍后
              </button>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="text-apple-gray-400 hover:text-apple-gray-600 transition-colors shrink-0"
            aria-label="关闭"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
