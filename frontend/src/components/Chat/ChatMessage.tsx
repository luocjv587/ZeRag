import { useState } from 'react'
import type { ChatMessage as ChatMessageType } from '../../types'

interface Props {
  message: ChatMessageType
}

export default function ChatMessage({ message }: Props) {
  const isUser = message.role === 'user'
  const [expanded, setExpanded] = useState(false)
  const hasChunks = !isUser && message.chunks && message.chunks.length > 0

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-5`}>
      {/* AI 头像 */}
      {!isUser && (
        <div className="w-7 h-7 bg-apple-black rounded-full flex items-center justify-center mr-2.5 mt-0.5 shrink-0">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
            <path d="M4 6h16M4 10h10M4 14h12M4 18h8" stroke="white" strokeWidth="2.2" strokeLinecap="round" />
          </svg>
        </div>
      )}

      <div className={`max-w-[76%] flex flex-col gap-1.5 ${isUser ? 'items-end' : 'items-start'}`}>

        {/* 消息气泡 */}
        {message.loading ? (
          <div className="bubble-ai">
            <div className="flex items-center gap-1.5 py-0.5">
              <span className="w-1.5 h-1.5 bg-apple-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 bg-apple-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 bg-apple-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        ) : (
          <div className={isUser ? 'bubble-user' : 'bubble-ai'}>
            <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
          </div>
        )}

        {/* 引用来源区域 */}
        {hasChunks && !message.loading && (
          <div className="w-full">
            {/* 展开/收起按钮 */}
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-1.5 text-xs text-apple-gray-400 hover:text-apple-gray-600 transition-colors duration-150 px-1 py-0.5 rounded-md hover:bg-apple-gray-100"
            >
              <svg
                width="12" height="12" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                className={`transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`}
              >
                <polyline points="9 18 15 12 9 6" />
              </svg>
              <span>
                {expanded ? '收起' : '查看'}引用原文
                <span className="ml-1 bg-apple-gray-200 text-apple-gray-500 px-1.5 py-0.5 rounded-full text-[10px]">
                  {message.chunks!.length}
                </span>
              </span>
            </button>

            {/* 引用内容列表 */}
            {expanded && (
              <div className="mt-1.5 space-y-2">
                {message.chunks!.map((chunk, i) => (
                  <div
                    key={i}
                    className="bg-apple-gray-50 border border-apple-gray-200 rounded-xl px-4 py-3"
                  >
                    {/* 标题栏：序号 + 来源 + 相似度 */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 bg-apple-gray-200 rounded-full flex items-center justify-center text-[10px] font-semibold text-apple-gray-600 shrink-0">
                          {i + 1}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#A0A0A0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <ellipse cx="12" cy="5" rx="9" ry="3" />
                            <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
                            <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
                          </svg>
                          <span className="text-[11px] text-apple-gray-500 font-medium">{chunk.table_name}</span>
                          {chunk.row_id && (
                            <span className="text-[10px] text-apple-gray-300">#{chunk.row_id}</span>
                          )}
                        </div>
                      </div>
                      {/* 相似度进度条 */}
                      <div className="flex items-center gap-1.5">
                        <div className="w-16 h-1 bg-apple-gray-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-apple-black rounded-full"
                            style={{ width: `${Math.round(chunk.similarity * 100)}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-apple-gray-400 w-8 text-right">
                          {Math.round(chunk.similarity * 100)}%
                        </span>
                      </div>
                    </div>

                    {/* 检索来源标签 */}
                    {chunk.source && (
                      <div className="mb-1.5">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                          chunk.source === 'keyword'
                            ? 'bg-green-50 text-green-600'
                            : chunk.source === 'hyde'
                            ? 'bg-purple-50 text-purple-600'
                            : 'bg-blue-50 text-blue-500'
                        }`}>
                          {chunk.source === 'keyword' ? '🔑 关键词精确命中'
                            : chunk.source === 'hyde' ? '🧠 HyDE语义命中'
                            : '🔍 向量语义检索'}
                        </span>
                      </div>
                    )}

                    {/* 原文内容 */}
                    <p className="text-xs text-apple-gray-700 leading-relaxed whitespace-pre-wrap break-words font-mono bg-white border border-apple-gray-100 rounded-lg px-3 py-2 max-h-40 overflow-y-auto">
                      {chunk.chunk_text}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {/* Pipeline 调试信息 */}
            {message.pipeline_log && message.pipeline_log.length > 0 && (
              <details className="mt-1">
                <summary className="text-[10px] text-apple-gray-300 cursor-pointer hover:text-apple-gray-400 px-1">
                  查看检索流水线
                </summary>
                <div className="mt-1 space-y-1">
                  {message.pipeline_log.map((step, i) => (
                    <div key={i} className="text-[10px] text-apple-gray-400 bg-apple-gray-50 rounded px-2 py-1 font-mono">
                      <span className="text-apple-gray-600 font-semibold">{step.step}</span>
                      {!!step.keywords && <span className="ml-1">关键词: {String((step.keywords as string[]).join(', '))}</span>}
                      {step.hits !== undefined && <span className="ml-1">命中: {String(step.hits)}</span>}
                      {step.max_similarity !== undefined && <span className="ml-1">最高相似度: {String(step.max_similarity)}</span>}
                      {!!step.reason && <span className="ml-1 text-orange-400">触发原因: {String(step.reason)}</span>}
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>
        )}

        {/* 时间戳 */}
        <span className="text-[10px] text-apple-gray-300 px-1">
          {message.timestamp.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>

      {/* 用户头像 */}
      {isUser && (
        <div className="w-7 h-7 bg-apple-gray-200 rounded-full flex items-center justify-center ml-2.5 mt-0.5 shrink-0">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6E6E6E" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        </div>
      )}
    </div>
  )
}
