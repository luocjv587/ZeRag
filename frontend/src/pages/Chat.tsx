import { useState, useRef, useEffect } from 'react'
import type { ChatMessage, DataSource } from '../types'
import ChatMessageItem from '../components/Chat/ChatMessage'
import { qaService } from '../services/qa'
import { dataSourceService } from '../services/dataSource'

export default function Chat() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [dataSources, setDataSources] = useState<DataSource[]>([])
  const [selectedDsId, setSelectedDsId] = useState<number | undefined>()
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    dataSourceService.list().then(setDataSources).catch(() => {})
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async () => {
    if (!input.trim() || loading) return

    const question = input.trim()
    setInput('')

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: question,
      timestamp: new Date(),
    }

    const loadingMsg: ChatMessage = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      loading: true,
    }

    setMessages((prev) => [...prev, userMsg, loadingMsg])
    setLoading(true)

    try {
      const res = await qaService.ask({
        question,
        data_source_id: selectedDsId,
        top_k: 5,
      })

      setMessages((prev) =>
        prev.map((m) =>
          m.id === loadingMsg.id
            ? {
                ...m,
                content: res.answer,
                loading: false,
                chunks: res.retrieved_chunks,
                pipeline_log: res.pipeline_log,
              }
            : m
        )
      )
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : '请求失败，请稍后重试'
      setMessages((prev) =>
        prev.map((m) =>
          m.id === loadingMsg.id
            ? { ...m, content: `⚠️ ${errorMsg}`, loading: false }
            : m
        )
      )
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* 顶部栏 */}
      <div className="px-6 py-4 border-b border-apple-gray-200 flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold text-apple-black">智能问答</h1>
          <p className="text-xs text-apple-gray-400 mt-0.5">基于数据源内容进行 AI 问答</p>
        </div>
        {/* 数据源选择 */}
        <select
          value={selectedDsId ?? ''}
          onChange={(e) => setSelectedDsId(e.target.value ? Number(e.target.value) : undefined)}
          className="input-base w-44 text-xs"
        >
          <option value="">全部数据源</option>
          {dataSources.map((ds) => (
            <option key={ds.id} value={ds.id}>{ds.name}</option>
          ))}
        </select>
      </div>

      {/* 消息列表 */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center">
            <div className="w-14 h-14 bg-apple-gray-100 rounded-2xl flex items-center justify-center mb-4">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#A0A0A0" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
              </svg>
            </div>
            <p className="text-sm font-medium text-apple-gray-500">开始提问</p>
            <p className="text-xs text-apple-gray-300 mt-1">向已同步的数据源提问，获取 AI 智能回答</p>
          </div>
        ) : (
          <>
            {messages.map((msg) => (
              <ChatMessageItem key={msg.id} message={msg} />
            ))}
            <div ref={bottomRef} />
          </>
        )}
      </div>

      {/* 输入区 */}
      <div className="px-6 py-4 border-t border-apple-gray-200">
        <div className="flex items-end gap-3">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入问题，Enter 发送，Shift+Enter 换行…"
            rows={1}
            className="input-base resize-none flex-1 leading-relaxed"
            style={{ maxHeight: '120px', overflowY: 'auto' }}
            onInput={(e) => {
              const el = e.currentTarget
              el.style.height = 'auto'
              el.style.height = `${el.scrollHeight}px`
            }}
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || loading}
            className="btn-primary px-4 py-2.5 shrink-0"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
