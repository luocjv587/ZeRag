import api from './api'
import type { AskRequest, AskResponse, QAHistory } from '../types'

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
}
