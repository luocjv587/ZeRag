import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import type { ChatMessage as ChatMessageType } from '../../types'

interface Props {
  message: ChatMessageType
}

// ── 复制代码按钮 ─────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }
  return (
    <button
      onClick={handleCopy}
      className="absolute top-2.5 right-2.5 text-[10px] px-2 py-0.5 rounded bg-white/10 text-gray-400 hover:text-white hover:bg-white/20 transition-colors"
    >
      {copied ? '已复制' : '复制'}
    </button>
  )
}

// ── Markdown 渲染器 ──────────────────────────────────────────────────────────

function MarkdownContent({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeHighlight]}
      components={{
        // 段落
        p({ children }) {
          return <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>
        },
        // 一级标题
        h1({ children }) {
          return <h1 className="text-base font-bold text-apple-black mt-4 mb-2 first:mt-0 border-b border-apple-gray-200 pb-1">{children}</h1>
        },
        // 二级标题
        h2({ children }) {
          return <h2 className="text-sm font-semibold text-apple-black mt-3.5 mb-1.5 first:mt-0">{children}</h2>
        },
        // 三级标题
        h3({ children }) {
          return <h3 className="text-sm font-medium text-apple-gray-800 mt-3 mb-1 first:mt-0">{children}</h3>
        },
        // 无序列表
        ul({ children }) {
          return <ul className="list-disc pl-5 mb-2 space-y-0.5">{children}</ul>
        },
        // 有序列表
        ol({ children }) {
          return <ol className="list-decimal pl-5 mb-2 space-y-0.5">{children}</ol>
        },
        // 列表项
        li({ children }) {
          return <li className="text-sm leading-relaxed">{children}</li>
        },
        // 行内代码
        code({ className, children, ...props }) {
          const isBlock = className?.startsWith('language-')
          const codeText = String(children).replace(/\n$/, '')

          if (isBlock) {
            const lang = className?.replace('language-', '') ?? ''
            return (
              <div className="relative my-3 rounded-xl overflow-hidden">
                {/* 顶部栏 */}
                <div className="flex items-center justify-between px-4 py-2 bg-[#1e1e2e]">
                  <span className="text-[10px] text-gray-400 font-mono uppercase tracking-wider">{lang || 'code'}</span>
                  <CopyButton text={codeText} />
                </div>
                {/* 代码区 */}
                <code
                  className={`${className} block bg-[#1e1e2e] text-[#cdd6f4] text-xs leading-relaxed px-4 py-3 overflow-x-auto font-mono`}
                  {...props}
                >
                  {children}
                </code>
              </div>
            )
          }

          return (
            <code
              className="inline-block bg-apple-gray-100 text-[#c0392b] text-[0.8em] font-mono px-1.5 py-0.5 rounded-md mx-0.5"
              {...props}
            >
              {children}
            </code>
          )
        },
        // 预格式化代码块（fallback）
        pre({ children }) {
          return <>{children}</>
        },
        // 引用块
        blockquote({ children }) {
          return (
            <blockquote className="border-l-[3px] border-apple-gray-300 pl-3 my-2 text-apple-gray-500 italic">
              {children}
            </blockquote>
          )
        },
        // 粗体
        strong({ children }) {
          return <strong className="font-semibold text-apple-black">{children}</strong>
        },
        // 斜体
        em({ children }) {
          return <em className="italic text-apple-gray-700">{children}</em>
        },
        // 分割线
        hr() {
          return <hr className="my-3 border-apple-gray-200" />
        },
        // 链接
        a({ href, children }) {
          return (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 hover:text-blue-600 underline underline-offset-2 transition-colors"
            >
              {children}
            </a>
          )
        },
        // 表格
        table({ children }) {
          return (
            <div className="overflow-x-auto my-3 rounded-xl border border-apple-gray-200">
              <table className="min-w-full text-xs">{children}</table>
            </div>
          )
        },
        thead({ children }) {
          return <thead className="bg-apple-gray-50 border-b border-apple-gray-200">{children}</thead>
        },
        tbody({ children }) {
          return <tbody className="divide-y divide-apple-gray-100">{children}</tbody>
        },
        tr({ children }) {
          return <tr className="hover:bg-apple-gray-50 transition-colors">{children}</tr>
        },
        th({ children }) {
          return <th className="px-3 py-2 text-left font-semibold text-apple-gray-600 whitespace-nowrap">{children}</th>
        },
        td({ children }) {
          return <td className="px-3 py-2 text-apple-gray-700">{children}</td>
        },
      }}
    >
      {content}
    </ReactMarkdown>
  )
}

// ── 主组件 ───────────────────────────────────────────────────────────────────

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
        {message.loading && !message.content ? (
          /* 纯 loading 状态：只显示跳动点 */
          <div className="bubble-ai">
            <div className="flex items-center gap-1.5 py-0.5">
              <span className="w-1.5 h-1.5 bg-apple-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 bg-apple-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 bg-apple-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        ) : isUser ? (
          /* 用户消息：纯文本即可 */
          <div className="bubble-user">
            <p className="whitespace-pre-wrap leading-relaxed text-sm">{message.content}</p>
          </div>
        ) : (
          /* AI 消息：Markdown 渲染 */
          <div className="bubble-ai text-sm">
            <MarkdownContent content={message.content} />
            {/* 流式输出光标 */}
            {message.loading && (
              <span className="inline-block w-0.5 h-3.5 bg-apple-gray-500 ml-0.5 animate-pulse align-middle" />
            )}
          </div>
        )}

        {/* 引用来源区域 */}
        {hasChunks && !message.loading && (
          <div className="w-full">
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

            {expanded && (
              <div className="mt-1.5 space-y-2">
                {message.chunks!.map((chunk, i) => (
                  <div key={i} className="bg-apple-gray-50 border border-apple-gray-200 rounded-xl px-4 py-3">
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

                    <p className="text-xs text-apple-gray-700 leading-relaxed whitespace-pre-wrap break-words font-mono bg-white border border-apple-gray-100 rounded-lg px-3 py-2 max-h-40 overflow-y-auto">
                      {chunk.chunk_text}
                    </p>
                  </div>
                ))}
              </div>
            )}

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
