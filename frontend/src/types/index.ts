export interface User {
  id: number
  username: string
  is_active: boolean
  is_admin: boolean
}

export interface TokenResponse {
  access_token: string
  token_type: string
}

export type DBType = 'mysql' | 'postgresql' | 'sqlite' | 'file'

export interface TableConfig {
  table: string
  columns?: string[]
}

export interface UploadedFile {
  filename: string
  path: string
  size?: number
}

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
  sync_status: 'pending' | 'syncing' | 'synced' | 'error'
  sync_error?: string
  last_synced_at?: string
  status: 'active' | 'inactive'
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
}

export interface RetrievedChunk {
  chunk_id: number
  chunk_text: string
  table_name: string
  row_id: string
  data_source_id: number
  similarity: number
  source?: 'vector' | 'keyword' | 'hyde'  // 检索来源
}

export interface AskRequest {
  question: string
  data_source_id?: number
  top_k?: number
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
