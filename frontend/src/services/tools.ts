import api from './api'
import type { PdfConvertHistory } from '../types'

const BASE_URL = 'http://localhost:8000'

/**
 * PDF 转 Word
 * 提交后从返回的 JSON 历史记录获取 id，然后调用 download 接口触发浏览器下载。
 */
export async function convertPdfToWord(file: File): Promise<PdfConvertHistory> {
  const formData = new FormData()
  formData.append('file', file)

  const token = localStorage.getItem('zerag_token')
  const response = await fetch(`${BASE_URL}/api/tools/pdf-to-word`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  })

  if (!response.ok) {
    let msg = '转换失败'
    try {
      const json = await response.json()
      msg = json.detail || msg
    } catch {
      // ignore
    }
    throw new Error(msg)
  }

  const record: PdfConvertHistory = await response.json()
  // 转换完成后立即触发下载
  await downloadConvertedFile(record.id, record.converted_filename)
  return record
}

/**
 * 根据历史记录 ID 下载已转换的 Word 文件
 */
export async function downloadConvertedFile(historyId: number, filename: string): Promise<void> {
  const token = localStorage.getItem('zerag_token')
  const response = await fetch(`${BASE_URL}/api/tools/pdf-to-word/download/${historyId}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })

  if (!response.ok) {
    let msg = '下载失败'
    try {
      const json = await response.json()
      msg = json.detail || msg
    } catch {
      // ignore
    }
    throw new Error(msg)
  }

  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/**
 * 获取 PDF 转换历史记录列表
 */
export async function getPdfConvertHistory(limit = 50): Promise<PdfConvertHistory[]> {
  const res = await api.get<PdfConvertHistory[]>('/api/tools/pdf-to-word/history', {
    params: { limit },
  })
  return res.data
}
