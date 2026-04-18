export type KnowledgeBase = {
  id: string           // friendly-name returned by API e.g. "cozy-hamster"
  name: string
  description: string
  tags: string[]
  createdAt: string    // ISO
  articleCount: number
}

export type ArticleStatus = 'pending' | 'uploading' | 'indexing' | 'ready' | 'failed'

export type Article = {
  localId: string      // client UUID
  name: string
  kbId: string         // KB friendly-name
  status: ArticleStatus
  uploadProgress: number // 0-100
  size: number
  uploadedAt: string   // ISO
  error?: string
}

export type Message = {
  id: string
  role: 'user' | 'assistant'
  content: string
  attachedKBs: string[]  // KB friendly-names
  timestamp: string
}

export type Conversation = {
  id: string
  title: string
  messages: Message[]
  createdAt: string
  updatedAt: string
}
