import { useState, useEffect, useRef } from 'react'
import type { DataSource, DataSourceCreate, DBType, UploadedFile, ChunkStrategy } from '../types'
import { dataSourceService } from '../services/dataSource'

const DB_TYPE_LABELS: Record<DBType, string> = {
  mysql: 'MySQL',
  postgresql: 'PostgreSQL',
  sqlite: 'SQLite',
  file: '文件',
}

const DB_TYPE_ICONS: Record<DBType, string> = {
  mysql: 'MY',
  postgresql: 'PG',
  sqlite: 'SQ',
  file: '📄',
}

const SYNC_STATUS_CONFIG = {
  pending: { label: '待同步', className: 'bg-apple-gray-100 text-apple-gray-500' },
  syncing: { label: '同步中', className: 'bg-blue-50 text-blue-500' },
  synced: { label: '已同步', className: 'bg-green-50 text-green-600' },
  error: { label: '同步失败', className: 'bg-red-50 text-red-500' },
}

const SUPPORTED_EXTENSIONS = ['.pdf', '.docx', '.doc', '.pptx', '.ppt', '.txt', '.md']

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

// ───────── 文件管理面板 ─────────
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
            <p className="text-xs text-apple-gray-400">
              点击或拖拽文件上传
            </p>
            <p className="text-[10px] text-apple-gray-300 mt-0.5">
              支持 PDF · Word · PPT · TXT · MD，单文件 ≤ 50MB
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
                   file.filename.endsWith('.pptx') || file.filename.endsWith('.ppt') ? '📙' : '📄'}
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

// ───────── 主组件 ─────────
export default function DataSources() {
  const [list, setList] = useState<DataSource[]>([])
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState<DataSourceCreate>(defaultForm)
  const [submitting, setSubmitting] = useState(false)
  const [actionLoading, setActionLoading] = useState<Record<number, string>>({})
  const [toast, setToast] = useState('')
  const [expandedFileDs, setExpandedFileDs] = useState<Set<number>>(new Set())

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 2500)
  }

  const fetchList = () => dataSourceService.list().then(setList).catch(() => {})

  useEffect(() => { fetchList() }, [])

  const handleSubmit = async () => {
    if (!form.name || !form.db_type) return
    setSubmitting(true)
    try {
      const created = await dataSourceService.create(form)
      setShowModal(false)
      setForm(defaultForm)
      fetchList()
      showToast('数据源创建成功')
      // 文件类型自动展开上传区域
      if (created.db_type === 'file') {
        setExpandedFileDs((prev) => new Set(prev).add(created.id))
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
      setTimeout(fetchList, 1000)
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

  // 当 db_type 切换时重置端口
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
    <div className="p-8">
      {/* 顶部 */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-xl font-semibold text-apple-black">数据源</h1>
          <p className="text-sm text-apple-gray-400 mt-0.5">管理数据库连接与文件知识库</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
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
            const isExpanded = expandedFileDs.has(ds.id)

            return (
              <div key={ds.id} className="card px-5 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    {/* 类型标识 */}
                    <div className="w-9 h-9 bg-apple-gray-100 rounded-lg flex items-center justify-center shrink-0">
                      {isFile ? (
                        <span className="text-base">📁</span>
                      ) : (
                        <span className="text-[10px] font-bold text-apple-gray-500 uppercase">
                          {DB_TYPE_ICONS[ds.db_type]}
                        </span>
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-apple-black">{ds.name}</p>
                      <p className="text-xs text-apple-gray-400 mt-0.5">
                        {DB_TYPE_LABELS[ds.db_type]}
                        {ds.host && ` · ${ds.host}:${ds.port}`}
                        {ds.database_name && ` · ${ds.database_name}`}
                        {ds.sqlite_path && ` · ${ds.sqlite_path}`}
                        {isFile && ds.uploaded_files && ` · ${ds.uploaded_files.length} 个文件`}
                      </p>
                      {ds.last_synced_at && (
                        <p className="text-[10px] text-apple-gray-300 mt-0.5">
                          上次同步：{new Date(ds.last_synced_at).toLocaleString('zh-CN')}
                          {ds.chunk_strategy && ` · 分块：${ds.chunk_strategy}`}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusCfg.className}`}>
                      {statusCfg.label}
                    </span>
                    {/* 文件类型展示"管理文件"按钮 */}
                    {isFile && (
                      <button
                        onClick={() => toggleFileExpand(ds.id)}
                        className="btn-ghost text-xs"
                      >
                        {isExpanded ? '收起文件' : '管理文件'}
                      </button>
                    )}
                    {/* 非文件类型显示测试连接 */}
                    {!isFile && (
                      <button
                        onClick={() => handleTest(ds.id)}
                        disabled={!!actionLoading[ds.id]}
                        className="btn-ghost text-xs"
                      >
                        {actionLoading[ds.id] === 'test' ? '测试中…' : '测试连接'}
                      </button>
                    )}
                    <button
                      onClick={() => handleSync(ds.id)}
                      disabled={!!actionLoading[ds.id] || (isFile && (!ds.uploaded_files || ds.uploaded_files.length === 0))}
                      className="btn-ghost text-xs"
                      title={isFile && (!ds.uploaded_files || ds.uploaded_files.length === 0) ? '请先上传文件再同步' : ''}
                    >
                      {actionLoading[ds.id] === 'sync' ? '同步中…' : '同步'}
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
              </div>
            )
          })}
        </div>
      )}

      {/* 创建弹窗 */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-apple-lg w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-base font-semibold text-apple-black">添加数据源</h2>
              <button onClick={() => setShowModal(false)} className="btn-ghost p-1">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
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
              </select>

              {/* 文件类型：提示创建后上传 */}
              {form.db_type === 'file' && (
                <div className="bg-blue-50 rounded-xl px-4 py-3 text-xs text-blue-600">
                  <p className="font-medium mb-1">📁 文件知识库</p>
                  <p>创建后，在数据源列表点击「管理文件」上传 PDF、Word、PPT 等文档，再点击「同步」建立向量索引。</p>
                  <p className="mt-1 text-blue-400">支持格式：.pdf · .docx · .doc · .pptx · .ppt · .txt · .md</p>
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

      {/* Toast 提示 */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-apple-black text-white text-sm px-5 py-2.5 rounded-full shadow-apple-lg z-50 transition-all">
          {toast}
        </div>
      )}
    </div>
  )
}
