import { useState, useRef, useEffect, useCallback } from 'react'
import type { ChatMessage, DataSource, ConversationTurn } from '../types'
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
  const abortRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    dataSourceService.list().then(setDataSources).catch(() => {})
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  /** 从当前 messages 中提取多轮对话历史（不含 loading 中的消息） */
  const buildConversationHistory = useCallback(
    (currentMessages: ChatMessage[]): ConversationTurn[] => {
      return currentMessages
        .filter((m) => !m.loading && m.content)
        .map((m) => ({ role: m.role, content: m.content }))
    },
    [],
  )

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

    const assistantMsgId = (Date.now() + 1).toString()
    const loadingMsg: ChatMessage = {
      id: assistantMsgId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      loading: true,
    }

    // 在加入新消息前先构建历史（不含本次 user 消息）
    const conversationHistory = buildConversationHistory(messages)

    setMessages((prev) => [...prev, userMsg, loadingMsg])
    setLoading(true)

    // 使用流式接口
    const abort = qaService.askStream(
      {
        question,
        data_source_id: selectedDsId,
        top_k: 5,
        conversation_history: conversationHistory,
      },
      (event) => {
        if (event.type === 'retrieval_done') {
          // 检索完成，预填充 chunks 信息，内容仍为空（等待 token）
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsgId
                ? {
                    ...m,
                    loading: true,
                    chunks: event.chunks,
                    pipeline_log: event.pipeline_log,
                  }
                : m,
            ),
          )
        } else if (event.type === 'token') {
          // 逐 token 追加内容，loading 保持 true（显示光标）
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsgId
                ? { ...m, content: m.content + event.token, loading: true }
                : m,
            ),
          )
        } else if (event.type === 'done') {
          // 生成完毕，关闭 loading
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsgId
                ? { ...m, content: event.answer, loading: false }
                : m,
            ),
          )
          setLoading(false)
        } else if (event.type === 'error') {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsgId
                ? { ...m, content: `⚠️ ${event.message}`, loading: false }
                : m,
            ),
          )
          setLoading(false)
        }
      },
      (err) => {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId
              ? { ...m, content: `⚠️ ${err.message}`, loading: false }
              : m,
          ),
        )
        setLoading(false)
      },
    )

    abortRef.current = abort
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  /** 停止当前生成 */
  const handleStop = () => {
    abortRef.current?.()
    abortRef.current = null
    setMessages((prev) =>
      prev.map((m) =>
        m.loading ? { ...m, loading: false, content: m.content || '（已停止）' } : m,
      ),
    )
    setLoading(false)
  }

  /** 清空对话 */
  const handleClear = () => {
    if (loading) handleStop()
    setMessages([])
  }

  return (
    <div className="flex flex-col h-full">
      {/* 顶部栏 */}
      <div className="px-6 py-4 border-b border-apple-gray-200 flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold text-apple-black">智能问答</h1>
          <p className="text-xs text-apple-gray-400 mt-0.5">基于数据源内容进行 AI 问答（支持多轮对话）</p>
        </div>
        <div className="flex items-center gap-3">
          {/* 清空对话 */}
          {messages.length > 0 && (
            <button
              onClick={handleClear}
              className="btn-ghost text-xs text-apple-gray-400 hover:text-red-400"
              title="清空对话"
            >
              清空对话
            </button>
          )}
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
            <p className="text-xs text-apple-gray-300 mt-0.5">支持多轮对话，AI 会记住本次会话的上下文</p>
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
        {/* 多轮对话提示 */}
        {messages.filter((m) => !m.loading).length >= 2 && (
          <div className="flex items-center gap-1.5 mb-2">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400"></span>
            <span className="text-[10px] text-apple-gray-300">
              多轮对话已开启 · 已积累 {Math.floor(messages.filter((m) => !m.loading).length / 2)} 轮上下文
            </span>
          </div>
        )}
        <div className="flex items-end gap-3">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入问题，Enter 发送，Shift+Enter 换行…"
            rows={1}
            disabled={loading && input === ''}
            className="input-base resize-none flex-1 leading-relaxed"
            style={{ maxHeight: '120px', overflowY: 'auto' }}
            onInput={(e) => {
              const el = e.currentTarget
              el.style.height = 'auto'
              el.style.height = `${el.scrollHeight}px`
            }}
          />
          {loading ? (
            <button
              onClick={handleStop}
              className="btn-secondary px-4 py-2.5 shrink-0 flex items-center gap-1.5"
              title="停止生成"
            >
              <span className="w-3 h-3 border-2 border-current rounded-sm" />
              停止
            </button>
          ) : (
            <button
              onClick={sendMessage}
              disabled={!input.trim()}
              className="btn-primary px-4 py-2.5 shrink-0"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
