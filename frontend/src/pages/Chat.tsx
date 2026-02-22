import { useState, useRef, useEffect, useCallback } from 'react'
import type { ChatMessage, DataSource, ConversationTurn, ChatMode } from '../types'
import ChatMessageItem from '../components/Chat/ChatMessage'
import { qaService } from '../services/qa'
import { dataSourceService } from '../services/dataSource'

// ── 会话持久化 key ──────────────────────────────────────────────────────────
const SESSION_KEY = 'zerag_chat_session'

interface SavedSession {
  messages: Omit<ChatMessage, 'timestamp'>[]
  selectedDsId?: number
  chatMode?: ChatMode
}

function loadSession(): { messages: ChatMessage[]; selectedDsId?: number; chatMode: ChatMode } {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    if (!raw) return { messages: [], chatMode: 'rag' }
    const parsed: SavedSession = JSON.parse(raw)
    return {
      messages: parsed.messages.map((m) => ({ ...m, timestamp: new Date() })),
      selectedDsId: parsed.selectedDsId,
      chatMode: parsed.chatMode ?? 'rag',
    }
  } catch {
    return { messages: [], chatMode: 'rag' }
  }
}

function saveSession(messages: ChatMessage[], selectedDsId?: number, chatMode: ChatMode = 'rag') {
  try {
    const data: SavedSession = {
      messages: messages
        .filter((m) => !m.loading)
        .map(({ timestamp: _ts, ...rest }) => rest),
      selectedDsId,
      chatMode,
    }
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(data))
  } catch { /* ignore */ }
}

// ── RAG 设置面板 ─────────────────────────────────────────────────────────────

interface RagSettings {
  enable_rewrite: boolean
  enable_hyde: boolean
  enable_sql_fallback: boolean
  top_k: number
}

const DEFAULT_SETTINGS: RagSettings = {
  enable_rewrite: true,
  enable_hyde: true,
  enable_sql_fallback: true,
  top_k: 5,
}

interface SettingsPanelProps {
  settings: RagSettings
  onChange: (s: RagSettings) => void
  onClose: () => void
}

function SettingsPanel({ settings, onChange, onClose }: SettingsPanelProps) {
  return (
    <div className="absolute right-0 top-full mt-2 z-30 bg-white rounded-2xl shadow-apple-lg border border-apple-gray-100 p-4 w-72">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-apple-black">RAG 参数设置</p>
        <button onClick={onClose} className="btn-ghost p-0.5">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      <div className="space-y-3">
        {/* Top K */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-apple-black font-medium">检索数量 (Top-K)</p>
            <p className="text-[10px] text-apple-gray-400">每次检索返回的片段数</p>
          </div>
          <select
            value={settings.top_k}
            onChange={(e) => onChange({ ...settings, top_k: Number(e.target.value) })}
            className="input-base w-16 text-xs py-1"
          >
            {[3, 5, 8, 10, 15].map((v) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
        </div>

        {/* 查询改写 */}
        <label className="flex items-center justify-between cursor-pointer">
          <div>
            <p className="text-xs text-apple-black font-medium">🔄 查询改写</p>
            <p className="text-[10px] text-apple-gray-400">AI 自动优化问题，提取关键词</p>
          </div>
          <button
            onClick={() => onChange({ ...settings, enable_rewrite: !settings.enable_rewrite })}
            className={`relative w-9 h-5 rounded-full transition-colors ${settings.enable_rewrite ? 'bg-apple-black' : 'bg-apple-gray-300'}`}
          >
            <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${settings.enable_rewrite ? 'translate-x-4' : 'translate-x-0.5'}`} />
          </button>
        </label>

        {/* HyDE */}
        <label className="flex items-center justify-between cursor-pointer">
          <div>
            <p className="text-xs text-apple-black font-medium">🧪 HyDE 增强</p>
            <p className="text-[10px] text-apple-gray-400">假设文档嵌入，提升召回率</p>
          </div>
          <button
            onClick={() => onChange({ ...settings, enable_hyde: !settings.enable_hyde })}
            className={`relative w-9 h-5 rounded-full transition-colors ${settings.enable_hyde ? 'bg-apple-black' : 'bg-apple-gray-300'}`}
          >
            <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${settings.enable_hyde ? 'translate-x-4' : 'translate-x-0.5'}`} />
          </button>
        </label>

        {/* SQL 兜底 */}
        <label className="flex items-center justify-between cursor-pointer">
          <div>
            <p className="text-xs text-apple-black font-medium">🗄️ SQL 兜底</p>
            <p className="text-[10px] text-apple-gray-400">相似度低时直接查源库（仅数据库数据源）</p>
          </div>
          <button
            onClick={() => onChange({ ...settings, enable_sql_fallback: !settings.enable_sql_fallback })}
            className={`relative w-9 h-5 rounded-full transition-colors ${settings.enable_sql_fallback ? 'bg-apple-black' : 'bg-apple-gray-300'}`}
          >
            <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${settings.enable_sql_fallback ? 'translate-x-4' : 'translate-x-0.5'}`} />
          </button>
        </label>
      </div>

      <button
        onClick={() => onChange(DEFAULT_SETTINGS)}
        className="mt-3 w-full text-xs text-apple-gray-400 hover:text-apple-gray-700 transition-colors"
      >
        恢复默认
      </button>
    </div>
  )
}

// ── 主组件 ───────────────────────────────────────────────────────────────────

export default function Chat() {
  const session = loadSession()
  const [messages, setMessages] = useState<ChatMessage[]>(session.messages)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [dataSources, setDataSources] = useState<DataSource[]>([])
  const [selectedDsId, setSelectedDsId] = useState<number | undefined>(session.selectedDsId)
  const [ragSettings, setRagSettings] = useState<RagSettings>(DEFAULT_SETTINGS)
  const [showSettings, setShowSettings] = useState(false)
  const [chatMode, setChatMode] = useState<ChatMode>(session.chatMode)
  const bottomRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<(() => void) | null>(null)
  const settingsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    dataSourceService.list().then(setDataSources).catch(() => {})
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // 会话持久化：消息变化时保存
  useEffect(() => {
    saveSession(messages, selectedDsId, chatMode)
  }, [messages, selectedDsId, chatMode])

  // 点击外部关闭设置面板
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setShowSettings(false)
      }
    }
    if (showSettings) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showSettings])

  /** 从当前 messages 中提取多轮对话历史 */
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
    setShowSettings(false)

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

    const conversationHistory = buildConversationHistory(messages)

    setMessages((prev) => [...prev, userMsg, loadingMsg])
    setLoading(true)

    const abort = qaService.askStream(
      {
        question,
        mode: chatMode,
        data_source_id: chatMode === 'rag' ? selectedDsId : undefined,
        top_k: ragSettings.top_k,
        enable_rewrite: ragSettings.enable_rewrite,
        enable_hyde: ragSettings.enable_hyde,
        enable_sql_fallback: ragSettings.enable_sql_fallback,
        conversation_history: conversationHistory,
      },
      (event) => {
        if (event.type === 'retrieval_done') {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsgId
                ? { ...m, loading: true, chunks: event.chunks, pipeline_log: event.pipeline_log }
                : m,
            ),
          )
        } else if (event.type === 'token') {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsgId
                ? { ...m, content: m.content + event.token, loading: true }
                : m,
            ),
          )
        } else if (event.type === 'done') {
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

  const handleClear = () => {
    if (loading) handleStop()
    setMessages([])
    sessionStorage.removeItem(SESSION_KEY)
  }

  // 判断当前设置是否非默认
  const hasCustomSettings =
    ragSettings.enable_rewrite !== DEFAULT_SETTINGS.enable_rewrite ||
    ragSettings.enable_hyde !== DEFAULT_SETTINGS.enable_hyde ||
    ragSettings.enable_sql_fallback !== DEFAULT_SETTINGS.enable_sql_fallback ||
    ragSettings.top_k !== DEFAULT_SETTINGS.top_k

  return (
    <div className="flex flex-col h-full">
      {/* 顶部栏 */}
      <div className="px-6 py-4 border-b border-apple-gray-200 flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold text-apple-black">
            {chatMode === 'chat' ? 'AI 对话' : '智能问答'}
          </h1>
          <p className="text-xs text-apple-gray-400 mt-0.5">
            {chatMode === 'chat'
              ? '与 AI 自由对话，无需选择数据源（支持多轮上下文）'
              : '基于数据源内容进行 AI 问答（支持多轮对话）'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {messages.length > 0 && (
            <button
              onClick={handleClear}
              className="btn-ghost text-xs text-apple-gray-400 hover:text-red-400"
              title="清空对话"
            >
              清空对话
            </button>
          )}

          {/* ── 模式切换 ── */}
          <div className="flex items-center bg-apple-gray-100 rounded-lg p-0.5">
            <button
              onClick={() => setChatMode('chat')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                chatMode === 'chat'
                  ? 'bg-white text-apple-black shadow-sm'
                  : 'text-apple-gray-400 hover:text-apple-gray-600'
              }`}
            >
              💬 AI 对话
            </button>
            <button
              onClick={() => setChatMode('rag')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                chatMode === 'rag'
                  ? 'bg-white text-apple-black shadow-sm'
                  : 'text-apple-gray-400 hover:text-apple-gray-600'
              }`}
            >
              📚 知识库
            </button>
          </div>

          {/* 数据源选择（仅 RAG 模式） */}
          {chatMode === 'rag' && (
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
          )}

          {/* RAG 设置按钮（仅 RAG 模式） */}
          {chatMode === 'rag' && (
            <div className="relative" ref={settingsRef}>
              <button
                onClick={() => setShowSettings((v) => !v)}
                title="RAG 参数设置"
                className={`btn-ghost px-2.5 py-2 flex items-center gap-1 ${hasCustomSettings ? 'text-blue-500' : ''}`}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
                </svg>
                {hasCustomSettings && <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />}
              </button>
              {showSettings && (
                <SettingsPanel
                  settings={ragSettings}
                  onChange={setRagSettings}
                  onClose={() => setShowSettings(false)}
                />
              )}
            </div>
          )}
        </div>
      </div>

      {/* 消息列表 */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center">
            <div className="w-14 h-14 bg-apple-gray-100 rounded-2xl flex items-center justify-center mb-4 text-2xl">
              {chatMode === 'chat' ? '💬' : '📚'}
            </div>
            <p className="text-sm font-medium text-apple-gray-500">
              {chatMode === 'chat' ? '开始 AI 对话' : '开始提问'}
            </p>
            <p className="text-xs text-apple-gray-300 mt-1">
              {chatMode === 'chat'
                ? '与 AI 自由聊天，支持写作、代码、分析等各类问题'
                : '向已同步的数据源提问，获取 AI 智能回答'}
            </p>
            <p className="text-xs text-apple-gray-300 mt-0.5">支持多轮对话，AI 会记住本次会话的上下文</p>
            {/* RAG 模式显示参数摘要 */}
            {chatMode === 'rag' && (
              <div className="mt-4 flex items-center gap-2 text-[10px] text-apple-gray-300">
                <span className={ragSettings.enable_rewrite ? 'text-green-500' : 'line-through'}>查询改写</span>
                <span>·</span>
                <span className={ragSettings.enable_hyde ? 'text-green-500' : 'line-through'}>HyDE</span>
                <span>·</span>
                <span className={ragSettings.enable_sql_fallback ? 'text-green-500' : 'line-through'}>SQL兜底</span>
                <span>·</span>
                <span>Top-{ragSettings.top_k}</span>
              </div>
            )}
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
            placeholder={chatMode === 'chat' ? '和 AI 聊聊吧，Enter 发送，Shift+Enter 换行…' : '输入问题，Enter 发送，Shift+Enter 换行…'}
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
