import { useState, useEffect, useCallback } from 'react'
import { Plus, Database, FileText, Tag, Clock, RefreshCw, AlertCircle } from 'lucide-react'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import CreateKBDialog from './CreateKBDialog'
import { listKnowledgeBases } from '@/lib/api'
import { listKBs, upsertKB } from '@/lib/storage'
import { formatDate } from '@/lib/utils'
import { cn } from '@/lib/utils'
import type { KnowledgeBase } from '@/types'

interface KBListProps {
  onSelectKB: (id: string) => void
}

export default function KBList({ onSelectKB }: KBListProps) {
  const [kbs, setKBs]             = useState<KnowledgeBase[]>([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const apiKBs = await listKnowledgeBases()

      // Local storage holds frontend-only metadata (tags, createdAt) keyed by friendlyName
      const localMeta = Object.fromEntries(listKBs().map((k) => [k.id, k]))

      const merged: KnowledgeBase[] = apiKBs.map((apiKB) => {
        const local = localMeta[apiKB.friendlyName]
        const kb: KnowledgeBase = {
          id:           apiKB.friendlyName,
          name:         apiKB.name,
          description:  apiKB.description ?? '',
          tags:         local?.tags ?? [],
          createdAt:    local?.createdAt ?? new Date().toISOString(),
          articleCount: apiKB.articles?.length ?? 0,
        }
        upsertKB(kb) // keep local cache in sync
        return kb
      })

      setKBs(merged)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load knowledge bases'
      setError(msg)
      // Fallback: show whatever is cached locally
      setKBs(listKBs())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b border-border px-8 py-5 flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold font-display">Knowledge Bases</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {loading
              ? 'Loading…'
              : kbs.length === 0
              ? 'No knowledge bases yet'
              : `${kbs.length} knowledge base${kbs.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={load} disabled={loading} title="Refresh">
            <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
          </Button>
          <Button onClick={() => setCreateOpen(true)} size="sm">
            <Plus className="w-4 h-4" />
            New Knowledge Base
          </Button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-2.5 mx-8 mt-4 px-4 py-2.5 rounded-lg border border-destructive/30 bg-destructive/8 text-xs text-destructive animate-fade-slide-up">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
          <span>{error} — showing cached data.</span>
          <button onClick={load} className="ml-auto underline underline-offset-2 hover:no-underline">
            Retry
          </button>
        </div>
      )}

      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-8">
        {loading && kbs.length === 0 ? (
          <LoadingSkeleton />
        ) : kbs.length === 0 ? (
          <EmptyState onNew={() => setCreateOpen(true)} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {kbs.map((kb) => (
              <KBCard key={kb.id} kb={kb} onClick={() => onSelectKB(kb.id)} />
            ))}
          </div>
        )}
      </div>

      <CreateKBDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => { setCreateOpen(false); load() }}
      />
    </div>
  )
}

// ── Sub-components ──────────────────────────────────────────────

function KBCard({ kb, onClick }: { kb: KnowledgeBase; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'group text-left rounded-xl border border-border bg-card p-5 transition-all duration-200 animate-fade-slide-up',
        'hover:border-neutral-600 hover:shadow-lg hover:shadow-black/40',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
      )}
    >
      <div className="flex items-start gap-3 mb-3">
        <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/18 transition-colors">
          <Database className="w-4 h-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0 pt-0.5">
          <h3 className="font-semibold font-display text-sm leading-tight truncate">{kb.name}</h3>
          <p className="text-[10px] text-muted-foreground font-mono mt-0.5 truncate">{kb.id}</p>
        </div>
      </div>

      {kb.description && (
        <p className="text-xs text-muted-foreground line-clamp-2 mb-3 leading-relaxed">
          {kb.description}
        </p>
      )}

      {kb.tags.length > 0 && (
        <div className="flex items-center gap-1 mb-3 flex-wrap">
          <Tag className="w-3 h-3 text-muted-foreground mr-0.5" />
          {kb.tags.slice(0, 3).map((tag) => (
            <Badge key={tag} variant="secondary" className="text-[10px] px-1.5 py-0">{tag}</Badge>
          ))}
          {kb.tags.length > 3 && (
            <span className="text-[10px] text-muted-foreground">+{kb.tags.length - 3}</span>
          )}
        </div>
      )}

      <div className="flex items-center justify-between pt-3 border-t border-border">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <FileText className="w-3 h-3" />
          <span>{kb.articleCount} article{kb.articleCount !== 1 ? 's' : ''}</span>
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="w-3 h-3" />
          <span>{formatDate(kb.createdAt)}</span>
        </div>
      </div>
    </button>
  )
}

function LoadingSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="rounded-xl border border-border bg-card p-5 space-y-3">
          <div className="flex gap-3">
            <div className="w-9 h-9 rounded-lg bg-muted animate-pulse" />
            <div className="flex-1 space-y-2 pt-0.5">
              <div className="h-3 w-3/4 rounded bg-muted animate-pulse" />
              <div className="h-2 w-1/2 rounded bg-muted animate-pulse" />
            </div>
          </div>
          <div className="space-y-1.5">
            <div className="h-2.5 w-full rounded bg-muted animate-pulse" />
            <div className="h-2.5 w-4/5 rounded bg-muted animate-pulse" />
          </div>
          <div className="h-px bg-border" />
          <div className="flex justify-between">
            <div className="h-2.5 w-16 rounded bg-muted animate-pulse" />
            <div className="h-2.5 w-20 rounded bg-muted animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  )
}

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-64 text-center">
      <div className="relative mb-6">
        <div className="w-20 h-20 rounded-2xl bg-primary/8 border border-primary/15 flex items-center justify-center">
          <Database className="w-9 h-9 text-primary/40" />
        </div>
        <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center">
          <Plus className="w-3 h-3 text-primary" />
        </div>
      </div>
      <h2 className="text-lg font-semibold font-display mb-1.5">No knowledge bases yet</h2>
      <p className="text-sm text-muted-foreground mb-6 max-w-sm leading-relaxed">
        Create your first knowledge base to start indexing documents and enabling intelligent search.
      </p>
      <Button onClick={onNew}>
        <Plus className="w-4 h-4" />
        Create Knowledge Base
      </Button>
    </div>
  )
}
