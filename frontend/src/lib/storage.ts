import type { KnowledgeBase, Article, Conversation } from '../types'

const K = {
  KBS: 'mm:kbs',
  ARTICLES: (kbId: string) => `mm:articles:${kbId}`,
  CONVS: 'mm:conversations',
}

function get<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function set(key: string, value: unknown): void {
  localStorage.setItem(key, JSON.stringify(value))
}

// ── Knowledge Bases ──────────────────────────────────────────

export function listKBs(): KnowledgeBase[] {
  return get<KnowledgeBase[]>(K.KBS, [])
}

export function upsertKB(kb: KnowledgeBase): void {
  const all = listKBs()
  const idx = all.findIndex((k) => k.id === kb.id)
  if (idx >= 0) all[idx] = kb
  else all.unshift(kb)
  set(K.KBS, all)
}

export function removeKB(kbId: string): void {
  set(K.KBS, listKBs().filter((k) => k.id !== kbId))
  localStorage.removeItem(K.ARTICLES(kbId))
}

// ── Articles ─────────────────────────────────────────────────

export function listArticles(kbId: string): Article[] {
  return get<Article[]>(K.ARTICLES(kbId), [])
}

export function upsertArticle(article: Article): void {
  const all = listArticles(article.kbId)
  const idx = all.findIndex((a) => a.localId === article.localId)
  if (idx >= 0) all[idx] = article
  else all.unshift(article)
  set(K.ARTICLES(article.kbId), all)

  // Keep KB article count in sync (only count non-failed articles)
  const kbs = listKBs()
  const kb = kbs.find((k) => k.id === article.kbId)
  if (kb) {
    kb.articleCount = all.filter((a) => a.status !== 'failed').length
    upsertKB(kb)
  }
}

export function removeArticle(kbId: string, localId: string): void {
  const all = listArticles(kbId).filter((a) => a.localId !== localId)
  set(K.ARTICLES(kbId), all)
}

// ── Conversations ─────────────────────────────────────────────

export function listConversations(): Conversation[] {
  return get<Conversation[]>(K.CONVS, [])
}

export function upsertConversation(conv: Conversation): void {
  const all = listConversations()
  const idx = all.findIndex((c) => c.id === conv.id)
  if (idx >= 0) all[idx] = conv
  else all.unshift(conv)
  set(K.CONVS, all)
}

export function removeConversation(id: string): void {
  set(K.CONVS, listConversations().filter((c) => c.id !== id))
}
