import api from './api'
import type { DataSource, DataSourceCreate, DataSourceUpdate, SyncStatus, ChunkListResponse } from '../types'

export const dataSourceService = {
  async list(): Promise<DataSource[]> {
    const res = await api.get<DataSource[]>('/api/v1/data-sources')
    return res.data
  },

  async create(data: DataSourceCreate): Promise<DataSource> {
    const res = await api.post<DataSource>('/api/v1/data-sources', data)
    return res.data
  },

  async update(id: number, data: DataSourceUpdate): Promise<DataSource> {
    const res = await api.put<DataSource>(`/api/v1/data-sources/${id}`, data)
    return res.data
  },

  async delete(id: number): Promise<void> {
    await api.delete(`/api/v1/data-sources/${id}`)
  },

  async testConnection(id: number): Promise<{ success: boolean; message: string }> {
    const res = await api.post(`/api/v1/data-sources/${id}/test-connection`)
    return res.data
  },

  async sync(id: number): Promise<{ message: string }> {
    const res = await api.post(`/api/v1/data-sources/${id}/sync`)
    return res.data
  },

  async getSyncStatus(id: number): Promise<SyncStatus> {
    const res = await api.get<SyncStatus>(`/api/v1/data-sources/${id}/sync-status`)
    return res.data
  },

  async uploadFiles(id: number, files: File[]): Promise<DataSource> {
    const formData = new FormData()
    files.forEach((file) => formData.append('files', file))
    const res = await api.post<DataSource>(`/api/v1/data-sources/${id}/upload-files`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return res.data
  },

  async deleteFile(id: number, filename: string): Promise<DataSource> {
    const res = await api.delete<DataSource>(
      `/api/v1/data-sources/${id}/files/${encodeURIComponent(filename)}`
    )
    return res.data
  },

  async getChunks(
    id: number,
    page = 1,
    pageSize = 20,
    q?: string,
  ): Promise<ChunkListResponse> {
    const params: Record<string, unknown> = { page, page_size: pageSize }
    if (q) params.q = q
    const res = await api.get<ChunkListResponse>(`/api/v1/data-sources/${id}/chunks`, { params })
    return res.data
  },
}
