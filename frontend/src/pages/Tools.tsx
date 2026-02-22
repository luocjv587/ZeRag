import { useState, useRef, useCallback, useEffect } from 'react'
import { convertPdfToWord, getPdfConvertHistory, downloadConvertedFile } from '../services/tools'
import type { PdfConvertHistory } from '../types'

// ─── 主工具箱组件 ─────────────────────────────────────────────────────────────
export default function Tools() {
  // 用于通知历史面板刷新的信号
  const [refreshSignal, setRefreshSignal] = useState(0)

  return (
    <div className="p-8 max-w-5xl">
      {/* 页头 */}
      <div className="mb-8">
        <h1 className="text-xl font-semibold text-apple-black">工具箱</h1>
        <p className="text-sm text-apple-gray-400 mt-0.5">常用文档处理小工具，开箱即用</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* 左：工具卡片 */}
        <div className="grid grid-cols-1 gap-4">
          <PdfToWordCard onConverted={() => setRefreshSignal(s => s + 1)} />
          {/* 后续可在此继续添加更多工具卡片 */}
        </div>

        {/* 右：转换历史 */}
        <PdfHistoryPanel refreshSignal={refreshSignal} />
      </div>
    </div>
  )
}

// ─── PDF 转 Word 工具卡片 ──────────────────────────────────────────────────────
type Status = 'idle' | 'converting' | 'success' | 'error'

interface PdfToWordCardProps {
  onConverted?: () => void
}

function PdfToWordCard({ onConverted }: PdfToWordCardProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [status, setStatus] = useState<Status>('idle')
  const [progress, setProgress] = useState(0)
  const [errorMsg, setErrorMsg] = useState('')
  const progressTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  const resetState = () => {
    setSelectedFile(null)
    setStatus('idle')
    setProgress(0)
    setErrorMsg('')
  }

  const startFakeProgress = () => {
    setProgress(0)
    let p = 0
    progressTimer.current = setInterval(() => {
      p = p < 80 ? p + Math.random() * 8 : p + Math.random() * 1.5
      if (p >= 98) p = 98
      setProgress(Math.floor(p))
    }, 300)
  }

  const stopFakeProgress = (success: boolean) => {
    if (progressTimer.current) clearInterval(progressTimer.current)
    progressTimer.current = null
    setProgress(success ? 100 : 0)
  }

  const handleFile = useCallback((file: File) => {
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setErrorMsg('请选择 .pdf 格式的文件')
      setStatus('error')
      return
    }
    setSelectedFile(file)
    setStatus('idle')
    setErrorMsg('')
  }, [])

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
    e.target.value = ''
  }

  const handleConvert = async () => {
    if (!selectedFile) return
    setStatus('converting')
    setErrorMsg('')
    startFakeProgress()
    try {
      await convertPdfToWord(selectedFile)
      stopFakeProgress(true)
      setStatus('success')
      onConverted?.()
    } catch (err: unknown) {
      stopFakeProgress(false)
      setStatus('error')
      setErrorMsg(err instanceof Error ? err.message : '转换失败，请重试')
    }
  }

  return (
    <div className="card p-5 flex flex-col gap-4">
      {/* 工具标题 */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center shrink-0">
          <PdfIcon />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-apple-black">PDF 转 Word</h3>
          <p className="text-xs text-apple-gray-400 mt-0.5">保留版式 · 表格 · 图片</p>
        </div>
      </div>

      {/* 拖拽上传区 */}
      {status !== 'converting' && (
        <div
          className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-colors
            ${dragOver
              ? 'border-blue-400 bg-blue-50'
              : selectedFile
                ? 'border-green-300 bg-green-50'
                : 'border-apple-gray-200 hover:border-apple-gray-300 hover:bg-apple-gray-50'
            }`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            className="hidden"
            onChange={handleInputChange}
          />
          {selectedFile ? (
            <div className="space-y-1">
              <div className="text-2xl">📕</div>
              <p className="text-xs font-medium text-apple-black truncate px-2">{selectedFile.name}</p>
              <p className="text-[10px] text-apple-gray-400">
                {(selectedFile.size / 1024 / 1024).toFixed(2)} MB · 点击重新选择
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              <svg className="w-7 h-7 mx-auto text-apple-gray-300" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              <p className="text-xs text-apple-gray-400">点击或拖拽 PDF 文件至此</p>
              <p className="text-[10px] text-apple-gray-300">支持 .pdf，单文件 ≤ 50 MB</p>
            </div>
          )}
        </div>
      )}

      {/* 转换进度 */}
      {status === 'converting' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-apple-gray-500">
            <span>正在转换…</span>
            <span>{progress}%</span>
          </div>
          <div className="w-full h-1.5 bg-apple-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-apple-black rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-[11px] text-apple-gray-400 text-center">
            正在解析版式与内容，复杂文档可能需要较长时间…
          </p>
        </div>
      )}

      {/* 成功提示 */}
      {status === 'success' && (
        <div className="bg-green-50 rounded-xl px-4 py-3 flex items-center gap-2.5">
          <svg className="w-4 h-4 text-green-500 shrink-0" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <div>
            <p className="text-xs font-medium text-green-700">转换成功，文件已自动下载 🎉</p>
            <p className="text-[10px] text-green-500 mt-0.5">历史记录已保存，可随时在右侧重复下载</p>
          </div>
        </div>
      )}

      {/* 错误提示 */}
      {status === 'error' && (
        <div className="bg-red-50 rounded-xl px-4 py-3 flex items-center gap-2.5">
          <svg className="w-4 h-4 text-red-400 shrink-0" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <p className="text-xs text-red-500">{errorMsg}</p>
        </div>
      )}

      {/* 操作按钮 */}
      <div className="flex gap-2 mt-auto">
        {status !== 'converting' && (
          <>
            {(status === 'success' || status === 'error') && (
              <button onClick={resetState} className="btn-secondary flex-1 text-xs py-2">
                重新选择
              </button>
            )}
            <button
              onClick={handleConvert}
              disabled={!selectedFile || status === 'converting'}
              className="btn-primary flex-1 text-xs py-2 flex items-center justify-center gap-1.5"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="17 1 21 5 17 9" />
                <path d="M3 11V9a4 4 0 014-4h14" />
                <polyline points="7 23 3 19 7 15" />
                <path d="M21 13v2a4 4 0 01-4 4H3" />
              </svg>
              {status === 'success' ? '再次转换' : '开始转换'}
            </button>
          </>
        )}
      </div>

      {/* 技术说明 */}
      <p className="text-[10px] text-apple-gray-300 text-center -mt-1">
        基于 pdf2docx + PyMuPDF · 版式保留效果接近 WPS
      </p>
    </div>
  )
}

// ─── PDF 转换历史面板 ───────────────────────────────────────────────────────────
function PdfHistoryPanel({ refreshSignal }: { refreshSignal?: number }) {
  const [history, setHistory] = useState<PdfConvertHistory[]>([])
  const [loading, setLoading] = useState(true)
  const [downloadingId, setDownloadingId] = useState<number | null>(null)
  const [downloadError, setDownloadError] = useState<string>('')

  const loadHistory = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getPdfConvertHistory()
      setHistory(data)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadHistory()
  }, [loadHistory, refreshSignal])

  const handleDownload = async (record: PdfConvertHistory) => {
    setDownloadingId(record.id)
    setDownloadError('')
    try {
      await downloadConvertedFile(record.id, record.converted_filename)
    } catch (err: unknown) {
      setDownloadError(err instanceof Error ? err.message : '下载失败')
    } finally {
      setDownloadingId(null)
    }
  }

  const formatSize = (bytes: number | null) => {
    if (!bytes) return '—'
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`
  }

  const formatDate = (iso: string) => {
    const d = new Date(iso)
    return d.toLocaleString('zh-CN', {
      month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit',
    })
  }

  return (
    <div className="card p-5 flex flex-col gap-3 min-h-[320px]">
      {/* 面板标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-apple-black">转换历史</h3>
          <p className="text-xs text-apple-gray-400 mt-0.5">点击下载按钮可重复下载</p>
        </div>
        <button
          onClick={loadHistory}
          disabled={loading}
          className="text-apple-gray-400 hover:text-apple-gray-700 transition-colors"
          title="刷新"
        >
          <svg
            className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`}
            viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          >
            <polyline points="23 4 23 10 17 10" />
            <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" />
          </svg>
        </button>
      </div>

      {/* 错误提示 */}
      {downloadError && (
        <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{downloadError}</p>
      )}

      {/* 历史列表 */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-5 h-5 border-2 border-apple-gray-200 border-t-apple-black rounded-full animate-spin" />
        </div>
      ) : history.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-apple-gray-300 gap-2">
          <svg className="w-10 h-10" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
          <p className="text-xs">暂无转换记录</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto space-y-2 -mx-1 px-1">
          {history.map((record) => (
            <div
              key={record.id}
              className="flex items-center gap-3 p-3 rounded-xl bg-apple-gray-50 hover:bg-apple-gray-100 transition-colors group"
            >
              {/* 文件图标 */}
              <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center shrink-0">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <rect x="3" y="2" width="13" height="16" rx="2" stroke="#2563EB" strokeWidth="1.5" fill="none" />
                  <path d="M10 2v5h6" stroke="#2563EB" strokeWidth="1.5" strokeLinecap="round" fill="none" />
                  <path d="M6 10h6M6 13h4" stroke="#2563EB" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </div>

              {/* 文件信息 */}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-apple-black truncate" title={record.converted_filename}>
                  {record.converted_filename}
                </p>
                <p className="text-[10px] text-apple-gray-400 mt-0.5">
                  {formatDate(record.created_at)} · {formatSize(record.file_size)}
                </p>
              </div>

              {/* 下载按钮 */}
              <button
                onClick={() => handleDownload(record)}
                disabled={downloadingId === record.id}
                className="shrink-0 w-7 h-7 rounded-lg bg-white border border-apple-gray-200 flex items-center justify-center
                  text-apple-gray-400 hover:text-apple-black hover:border-apple-gray-400 transition-all
                  disabled:opacity-50 disabled:cursor-not-allowed"
                title="下载"
              >
                {downloadingId === record.id ? (
                  <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                ) : (
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                )}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── 图标 ─────────────────────────────────────────────────────────────────────
const PdfIcon = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
    <rect x="3" y="2" width="13" height="16" rx="2" fill="#FF3B30" opacity="0.15" />
    <rect x="3" y="2" width="13" height="16" rx="2" stroke="#FF3B30" strokeWidth="1.5" fill="none" />
    <path d="M10 2v5h6" stroke="#FF3B30" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    <path d="M6 10h6M6 13h4" stroke="#FF3B30" strokeWidth="1.5" strokeLinecap="round" />
    <rect x="10" y="13" width="11" height="9" rx="2" fill="#2563EB" opacity="0.15" />
    <rect x="10" y="13" width="11" height="9" rx="2" stroke="#2563EB" strokeWidth="1.5" fill="none" />
    <path d="M13 16h5M13 18.5h3" stroke="#2563EB" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
)
