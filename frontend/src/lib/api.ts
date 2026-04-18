const BASE = '/api/v1'

export type APIArticleIndexingStatus = {
  name: string      // store name e.g. "lanceDB", "bleve"
  articleId: number
  status: string    // "Queued" | "Indexing" | "Completed" | "Errored"
  message: string
}

export type APIArticle = {
  id: number
  name: string
  pathInObjectStorage: string
  knowledgeBaseId: string
  articleIndexing: APIArticleIndexingStatus[] | null
}

export type APIKnowledgeBase = {
  id: number
  name: string
  description: string | null
  friendlyName: string
  articles: APIArticle[] | null
}

export async function listKnowledgeBases(): Promise<APIKnowledgeBase[]> {
  const res = await fetch(`${BASE}/kb`)
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || `HTTP ${res.status}`)
  }
  const data = await res.json()
  // Backend returns null when no rows — normalise to []
  return Array.isArray(data) ? data : []
}

export async function createKnowledgeBase(
  name: string,
  description: string,
): Promise<{ knowledgebase: string }> {
  const res = await fetch(`${BASE}/kb`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, description }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || `HTTP ${res.status}`)
  }
  return res.json()
}

/**
 * Upload an article using XHR so we can track upload progress.
 * Content must be the raw base64 string (no data URL prefix).
 */
export function uploadArticle(
  kbId: string,
  name: string,
  base64Content: string,
  onProgress: (pct: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${BASE}/kb/${kbId}/knowledge`)
    xhr.setRequestHeader('Content-Type', 'application/json')

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        onProgress(Math.round((e.loaded / e.total) * 100))
      }
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(100)
        resolve()
      } else {
        reject(new Error(xhr.responseText || `HTTP ${xhr.status}`))
      }
    }

    xhr.onerror = () => reject(new Error('Network error'))
    xhr.onabort = () => reject(new Error('Upload cancelled'))

    xhr.send(JSON.stringify({ name, content: base64Content }))
  })
}

export type SearchStoreResult = {
  store: string
  results: string[] | null
  error: string | null
}

export type SearchResponse = {
  responses: SearchStoreResult[]
}

export async function searchKB(kbId: string, query: string): Promise<SearchResponse> {
  const res = await fetch(`${BASE}/kb/${kbId}/search?q=${encodeURIComponent(query)}`)
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || `HTTP ${res.status}`)
  }
  return res.json()
}

// ── Session / Chat ────────────────────────────────────────────────

/** A single content block inside an Anthropic message */
export type ContentBlock = {
  type: 'text' | 'tool_use' | 'tool_result' | string
  text?: string
  id?: string
  name?: string
  input?: unknown
  tool_use_id?: string
  content?: ContentBlock[]
}

/** One turn in the conversation (Anthropic MessageParam format) */
export type ChatMessage = {
  role: 'user' | 'assistant'
  content: ContentBlock[]
}

export type APISession = {
  id: string
  model: string
  knowledgeBases: number[]
  history: ChatMessage[] | null
}

export async function getAllSessions(): Promise<APISession[]> {
  const res = await fetch(`${BASE}/sessions`)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const data = await res.json()
  return Array.isArray(data) ? data : []
}

export async function getSession(sessionId: string): Promise<APISession> {
  const res = await fetch(`${BASE}/sessions/${sessionId}`)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export async function createSession(model: string): Promise<string> {
  const res = await fetch(`${BASE}/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, knowledgeBases: [], history: [] }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || `HTTP ${res.status}`)
  }
  const data = await res.json()
  return data.sessionId as string
}

export async function sendChatMessage(
  sessionId: string,
  message: string,
  knowledgeBases: string[],
): Promise<ChatMessage[]> {
  const res = await fetch(`${BASE}/sessions/${sessionId}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, knowledgeBases }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || `HTTP ${res.status}`)
  }
  const data = await res.json()
  return Array.isArray(data) ? data : []
}

export async function deleteArticle(kbId: string, articleId: string): Promise<void> {
  const res = await fetch(`${BASE}/kb/${kbId}/knowledge/${articleId}`, {
    method: 'DELETE',
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
}
