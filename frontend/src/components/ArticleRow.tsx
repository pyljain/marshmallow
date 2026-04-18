import { FileText, CheckCircle2, AlertCircle, Clock, RotateCcw, Loader2 } from 'lucide-react'
import { formatBytes } from '@/lib/utils'
import { cn } from '@/lib/utils'
import type { Article } from '@/types'
import type { APIArticle, APIArticleIndexingStatus } from '@/lib/api'

// ── Upload-tracked article (pending / uploading / indexing) ──────

const UPLOAD_STATUS = {
  pending:   { label: 'Pending',   icon: Clock,        spin: false, cls: 'text-muted-foreground bg-secondary border-border' },
  uploading: { label: 'Uploading', icon: Loader2,      spin: true,  cls: 'text-foreground bg-secondary border-border' },
  indexing:  { label: 'Submitted', icon: RotateCcw,    spin: true,  cls: 'text-foreground bg-secondary border-border' },
  ready:     { label: 'Ready',     icon: CheckCircle2, spin: false, cls: 'text-green-400 bg-green-500/10 border-green-500/20' },
  failed:    { label: 'Failed',    icon: AlertCircle,  spin: false, cls: 'text-destructive bg-destructive/10 border-destructive/20' },
}

export function ArticleRow({ article }: { article: Article }) {
  const cfg = UPLOAD_STATUS[article.status]
  const Icon = cfg.icon

  return (
    <div className="flex items-center gap-3 p-3.5 rounded-lg border border-border bg-card animate-fade-slide-up">
      <div className="w-8 h-8 rounded-md bg-muted border border-border flex items-center justify-center flex-shrink-0">
        <FileText className="w-4 h-4 text-muted-foreground" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-sm font-medium truncate">{article.name}</span>
          <span className="text-[10px] text-muted-foreground font-mono flex-shrink-0">
            {formatBytes(article.size)}
          </span>
        </div>

        {article.status === 'uploading' && (
          <div className="h-1 rounded-full bg-border overflow-hidden mt-1.5">
            <div
              className="h-full bg-primary rounded-full transition-all duration-300"
              style={{ width: `${article.uploadProgress}%` }}
            />
          </div>
        )}
        {article.status === 'indexing' && (
          <div className="h-1 rounded-full bg-border overflow-hidden mt-1.5">
            <div className="h-full animate-shimmer-bar rounded-full" />
          </div>
        )}
        {article.status === 'failed' && article.error && (
          <p className="text-[11px] text-destructive mt-0.5">{article.error}</p>
        )}
      </div>

      <span className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-display font-medium border flex-shrink-0',
        cfg.cls,
      )}>
        <Icon className={cn('w-3 h-3', cfg.spin && 'animate-spin')} />
        {cfg.label}
        {article.status === 'uploading' && ` ${article.uploadProgress}%`}
      </span>
    </div>
  )
}

// ── API article (real per-store status) ──────────────────────────

export function APIArticleRow({ article }: { article: APIArticle }) {
  const indexing = article.articleIndexing ?? []
  const overall  = deriveOverall(indexing)

  return (
    <div className="rounded-lg border border-border bg-card animate-fade-slide-up overflow-hidden">
      {/* File header */}
      <div className="flex items-center gap-3 px-3.5 py-3">
        <div className={cn(
          'w-8 h-8 rounded-md border flex items-center justify-center flex-shrink-0',
          overall === 'Completed'            ? 'bg-green-500/10 border-green-500/20' :
          overall === 'Errored' || overall === 'Completed with error'
                                             ? 'bg-destructive/10 border-destructive/20' :
          overall === 'Indexing'             ? 'bg-primary/10 border-primary/20' :
                                               'bg-muted border-border',
        )}>
          <FileText className={cn(
            'w-4 h-4',
            overall === 'Completed'          ? 'text-green-400' :
            overall === 'Errored' || overall === 'Completed with error' ? 'text-destructive' :
            overall === 'Indexing'           ? 'text-primary' :
                                               'text-muted-foreground',
          )} />
        </div>

        <div className="flex-1 min-w-0">
          <span className="text-sm font-medium truncate block">{article.name}</span>
        </div>

        <OverallBadge status={overall} />
      </div>

      {/* Per-store breakdown */}
      {indexing.length > 0 && (
        <div className="border-t border-border px-3.5 py-2.5 flex flex-wrap gap-2">
          {indexing.map((s) => (
            <StoreStatusPill key={s.name} status={s} />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Helpers ──────────────────────────────────────────────────────

function deriveOverall(indexing: APIArticleIndexingStatus[]): string {
  if (indexing.length === 0) return 'Queued'
  const statuses = new Set(indexing.map((i) => i.status))
  if (statuses.has('Errored'))                          return 'Completed with error'
  if (statuses.size === 1 && statuses.has('Completed')) return 'Completed'
  if (statuses.has('Indexing'))                         return 'Indexing'
  return 'Queued'
}

function OverallBadge({ status }: { status: string }) {
  const map: Record<string, { icon: React.FC<{className?:string}>; cls: string; label: string; spin?: boolean }> = {
    'Queued':               { icon: Clock,        label: 'Queued',    cls: 'text-muted-foreground bg-secondary border-border' },
    'Indexing':             { icon: RotateCcw,    label: 'Indexing',  cls: 'text-foreground bg-secondary border-border', spin: true },
    'Completed':            { icon: CheckCircle2, label: 'Indexed',   cls: 'text-green-400 bg-green-500/10 border-green-500/20' },
    'Completed with error': { icon: AlertCircle,  label: 'Partial',   cls: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20' },
    'Errored':              { icon: AlertCircle,  label: 'Failed',    cls: 'text-destructive bg-destructive/10 border-destructive/20' },
  }
  const cfg = map[status] ?? map['Queued']
  const Icon = cfg.icon

  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-display font-medium border flex-shrink-0',
      cfg.cls,
    )}>
      <Icon className={cn('w-3 h-3', cfg.spin && 'animate-spin')} />
      {cfg.label}
    </span>
  )
}

function StoreStatusPill({ status }: { status: APIArticleIndexingStatus }) {
  const map: Record<string, { dot: string; label: string }> = {
    'Queued':    { dot: 'bg-muted-foreground/50', label: 'Queued' },
    'Indexing':  { dot: 'bg-primary animate-pulse', label: 'Indexing' },
    'Completed': { dot: 'bg-green-400', label: 'Done' },
    'Errored':   { dot: 'bg-destructive', label: 'Error' },
  }
  const cfg = map[status.status] ?? { dot: 'bg-muted-foreground/30', label: status.status }

  return (
    <div
      className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-mono border border-border bg-secondary"
      title={status.message || undefined}
    >
      <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', cfg.dot)} />
      <span className="text-muted-foreground">{status.name}</span>
      <span className="text-foreground/70">{cfg.label}</span>
      {status.message && status.status === 'Errored' && (
        <AlertCircle className="w-3 h-3 text-destructive ml-0.5" />
      )}
    </div>
  )
}

// Default export kept for backwards compat with any existing imports
export default ArticleRow
