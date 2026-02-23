import api from './api'
import type { AskRequest, AskResponse, QAHistory, StreamEvent } from '../types'

export const qaService = {
  async ask(data: AskRequest): Promise<AskResponse> {
    const res = await api.post<AskResponse>('/api/v1/qa/ask', data)
    return res.data
  },

  async getHistory(limit = 50, dataSourceId?: number): Promise<QAHistory[]> {
    const params: Record<string, unknown> = { limit }
    if (dataSourceId) params.data_source_id = dataSourceId
    const res = await api.get<QAHistory[]>('/api/v1/qa/history', { params })
    return res.data
  },

  async deleteHistory(id: number): Promise<void> {
    await api.delete(`/api/v1/qa/history/${id}`)
  },

  async clearHistory(dataSourceId?: number): Promise<void> {
    const params: Record<string, unknown> = {}
    if (dataSourceId) params.data_source_id = dataSourceId
    await api.delete('/api/v1/qa/history', { params })
  },

  /**
   * 流式问答：通过 Server-Sent Events 逐 token 接收回答
   * onEvent 回调每收到一个事件就调用一次
   * 返回一个 abort 函数可中断请求
   */
  askStream(
    data: AskRequest,
    onEvent: (event: StreamEvent) => void,
    onError?: (err: Error) => void,
  ): () => void {
    const controller = new AbortController()
    const token = localStorage.getItem('zerag_token')

    const run = async () => {
      try {
        const response = await fetch('http://localhost:8000/api/v1/qa/ask/stream', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(data),
          signal: controller.signal,
        })

        if (!response.ok) {
          if (response.status === 401) {
            localStorage.removeItem('zerag_token')
            window.location.href = '/login'
            return
          }
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }

        const reader = response.body!.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          // SSE 格式：每个事件以 \n\n 结尾
          const parts = buffer.split('\n\n')
          buffer = parts.pop() ?? ''

          for (const part of parts) {
            const line = part.trim()
            if (line.startsWith('data: ')) {
              try {
                const event = JSON.parse(line.slice(6)) as StreamEvent
                onEvent(event)
              } catch {
                // 忽略解析失败的行
              }
            }
          }
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') return
        onError?.(err instanceof Error ? err : new Error(String(err)))
      }
    }

    run()
    return () => controller.abort()
  },
}
