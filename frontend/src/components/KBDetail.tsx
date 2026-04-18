import { useState, useEffect, useCallback, useRef } from 'react'
import {
  ArrowLeft, Database, Tag, FileText, Loader2,
  Files, Search, RefreshCw, AlertCircle,
} from 'lucide-react'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import FileUploadZone from './FileUploadZone'
import { ArticleRow, APIArticleRow } from './ArticleRow'
import SearchPanel from './SearchPanel'
import { listKnowledgeBases, type APIKnowledgeBase } from '@/lib/api'
import { listKBs } from '@/lib/storage'
import { useFileUpload } from '@/hooks/useFileUpload'
import { formatDate } from '@/lib/utils'
import { cn } from '@/lib/utils'

type Tab = 'documents' | 'search'

const POLL_INTERVAL = 5000

interface KBDetailProps {
  kbId: string
  onBack: () => void
}

export default function KBDetail({ kbId, onBack }: KBDetailProps) {
  const [tab, setTab]           = useState<Tab>('documents')
  const [apiKB, setApiKB]       = useState<APIKnowledgeBase | null>(null)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  // Local metadata (tags, createdAt) — not returned by the API
  const localKB = listKBs().find((k) => k.id === kbId)

  // ── Fetch KB data from API ────────────────────────────────────
  const fetchKB = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true)
    try {
      const all = await listKnowledgeBases()
      const found = all.find((k) => k.friendlyName === kbId) ?? null
      setApiKB(found)
      setFetchError(null)
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : 'Failed to load articles')
    } finally {
      setRefreshing(false)
    }
  }, [kbId])

  useEffect(() => { fetchKB() }, [fetchKB])

  // ── Auto-poll while any article has an active indexing status ─
  const hasActiveIndexing = (apiKB?.articles ?? []).some((a) =>
    (a.articleIndexing ?? []).some((s) => s.status === 'Queued' || s.status === 'Indexing'),
  )

  useEffect(() => {
    if (!hasActiveIndexing) return
    const timer = setInterval(() => fetchKB(true), POLL_INTERVAL)
    return () => clearInterval(timer)
  }, [hasActiveIndexing, fetchKB])

  // ── Upload tracking ──────────────────────────────────────────
  const { articles: uploadArticles, addFiles } = useFileUpload(kbId)

  // When all active uploads finish, trigger an immediate API refresh
  const activeUploadCount = uploadArticles.filter(
    (a) => a.status === 'pending' || a.status === 'uploading',
  ).length
  const prevActiveRef = useRef(activeUploadCount)
  useEffect(() => {
    if (prevActiveRef.current > 0 && activeUploadCount === 0) {
      fetchKB(true)
    }
    prevActiveRef.current = activeUploadCount
  }, [activeUploadCount, fetchKB])

  // ── Merge view ────────────────────────────────────────────────
  // Show upload-tracked articles that haven't appeared in the API yet
  // (matched by name — once they show up in apiArticles they're dropped here)
  const apiArticleNames = new Set((apiKB?.articles ?? []).map((a) => a.name))
  const pendingUploads = uploadArticles.filter(
    (a) =>
      (a.status === 'pending' || a.status === 'uploading') ||
      (a.status === 'indexing' && !apiArticleNames.has(a.name)),
  )

  const apiArticles = apiKB?.articles ?? []
  const totalArticles = apiArticles.length

  // Counts for the header
  const indexedCount = apiArticles.filter((a) =>
    (a.articleIndexing ?? []).every((s) => s.status === 'Completed'),
  ).length
  const activeCount  = apiArticles.filter((a) =>
    (a.articleIndexing ?? []).some((s) => s.status === 'Queued' || s.status === 'Indexing'),
  ).length

  const name        = apiKB?.name        ?? localKB?.name        ?? kbId
  const description = apiKB?.description ?? localKB?.description ?? ''

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="border-b border-border px-8 pt-5 pb-0 flex-shrink-0">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-4 transition-colors group w-fit"
        >
          <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
          All Knowledge Bases
        </button>

        <div className="flex items-start gap-4 mb-5">
          <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
            <Database className="w-5 h-5 text-primary" />
          </div>

          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold font-display leading-tight">{name}</h1>
            <p className="text-xs text-muted-foreground font-mono mt-0.5">{kbId}</p>

            {description && (
              <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">{description}</p>
            )}

            <div className="flex items-center gap-4 mt-3 flex-wrap">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <FileText className="w-3 h-3" />
                <span>{indexedCount} indexed</span>
                {(activeCount + pendingUploads.length) > 0 && (
                  <span className="flex items-center gap-1 text-foreground/70">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    {activeCount + pendingUploads.length} processing
                  </span>
                )}
              </div>

              {localKB?.createdAt && (
                <span className="text-xs text-muted-foreground">
                  Created {formatDate(localKB.createdAt)}
                </span>
              )}

              {(localKB?.tags ?? []).length > 0 && (
                <div className="flex items-center gap-1.5">
                  <Tag className="w-3 h-3 text-muted-foreground" />
                  {localKB!.tags.map((t) => (
                    <Badge key={t} variant="secondary" className="text-[10px] px-1.5 py-0">{t}</Badge>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => fetchKB()}
              disabled={refreshing}
              title="Refresh"
            >
              <RefreshCw className={cn('w-4 h-4', refreshing && 'animate-spin')} />
            </Button>
            <Button variant="outline" size="sm" onClick={onBack}>Back</Button>
          </div>
        </div>

        {/* ── Tabs ──────────────────────────────────────────── */}
        <div className="flex -mb-px">
          {([
            { id: 'documents', label: 'Documents', icon: Files },
            { id: 'search',    label: 'Search',    icon: Search },
          ] as { id: Tab; label: string; icon: React.FC<{ className?: string }> }[]).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={cn(
                'flex items-center gap-2 px-4 py-2.5 text-sm font-medium font-display border-b-2 transition-colors',
                tab === id
                  ? 'border-foreground text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Content ────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-8">
        {tab === 'documents' && (
          <div className="space-y-8">
            {/* Error */}
            {fetchError && (
              <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-lg border border-destructive/30 bg-destructive/8 text-xs text-destructive animate-fade-slide-up">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                {fetchError}
              </div>
            )}

            {/* Upload zone */}
            <section>
              <h2 className="text-xs font-semibold font-display text-muted-foreground uppercase tracking-widest mb-3">
                Add Documents
              </h2>
              <FileUploadZone onFiles={addFiles} />
            </section>

            {/* In-progress uploads (not yet reflected in API) */}
            {pendingUploads.length > 0 && (
              <section>
                <h2 className="text-xs font-semibold font-display text-muted-foreground uppercase tracking-widest mb-3">
                  Uploading ({pendingUploads.length})
                </h2>
                <div className="space-y-2">
                  {pendingUploads.map((a) => (
                    <ArticleRow key={a.localId} article={a} />
                  ))}
                </div>
              </section>
            )}

            {/* API articles with real per-store status */}
            {totalArticles > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <h2 className="text-xs font-semibold font-display text-muted-foreground uppercase tracking-widest">
                    Articles ({totalArticles})
                  </h2>
                  {hasActiveIndexing && (
                    <span className="flex items-center gap-1 text-[10px] text-muted-foreground font-mono">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      auto-refreshing
                    </span>
                  )}
                </div>
                <div className="space-y-2">
                  {apiArticles.map((article) => (
                    <APIArticleRow key={article.id} article={article} />
                  ))}
                </div>
              </section>
            )}

            {/* Empty state */}
            {totalArticles === 0 && pendingUploads.length === 0 && !refreshing && (
              <div className="text-center py-10 text-sm text-muted-foreground">
                No documents yet — drop PDF files above to get started.
              </div>
            )}
          </div>
        )}

        {tab === 'search' && <SearchPanel kbId={kbId} />}
      </div>
    </div>
  )
}
