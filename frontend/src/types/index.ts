export interface User {
  id: number
  username: string
  is_active: boolean
  is_admin: boolean
  created_at?: string
}

export interface TokenResponse {
  access_token: string
  token_type: string
}

export type DBType = 'mysql' | 'postgresql' | 'sqlite' | 'file' | 'web'

export interface TableConfig {
  table: string
  columns?: string[]
}

export interface UploadedFile {
  filename: string
  path: string
  size?: number
}

export type ChunkStrategy = 'fixed' | 'paragraph' | 'sentence' | 'smart'

export interface DataSource {
  id: number
  name: string
  db_type: DBType
  host?: string
  port?: number
  database_name?: string
  username?: string
  sqlite_path?: string
  tables_config?: TableConfig[]
  file_store_dir?: string
  uploaded_files?: UploadedFile[]
  web_urls?: string[]
  sync_status: 'pending' | 'syncing' | 'synced' | 'error'
  sync_error?: string
  last_synced_at?: string
  status: 'active' | 'inactive'
  chunk_strategy?: ChunkStrategy
  created_at: string
}

export interface DataSourceCreate {
  name: string
  db_type: DBType
  host?: string
  port?: number
  database_name?: string
  username?: string
  password?: string
  sqlite_path?: string
  tables_config?: TableConfig[]
  web_urls?: string[]
  chunk_strategy?: ChunkStrategy
}

export interface DataSourceUpdate {
  name?: string
  host?: string
  port?: number
  database_name?: string
  username?: string
  password?: string
  sqlite_path?: string
  chunk_strategy?: ChunkStrategy
}

export interface SyncStatus {
  sync_status: 'pending' | 'syncing' | 'synced' | 'error'
  sync_error?: string
  last_synced_at?: string
  chunk_count: number
}

export interface ChunkItem {
  id: number
  table_name?: string
  chunk_text: string
  chunk_index: number
  created_at: string
}

export interface ChunkListResponse {
  total: number
  page: number
  page_size: number
  items: ChunkItem[]
}

export interface RetrievedChunk {
  chunk_id: number
  chunk_text: string
  table_name: string
  row_id: string
  data_source_id: number
  similarity: number
  source?: 'vector' | 'keyword' | 'hyde'
}

export interface ConversationTurn {
  role: 'user' | 'assistant'
  content: string
}

export type ChatMode = 'rag' | 'chat'

export interface AskRequest {
  question: string
  mode?: ChatMode
  data_source_id?: number
  top_k?: number
  enable_rewrite?: boolean
  enable_hyde?: boolean
  enable_sql_fallback?: boolean
  conversation_history?: ConversationTurn[]
}

export interface AskResponse {
  question: string
  answer: string
  retrieved_chunks: RetrievedChunk[]
  data_source_id?: number
  pipeline_log?: PipelineStep[]
}

export interface PipelineStep {
  step: string
  [key: string]: unknown
}

export interface QAHistory {
  id: number
  question: string
  answer: string
  data_source_id?: number
  retrieved_chunks?: unknown
  created_at: string
}

export interface PdfConvertHistory {
  id: number
  original_filename: string
  converted_filename: string
  file_size: number | null
  created_at: string
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  chunks?: RetrievedChunk[]
  loading?: boolean
  pipeline_log?: PipelineStep[]
}

// Server-Sent Events 流式响应事件
export type StreamEvent =
  | { type: 'retrieval_done'; chunks: RetrievedChunk[]; pipeline_log: PipelineStep[] }
  | { type: 'token'; token: string }
  | { type: 'done'; answer: string }
  | { type: 'error'; message: string }

// 管理员相关
export interface AdminUserInfo {
  id: number
  username: string
  is_active: boolean
  is_admin: boolean
  created_at: string
}

export interface PlatformStats {
  total_users: number
  total_data_sources: number
  total_qa_history: number
  active_users: number
}
