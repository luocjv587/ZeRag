import { useState, useEffect, useRef, useCallback } from 'react'
import type { DataSource, DataSourceCreate, DataSourceUpdate, DBType, UploadedFile, ChunkStrategy, ChunkItem } from '../types'
import { dataSourceService } from '../services/dataSource'

const DB_TYPE_LABELS: Record<DBType, string> = {
  mysql: 'MySQL',
  postgresql: 'PostgreSQL',
  sqlite: 'SQLite',
  file: '文件',
  web: '网络',
}

const DB_TYPE_ICONS: Record<DBType, string> = {
  mysql: 'MY',
  postgresql: 'PG',
  sqlite: 'SQ',
  file: '📄',
  web: '🌐',
}

const SYNC_STATUS_CONFIG = {
  pending: { label: '待同步', className: 'bg-apple-gray-100 text-apple-gray-500' },
  syncing: { label: '同步中', className: 'bg-blue-50 text-blue-500 animate-pulse' },
  synced: { label: '已同步', className: 'bg-green-50 text-green-600' },
  error: { label: '同步失败', className: 'bg-red-50 text-red-500' },
}

const SUPPORTED_EXTENSIONS = ['.pdf', '.docx', '.doc', '.pptx', '.ppt', '.txt', '.md', '.xlsx', '.xls']

const CHUNK_STRATEGY_LABELS: Record<ChunkStrategy, string> = {
  smart:     '🧠 智能分块（推荐）',
  paragraph: '📄 段落分块',
  sentence:  '📝 句子分块',
  fixed:     '📐 固定大小分块',
}

const CHUNK_STRATEGY_DESC: Record<ChunkStrategy, string> = {
  smart:     '自动识别文档结构，综合使用段落/句子/固定分块',
  paragraph: '按段落（空行）分割，适合结构化文档（报告、手册）',
  sentence:  '按句子分割，适合叙述性文本（新闻、文章）',
  fixed:     '按固定字符数分割，适合数据库行记录',
}

const defaultForm: DataSourceCreate = {
  name: '',
  db_type: 'postgresql',
  host: '',
  port: 5432,
  database_name: '',
  username: '',
  password: '',
  chunk_strategy: 'smart',
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

// ── Chunk 查看弹窗 ──────────────────────────────────────────────────────────

function ChunkViewModal({ ds, onClose }: { ds: DataSource; onClose: () => void }) {
  const [chunks, setChunks] = useState<ChunkItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(false)
  const PAGE_SIZE = 15

  const fetchChunks = useCallback(async (p: number, keyword: string) => {
    setLoading(true)
    try {
      const res = await dataSourceService.getChunks(ds.id, p, PAGE_SIZE, keyword || undefined)
      setChunks(res.items)
      setTotal(res.total)
    } finally {
      setLoading(false)
    }
  }, [ds.id])

  useEffect(() => { fetchChunks(1, '') }, [fetchChunks])

  const handleSearch = () => {
    setPage(1)
    fetchChunks(1, q)
  }

  const handlePageChange = (p: number) => {
    setPage(p)
    fetchChunks(p, q)
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-apple-lg w-full max-w-2xl flex flex-col" style={{ maxHeight: '80vh' }}>
        {/* 头部 */}
        <div className="px-5 py-4 border-b border-apple-gray-100 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-sm font-semibold text-apple-black">知识片段 · {ds.name}</h2>
            <p className="text-[10px] text-apple-gray-400 mt-0.5">共 {total} 个片段</p>
          </div>
          <button onClick={onClose} className="btn-ghost p-1">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* 搜索栏 */}
        <div className="px-5 py-3 border-b border-apple-gray-100 flex gap-2 shrink-0">
          <input
            placeholder="关键词过滤…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="input-base flex-1 text-xs"
          />
          <button onClick={handleSearch} className="btn-primary text-xs px-3">搜索</button>
          {q && (
            <button onClick={() => { setQ(''); fetchChunks(1, ''); setPage(1) }} className="btn-ghost text-xs px-3">清除</button>
          )}
        </div>

        {/* 列表 */}
        <div className="overflow-y-auto flex-1 px-5 py-3 space-y-2">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <svg className="animate-spin w-5 h-5 text-apple-gray-400" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
              </svg>
            </div>
          ) : chunks.length === 0 ? (
            <p className="text-sm text-apple-gray-400 text-center py-10">暂无片段数据，请先同步数据源</p>
          ) : (
            chunks.map((chunk, idx) => (
              <div key={chunk.id} className="bg-apple-gray-50 rounded-xl px-4 py-3">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-medium text-apple-gray-400">
                    #{(page - 1) * PAGE_SIZE + idx + 1} · {chunk.table_name || '未知来源'}
                  </span>
                  <span className="text-[10px] text-apple-gray-300">块 {chunk.chunk_index}</span>
                </div>
                <p className="text-xs text-apple-gray-800 leading-relaxed line-clamp-4">{chunk.chunk_text}</p>
              </div>
            ))
          )}
        </div>

        {/* 分页 */}
        {totalPages > 1 && (
          <div className="px-5 py-3 border-t border-apple-gray-100 flex items-center justify-between shrink-0">
            <p className="text-xs text-apple-gray-400">{page} / {totalPages} 页</p>
            <div className="flex gap-2">
              <button
                onClick={() => handlePageChange(page - 1)}
                disabled={page <= 1}
                className="btn-ghost text-xs px-3 disabled:opacity-40"
              >
                上一页
              </button>
              <button
                onClick={() => handlePageChange(page + 1)}
                disabled={page >= totalPages}
                className="btn-ghost text-xs px-3 disabled:opacity-40"
              >
                下一页
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── 编辑弹窗 ────────────────────────────────────────────────────────────────

function EditModal({
  ds,
  onClose,
  onSuccess,
  showToast,
}: {
  ds: DataSource
  onClose: () => void
  onSuccess: () => void
  showToast: (msg: string) => void
}) {
  const [form, setForm] = useState<DataSourceUpdate>({
    name: ds.name,
    host: ds.host,
    port: ds.port,
    database_name: ds.database_name,
    username: ds.username,
    password: '',
    sqlite_path: ds.sqlite_path,
    chunk_strategy: (ds.chunk_strategy as ChunkStrategy) ?? 'smart',
  })
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!form.name?.trim()) { showToast('名称不能为空'); return }
    setSaving(true)
    try {
      const payload: DataSourceUpdate = { ...form }
      // 密码为空则不更新
      if (!payload.password) delete payload.password
      await dataSourceService.update(ds.id, payload)
      showToast('保存成功')
      onSuccess()
      onClose()
    } catch {
      showToast('保存失败')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-apple-lg w-full max-w-md p-4 md:p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-base font-semibold text-apple-black">编辑数据源</h2>
          <button onClick={onClose} className="btn-ghost p-1">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="space-y-3">
          <input
            placeholder="名称"
            value={form.name ?? ''}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            className="input-base"
          />

          {ds.db_type === 'sqlite' && (
            <input
              placeholder="SQLite 文件路径"
              value={form.sqlite_path ?? ''}
              onChange={(e) => setForm((p) => ({ ...p, sqlite_path: e.target.value }))}
              className="input-base"
            />
          )}

          {ds.db_type === 'web' && (
            <div className="bg-green-50 rounded-xl px-4 py-3 text-xs text-green-700">
              <p className="font-medium mb-1">🌐 网络数据源</p>
              <p>URL 管理请在数据源列表中点击「管理 URL」进行操作。</p>
              {ds.web_urls && ds.web_urls.length > 0 && (
                <p className="mt-1 text-green-500">当前 {ds.web_urls.length} 个 URL</p>
              )}
            </div>
          )}

          {(ds.db_type === 'postgresql' || ds.db_type === 'mysql') && (
            <>
              <div className="flex gap-3">
                <input
                  placeholder="主机地址"
                  value={form.host ?? ''}
                  onChange={(e) => setForm((p) => ({ ...p, host: e.target.value }))}
                  className="input-base flex-1"
                />
                <input
                  placeholder="端口"
                  type="number"
                  value={form.port ?? ''}
                  onChange={(e) => setForm((p) => ({ ...p, port: Number(e.target.value) }))}
                  className="input-base w-24"
                />
              </div>
              <input
                placeholder="数据库名"
                value={form.database_name ?? ''}
                onChange={(e) => setForm((p) => ({ ...p, database_name: e.target.value }))}
                className="input-base"
              />
              <input
                placeholder="用户名"
                value={form.username ?? ''}
                onChange={(e) => setForm((p) => ({ ...p, username: e.target.value }))}
                className="input-base"
              />
              <input
                placeholder="新密码（留空不修改）"
                type="password"
                value={form.password ?? ''}
                onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                className="input-base"
              />
            </>
          )}

          {/* 分块策略 */}
          <div className="border border-apple-gray-200 rounded-xl p-3 space-y-2">
            <p className="text-xs font-medium text-apple-black">文档分块策略</p>
            <div className="grid grid-cols-2 gap-1.5">
              {(Object.keys(CHUNK_STRATEGY_LABELS) as ChunkStrategy[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setForm((p) => ({ ...p, chunk_strategy: s }))}
                  className={`text-left px-3 py-2 rounded-lg border text-xs transition-colors ${
                    form.chunk_strategy === s
                      ? 'border-blue-400 bg-blue-50 text-blue-700'
                      : 'border-apple-gray-200 hover:border-apple-gray-300 text-apple-gray-500'
                  }`}
                >
                  <p className="font-medium">{CHUNK_STRATEGY_LABELS[s]}</p>
                </button>
              ))}
            </div>
            {form.chunk_strategy && (
              <p className="text-[10px] text-apple-gray-400 pt-1">
                {CHUNK_STRATEGY_DESC[form.chunk_strategy as ChunkStrategy]}
              </p>
            )}
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="btn-secondary flex-1">取消</button>
          <button onClick={handleSave} disabled={saving} className="btn-primary flex-1">
            {saving ? '保存中…' : '保存'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── 网络 URL 管理面板 ────────────────────────────────────────────────────────

function WebUrlPanel({ ds, onRefresh, showToast }: {
  ds: DataSource
  onRefresh: () => void
  showToast: (msg: string) => void
}) {
  const [inputUrl, setInputUrl] = useState('')
  const [adding, setAdding] = useState(false)
  const [deletingUrl, setDeletingUrl] = useState<string | null>(null)

  const handleAdd = async () => {
    const url = inputUrl.trim()
    if (!url) return
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      showToast('URL 必须以 http:// 或 https:// 开头')
      return
    }
    setAdding(true)
    try {
      await dataSourceService.addWebUrl(ds.id, url)
      setInputUrl('')
      onRefresh()
      showToast('URL 已添加')
    } catch {
      showToast('添加失败，请重试')
    } finally {
      setAdding(false)
    }
  }

  const handleDelete = async (url: string) => {
    if (!confirm(`确认移除该 URL？\n${url}`)) return
    setDeletingUrl(url)
    try {
      await dataSourceService.removeWebUrl(ds.id, url)
      onRefresh()
      showToast('URL 已移除')
    } catch {
      showToast('移除失败')
    } finally {
      setDeletingUrl(null)
    }
  }

  const webUrls: string[] = ds.web_urls || []

  return (
    <div className="mt-3 border-t border-apple-gray-100 pt-3 space-y-3">
      {/* 提示信息 */}
      <div className="bg-blue-50 rounded-xl px-4 py-3 text-xs text-blue-600">
        <p className="font-medium mb-1">🌐 网络数据源</p>
        <p>添加网页 URL，系统会自动抓取页面内容并建立向量索引。</p>
        <p className="mt-1 text-blue-400">
          注意：腾讯文档、Google Docs 等需要登录或 JS 渲染的页面可能无法完整抓取。
        </p>
      </div>

      {/* 输入添加 */}
      <div className="flex gap-2">
        <input
          type="url"
          placeholder="输入网址，如 https://example.com/article"
          value={inputUrl}
          onChange={(e) => setInputUrl(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          className="input-base flex-1 text-xs"
        />
        <button
          onClick={handleAdd}
          disabled={adding || !inputUrl.trim()}
          className="btn-primary text-xs px-4 shrink-0 disabled:opacity-50"
        >
          {adding ? '添加中…' : '添加'}
        </button>
      </div>

      {/* URL 列表 */}
      {webUrls.length > 0 && (
        <div className="space-y-1">
          {webUrls.map((url) => (
            <div key={url} className="flex items-center justify-between bg-apple-gray-50 rounded-lg px-3 py-2 gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-base shrink-0">🔗</span>
                <p className="text-xs text-apple-black truncate" title={url}>{url}</p>
              </div>
              <button
                onClick={() => handleDelete(url)}
                disabled={deletingUrl === url}
                className="shrink-0 text-xs text-apple-gray-300 hover:text-red-400 transition-colors ml-2"
              >
                {deletingUrl === url ? '移除中…' : '移除'}
              </button>
            </div>
          ))}
        </div>
      )}

      {webUrls.length === 0 && (
        <p className="text-xs text-apple-gray-400 text-center py-3">暂无 URL，请添加后同步</p>
      )}
    </div>
  )
}


// ── 文件管理面板 ─────────────────────────────────────────────────────────────

function FilePanel({ ds, onRefresh, showToast }: {
  ds: DataSource
  onRefresh: () => void
  showToast: (msg: string) => void
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [deletingFile, setDeletingFile] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)

  const uploadFiles = async (files: FileList | File[]) => {
    const fileArr = Array.from(files)
    if (!fileArr.length) return
    const invalid = fileArr.filter(
      (f) => !SUPPORTED_EXTENSIONS.some((ext) => f.name.toLowerCase().endsWith(ext))
    )
    if (invalid.length) {
      showToast(`不支持的格式：${invalid.map((f) => f.name).join(', ')}`)
      return
    }

    // 检查同名文件
    const existingNames = (ds.uploaded_files || []).map((f) => f.filename)
    const duplicates = fileArr.filter((f) => existingNames.includes(f.name))
    if (duplicates.length > 0) {
      const names = duplicates.map((f) => f.name).join('、')
      if (!confirm(`以下文件已存在，上传将覆盖原文件：\n${names}\n\n确认继续？`)) return
    }

    setUploading(true)
    try {
      await dataSourceService.uploadFiles(ds.id, fileArr)
      onRefresh()
      showToast(`成功上传 ${fileArr.length} 个文件`)
    } catch {
      showToast('上传失败，请重试')
    } finally {
      setUploading(false)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) uploadFiles(e.target.files)
    e.target.value = ''
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    if (e.dataTransfer.files) uploadFiles(e.dataTransfer.files)
  }

  const handleDeleteFile = async (filename: string) => {
    if (!confirm(`确认删除文件「${filename}」？`)) return
    setDeletingFile(filename)
    try {
      await dataSourceService.deleteFile(ds.id, filename)
      onRefresh()
      showToast('文件已删除')
    } catch {
      showToast('删除失败')
    } finally {
      setDeletingFile(null)
    }
  }

  const uploadedFiles: UploadedFile[] = ds.uploaded_files || []

  return (
    <div className="mt-3 border-t border-apple-gray-100 pt-3">
      {/* 拖拽上传区域 */}
      <div
        className={`border-2 border-dashed rounded-xl p-4 text-center transition-colors cursor-pointer
          ${dragOver ? 'border-blue-400 bg-blue-50' : 'border-apple-gray-200 hover:border-apple-gray-300 hover:bg-apple-gray-50'}`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={SUPPORTED_EXTENSIONS.join(',')}
          className="hidden"
          onChange={handleFileChange}
        />
        {uploading ? (
          <div className="flex items-center justify-center gap-2 text-sm text-blue-500">
            <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
            </svg>
            上传中…
          </div>
        ) : (
          <>
            <svg className="w-6 h-6 mx-auto mb-1 text-apple-gray-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
              <polyline points="17 8 12 3 7 8"/>
              <line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            <p className="text-xs text-apple-gray-400">点击或拖拽文件上传</p>
            <p className="text-[10px] text-apple-gray-300 mt-0.5">
              支持 PDF · Word · PPT · Excel · TXT · MD，单文件 ≤ 50MB
            </p>
          </>
        )}
      </div>

      {/* 已上传文件列表 */}
      {uploadedFiles.length > 0 && (
        <div className="mt-2 space-y-1">
          {uploadedFiles.map((file) => (
            <div key={file.filename} className="flex items-center justify-between bg-apple-gray-50 rounded-lg px-3 py-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-base shrink-0">
                  {file.filename.endsWith('.pdf') ? '📕' :
                   file.filename.endsWith('.docx') || file.filename.endsWith('.doc') ? '📘' :
                   file.filename.endsWith('.pptx') || file.filename.endsWith('.ppt') ? '📙' :
                   file.filename.endsWith('.xlsx') || file.filename.endsWith('.xls') ? '📗' : '📄'}
                </span>
                <div className="min-w-0">
                  <p className="text-xs text-apple-black font-medium truncate">{file.filename}</p>
                  {file.size && (
                    <p className="text-[10px] text-apple-gray-300">{formatFileSize(file.size)}</p>
                  )}
                </div>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); handleDeleteFile(file.filename) }}
                disabled={deletingFile === file.filename}
                className="shrink-0 text-xs text-apple-gray-300 hover:text-red-400 transition-colors ml-2"
              >
                {deletingFile === file.filename ? '删除中…' : '删除'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── 主组件 ───────────────────────────────────────────────────────────────────

export default function DataSources() {
  const [list, setList] = useState<DataSource[]>([])
  const [showModal, setShowModal] = useState(false)
  const [editDs, setEditDs] = useState<DataSource | null>(null)
  const [chunkDs, setChunkDs] = useState<DataSource | null>(null)
  const [form, setForm] = useState<DataSourceCreate>(defaultForm)
  const [submitting, setSubmitting] = useState(false)
  const [actionLoading, setActionLoading] = useState<Record<number, string>>({})
  const [toast, setToast] = useState('')
  const [expandedFileDs, setExpandedFileDs] = useState<Set<number>>(new Set())
  const [expandedWebDs, setExpandedWebDs] = useState<Set<number>>(new Set())
  const [chunkCounts, setChunkCounts] = useState<Record<number, number>>({})
  // 轮询中的数据源 ID 集合
  const pollingRef = useRef<Record<number, ReturnType<typeof setInterval>>>({})

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 2500)
  }

  const fetchList = useCallback(() => {
    dataSourceService.list().then((data) => {
      setList(data)
      // 同步 chunk 统计
      data.forEach((ds) => {
        dataSourceService.getSyncStatus(ds.id)
          .then((s) => setChunkCounts((prev) => ({ ...prev, [ds.id]: s.chunk_count })))
          .catch(() => {})
      })
    }).catch(() => {})
  }, [])

  useEffect(() => { fetchList() }, [fetchList])

  // 清理轮询
  useEffect(() => {
    return () => {
      Object.values(pollingRef.current).forEach(clearInterval)
    }
  }, [])

  /** 启动对某个 DS 的同步状态轮询，直到不再 syncing */
  const startPolling = (dsId: number) => {
    if (pollingRef.current[dsId]) return
    pollingRef.current[dsId] = setInterval(async () => {
      try {
        const s = await dataSourceService.getSyncStatus(dsId)
        setChunkCounts((prev) => ({ ...prev, [dsId]: s.chunk_count }))
        setList((prev) =>
          prev.map((ds) =>
            ds.id === dsId
              ? { ...ds, sync_status: s.sync_status, sync_error: s.sync_error ?? undefined, last_synced_at: s.last_synced_at ?? undefined }
              : ds
          )
        )
        if (s.sync_status !== 'syncing') {
          clearInterval(pollingRef.current[dsId])
          delete pollingRef.current[dsId]
          if (s.sync_status === 'synced') {
            showToast(`同步完成，共 ${s.chunk_count} 个片段`)
          } else if (s.sync_status === 'error') {
            showToast(`同步失败：${s.sync_error || '未知错误'}`)
          }
        }
      } catch {
        clearInterval(pollingRef.current[dsId])
        delete pollingRef.current[dsId]
      }
    }, 2000)
  }

  const handleSubmit = async () => {
    if (!form.name || !form.db_type) return
    setSubmitting(true)
    try {
      const created = await dataSourceService.create(form)
      setShowModal(false)
      setForm(defaultForm)
      fetchList()
      showToast('数据源创建成功')
      if (created.db_type === 'file') {
        setExpandedFileDs((prev) => new Set(prev).add(created.id))
      }
      if (created.db_type === 'web') {
        setExpandedWebDs((prev) => new Set(prev).add(created.id))
      }
    } catch {
      showToast('创建失败，请检查配置')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('确认删除该数据源？此操作不可恢复。')) return
    setActionLoading((p) => ({ ...p, [id]: 'delete' }))
    try {
      await dataSourceService.delete(id)
      fetchList()
      showToast('已删除')
    } finally {
      setActionLoading((p) => { const n = { ...p }; delete n[id]; return n })
    }
  }

  const handleTest = async (id: number) => {
    setActionLoading((p) => ({ ...p, [id]: 'test' }))
    try {
      const res = await dataSourceService.testConnection(id)
      showToast(res.message)
    } finally {
      setActionLoading((p) => { const n = { ...p }; delete n[id]; return n })
    }
  }

  const handleSync = async (id: number) => {
    setActionLoading((p) => ({ ...p, [id]: 'sync' }))
    try {
      const res = await dataSourceService.sync(id)
      showToast(res.message)
      // 乐观更新状态为 syncing，然后启动轮询
      setList((prev) => prev.map((ds) => ds.id === id ? { ...ds, sync_status: 'syncing' } : ds))
      startPolling(id)
    } finally {
      setActionLoading((p) => { const n = { ...p }; delete n[id]; return n })
    }
  }

  const toggleFileExpand = (id: number) => {
    setExpandedFileDs((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleWebExpand = (id: number) => {
    setExpandedWebDs((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleDbTypeChange = (dbType: DBType) => {
    const portMap: Record<string, number> = { postgresql: 5432, mysql: 3306 }
    setForm((p) => ({
      ...p,
      db_type: dbType,
      port: portMap[dbType] || undefined,
      host: '',
      database_name: '',
      username: '',
      password: '',
      sqlite_path: '',
    }))
  }

  return (
    <div className="p-4 md:p-8 pt-16 md:pt-8">
      {/* 顶部 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 md:mb-8">
        <div>
          <h1 className="text-lg md:text-xl font-semibold text-apple-black">数据源</h1>
          <p className="text-xs md:text-sm text-apple-gray-400 mt-0.5">管理数据库连接与文件知识库</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary flex items-center justify-center gap-2 w-full sm:w-auto">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          添加数据源
        </button>
      </div>

      {/* 列表 */}
      {list.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-14 h-14 bg-apple-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#A0A0A0" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <ellipse cx="12" cy="5" rx="9" ry="3" />
              <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
              <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
            </svg>
          </div>
          <p className="text-sm text-apple-gray-400">暂无数据源，点击右上角添加</p>
        </div>
      ) : (
        <div className="space-y-3">
          {list.map((ds) => {
            const statusCfg = SYNC_STATUS_CONFIG[ds.sync_status] || SYNC_STATUS_CONFIG.pending
            const isFile = ds.db_type === 'file'
            const isWeb = ds.db_type === 'web'
            const isExpanded = expandedFileDs.has(ds.id)
            const isWebExpanded = expandedWebDs.has(ds.id)
            const chunkCount = chunkCounts[ds.id]

            // 同步按钮是否禁用
            const syncDisabled =
              !!actionLoading[ds.id] ||
              ds.sync_status === 'syncing' ||
              (isFile && (!ds.uploaded_files || ds.uploaded_files.length === 0)) ||
              (isWeb && (!ds.web_urls || ds.web_urls.length === 0))
            const syncTitle =
              (isFile && (!ds.uploaded_files || ds.uploaded_files.length === 0))
                ? '请先上传文件再同步'
                : (isWeb && (!ds.web_urls || ds.web_urls.length === 0))
                ? '请先添加 URL 再同步'
                : ''

            return (
              <div key={ds.id} className="card px-4 md:px-5 py-4">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div className="flex items-start md:items-center gap-3 md:gap-4 min-w-0 flex-1">
                    {/* 类型标识 */}
                    <div className="w-9 h-9 bg-apple-gray-100 rounded-lg flex items-center justify-center shrink-0">
                      {isFile ? (
                        <span className="text-base">📁</span>
                      ) : isWeb ? (
                        <span className="text-base">🌐</span>
                      ) : (
                        <span className="text-[10px] font-bold text-apple-gray-500 uppercase">
                          {DB_TYPE_ICONS[ds.db_type]}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-apple-black truncate">{ds.name}</p>
                      <p className="text-xs text-apple-gray-400 mt-0.5 line-clamp-2">
                        {DB_TYPE_LABELS[ds.db_type]}
                        {ds.host && ` · ${ds.host}:${ds.port}`}
                        {ds.database_name && ` · ${ds.database_name}`}
                        {ds.sqlite_path && ` · ${ds.sqlite_path}`}
                        {isFile && ds.uploaded_files && ` · ${ds.uploaded_files.length} 个文件`}
                        {isWeb && ds.web_urls && ` · ${ds.web_urls.length} 个 URL`}
                      </p>
                      <p className="text-[10px] text-apple-gray-300 mt-0.5 line-clamp-2">
                        {ds.last_synced_at
                          ? `上次同步：${new Date(ds.last_synced_at).toLocaleString('zh-CN')}`
                          : '尚未同步'
                        }
                        {ds.chunk_strategy && ` · ${ds.chunk_strategy}`}
                        {/* Chunk 统计 */}
                        {chunkCount !== undefined && chunkCount > 0 && (
                          <span className="ml-1 text-blue-400">· {chunkCount} 个片段</span>
                        )}
                      </p>
                      {/* 同步错误提示 */}
                      {ds.sync_status === 'error' && ds.sync_error && (
                        <p className="text-[10px] text-red-400 mt-0.5 truncate" title={ds.sync_error}>
                          ⚠️ {ds.sync_error}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 md:gap-2">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusCfg.className}`}>
                      {statusCfg.label}
                    </span>
                    {/* 文件类型 */}
                    {isFile && (
                      <button onClick={() => toggleFileExpand(ds.id)} className="btn-ghost text-xs">
                        {isExpanded ? '收起文件' : '管理文件'}
                      </button>
                    )}
                    {/* 网络类型 */}
                    {isWeb && (
                      <button onClick={() => toggleWebExpand(ds.id)} className="btn-ghost text-xs">
                        {isWebExpanded ? '收起 URL' : '管理 URL'}
                      </button>
                    )}
                    {/* 数据库类型：测试连接 */}
                    {!isFile && !isWeb && (
                      <button
                        onClick={() => handleTest(ds.id)}
                        disabled={!!actionLoading[ds.id]}
                        className="btn-ghost text-xs"
                      >
                        {actionLoading[ds.id] === 'test' ? '测试中…' : '测试连接'}
                      </button>
                    )}
                    {/* Chunk 查看 */}
                    {ds.sync_status === 'synced' && (chunkCount ?? 0) > 0 && (
                      <button onClick={() => setChunkDs(ds)} className="btn-ghost text-xs">
                        查看片段
                      </button>
                    )}
                    {/* 编辑 */}
                    <button onClick={() => setEditDs(ds)} className="btn-ghost text-xs">
                      编辑
                    </button>
                    <button
                      onClick={() => handleSync(ds.id)}
                      disabled={syncDisabled}
                      className="btn-ghost text-xs"
                      title={syncTitle}
                    >
                      {ds.sync_status === 'syncing' ? (
                        <span className="flex items-center gap-1">
                          <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                          </svg>
                          同步中
                        </span>
                      ) : (actionLoading[ds.id] === 'sync' ? '启动中…' : '同步')}
                    </button>
                    <button
                      onClick={() => handleDelete(ds.id)}
                      disabled={!!actionLoading[ds.id]}
                      className="btn-ghost text-xs text-red-400 hover:text-red-600 hover:bg-red-50"
                    >
                      删除
                    </button>
                  </div>
                </div>

                {/* 文件管理面板 */}
                {isFile && isExpanded && (
                  <FilePanel ds={ds} onRefresh={fetchList} showToast={showToast} />
                )}

                {/* URL 管理面板 */}
                {isWeb && isWebExpanded && (
                  <WebUrlPanel ds={ds} onRefresh={fetchList} showToast={showToast} />
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* 创建弹窗 */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-apple-lg w-full max-w-md p-4 md:p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-base font-semibold text-apple-black">添加数据源</h2>
              <button onClick={() => setShowModal(false)} className="btn-ghost p-1">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div className="space-y-3">
              <input
                placeholder="名称（如：产品手册、生产数据库）"
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                className="input-base"
              />

              <select
                value={form.db_type}
                onChange={(e) => handleDbTypeChange(e.target.value as DBType)}
                className="input-base"
              >
                <option value="postgresql">PostgreSQL</option>
                <option value="mysql">MySQL</option>
                <option value="sqlite">SQLite</option>
                <option value="file">📄 文件（PDF / Word / PPT）</option>
                <option value="web">🌐 网络（网页 URL）</option>
              </select>

              {form.db_type === 'file' && (
                <div className="bg-blue-50 rounded-xl px-4 py-3 text-xs text-blue-600">
                  <p className="font-medium mb-1">📁 文件知识库</p>
                  <p>创建后，在数据源列表点击「管理文件」上传文档，再点击「同步」建立向量索引。</p>
                  <p className="mt-1 text-blue-400">支持格式：.pdf · .docx · .doc · .pptx · .ppt · .txt · .md · .xlsx · .xls</p>
                </div>
              )}

              {form.db_type === 'web' && (
                <div className="bg-green-50 rounded-xl px-4 py-3 text-xs text-green-700">
                  <p className="font-medium mb-1">🌐 网络数据源</p>
                  <p>创建后，在数据源列表点击「管理 URL」添加网页地址，再点击「同步」抓取内容并建立向量索引。</p>
                  <p className="mt-1 text-green-500">支持任意公开可访问的网页。腾讯文档、Google Docs 等需要登录的页面可能无法完整抓取。</p>
                </div>
              )}

              {form.db_type === 'sqlite' && (
                <input
                  placeholder="SQLite 文件路径（如：/data/app.db）"
                  value={form.sqlite_path}
                  onChange={(e) => setForm((p) => ({ ...p, sqlite_path: e.target.value }))}
                  className="input-base"
                />
              )}

              {(form.db_type === 'postgresql' || form.db_type === 'mysql') && (
                <>
                  <div className="flex gap-3">
                    <input
                      placeholder="主机地址"
                      value={form.host}
                      onChange={(e) => setForm((p) => ({ ...p, host: e.target.value }))}
                      className="input-base flex-1"
                    />
                    <input
                      placeholder="端口"
                      type="number"
                      value={form.port}
                      onChange={(e) => setForm((p) => ({ ...p, port: Number(e.target.value) }))}
                      className="input-base w-24"
                    />
                  </div>
                  <input
                    placeholder="数据库名"
                    value={form.database_name}
                    onChange={(e) => setForm((p) => ({ ...p, database_name: e.target.value }))}
                    className="input-base"
                  />
                  <input
                    placeholder="用户名"
                    value={form.username}
                    onChange={(e) => setForm((p) => ({ ...p, username: e.target.value }))}
                    className="input-base"
                  />
                  <input
                    placeholder="密码"
                    type="password"
                    value={form.password}
                    onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                    className="input-base"
                  />
                </>
              )}

              {/* 分块策略 */}
              <div className="border border-apple-gray-200 rounded-xl p-3 space-y-2">
                <p className="text-xs font-medium text-apple-black">文档分块策略</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {(Object.keys(CHUNK_STRATEGY_LABELS) as ChunkStrategy[]).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setForm((p) => ({ ...p, chunk_strategy: s }))}
                      className={`text-left px-3 py-2 rounded-lg border text-xs transition-colors ${
                        form.chunk_strategy === s
                          ? 'border-blue-400 bg-blue-50 text-blue-700'
                          : 'border-apple-gray-200 hover:border-apple-gray-300 text-apple-gray-500'
                      }`}
                    >
                      <p className="font-medium">{CHUNK_STRATEGY_LABELS[s]}</p>
                    </button>
                  ))}
                </div>
                {form.chunk_strategy && (
                  <p className="text-[10px] text-apple-gray-400 pt-1">
                    {CHUNK_STRATEGY_DESC[form.chunk_strategy as ChunkStrategy]}
                  </p>
                )}
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowModal(false)} className="btn-secondary flex-1">取消</button>
              <button onClick={handleSubmit} disabled={submitting || !form.name} className="btn-primary flex-1">
                {submitting ? '创建中…' : '创建'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 编辑弹窗 */}
      {editDs && (
        <EditModal
          ds={editDs}
          onClose={() => setEditDs(null)}
          onSuccess={fetchList}
          showToast={showToast}
        />
      )}

      {/* Chunk 查看弹窗 */}
      {chunkDs && (
        <ChunkViewModal
          ds={chunkDs}
          onClose={() => setChunkDs(null)}
        />
      )}

      {/* Toast 提示 */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-apple-black text-white text-sm px-5 py-2.5 rounded-full shadow-apple-lg z-50 transition-all">
          {toast}
        </div>
      )}
    </div>
  )
}
