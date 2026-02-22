import { useState, useEffect } from 'react'
import type { QAHistory } from '../types'
import { qaService } from '../services/qa'

export default function History() {
  const [list, setList] = useState<QAHistory[]>([])
  const [expanded, setExpanded] = useState<number | null>(null)

  useEffect(() => {
    qaService.getHistory(50).then(setList).catch(() => {})
  }, [])

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-xl font-semibold text-apple-black">问答历史</h1>
        <p className="text-sm text-apple-gray-400 mt-0.5">共 {list.length} 条历史记录</p>
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
              <div className="px-5 py-4 flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-apple-black truncate">{item.question}</p>
                  <p className="text-xs text-apple-gray-400 mt-0.5 line-clamp-1">
                    {item.answer}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-[10px] text-apple-gray-300">
                    {new Date(item.created_at).toLocaleString('zh-CN')}
                  </span>
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
                <div className="border-t border-apple-gray-100 px-5 py-4 bg-apple-gray-50 space-y-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-apple-gray-400 mb-1.5 font-medium">问题</p>
                    <p className="text-sm text-apple-gray-800">{item.question}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-apple-gray-400 mb-1.5 font-medium">回答</p>
                    <p className="text-sm text-apple-gray-800 whitespace-pre-wrap leading-relaxed">{item.answer}</p>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
