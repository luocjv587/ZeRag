import { useState, useEffect } from 'react'
import type { QAHistory } from '../types'
import { qaService } from '../services/qa'

export default function History() {
  const [list, setList] = useState<QAHistory[]>([])
  const [expanded, setExpanded] = useState<number | null>(null)
  const [deleting, setDeleting] = useState<number | 'all' | null>(null)
  const [toast, setToast] = useState('')

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 2500)
  }

  const fetchList = () => qaService.getHistory(100).then(setList).catch(() => {})

  useEffect(() => { fetchList() }, [])

  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm('确认删除这条历史记录？')) return
    setDeleting(id)
    try {
      await qaService.deleteHistory(id)
      setList((prev) => prev.filter((item) => item.id !== id))
      if (expanded === id) setExpanded(null)
      showToast('已删除')
    } catch {
      showToast('删除失败')
    } finally {
      setDeleting(null)
    }
  }

  const handleClearAll = async () => {
    if (!confirm(`确认清空全部 ${list.length} 条历史记录？此操作不可恢复。`)) return
    setDeleting('all')
    try {
      await qaService.clearHistory()
      setList([])
      setExpanded(null)
      showToast('历史记录已清空')
    } catch {
      showToast('清空失败')
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div className="p-4 md:p-8 pt-16 md:pt-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 md:mb-8">
        <div>
          <h1 className="text-lg md:text-xl font-semibold text-apple-black">问答历史</h1>
          <p className="text-xs md:text-sm text-apple-gray-400 mt-0.5">共 {list.length} 条历史记录</p>
        </div>
        {list.length > 0 && (
          <button
            onClick={handleClearAll}
            disabled={deleting === 'all'}
            className="btn-ghost text-xs text-red-400 hover:text-red-600 hover:bg-red-50 w-full sm:w-auto"
          >
            {deleting === 'all' ? '清空中…' : '清空全部'}
          </button>
        )}
      </div>

      {list.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-14 h-14 bg-apple-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#A0A0A0" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </div>
          <p className="text-sm text-apple-gray-400">暂无问答历史</p>
        </div>
      ) : (
        <div className="space-y-2">
          {list.map((item) => (
            <div
              key={item.id}
              className="card overflow-hidden cursor-pointer"
              onClick={() => setExpanded(expanded === item.id ? null : item.id)}
            >
              <div className="px-4 md:px-5 py-4 flex items-start justify-between gap-3 md:gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-apple-black truncate">{item.question}</p>
                  <p className="text-xs text-apple-gray-400 mt-0.5 line-clamp-1">
                    {item.answer}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] text-apple-gray-300">
                    {new Date(item.created_at).toLocaleString('zh-CN')}
                  </span>
                  {/* 删除按钮 */}
                  <button
                    onClick={(e) => handleDelete(item.id, e)}
                    disabled={deleting === item.id}
                    className="text-apple-gray-300 hover:text-red-400 transition-colors p-1 rounded"
                    title="删除"
                  >
                    {deleting === item.id ? (
                      <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                      </svg>
                    ) : (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6l-1 14H6L5 6" />
                        <path d="M10 11v6M14 11v6" />
                        <path d="M9 6V4h6v2" />
                      </svg>
                    )}
                  </button>
                  <svg
                    width="14" height="14" viewBox="0 0 24 24" fill="none"
                    stroke="#A0A0A0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                    className={`transition-transform duration-200 ${expanded === item.id ? 'rotate-180' : ''}`}
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </div>
              </div>

              {/* 展开详情 */}
              {expanded === item.id && (
                <div className="border-t border-apple-gray-100 px-4 md:px-5 py-4 bg-apple-gray-50 space-y-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-apple-gray-400 mb-1.5 font-medium">问题</p>
                    <p className="text-sm text-apple-gray-800">{item.question}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-apple-gray-400 mb-1.5 font-medium">回答</p>
                    <p className="text-sm text-apple-gray-800 whitespace-pre-wrap leading-relaxed">{item.answer}</p>
                  </div>
                  {item.data_source_id && (
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-apple-gray-400 mb-1 font-medium">数据源 ID</p>
                      <p className="text-xs text-apple-gray-500">{item.data_source_id}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
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
