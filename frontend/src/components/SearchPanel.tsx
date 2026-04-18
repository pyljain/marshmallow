import { useState, useRef } from 'react'
import { Search, AlertCircle, ChevronDown, ChevronUp, Database, Loader2, SearchX } from 'lucide-react'
import { searchKB, type SearchStoreResult } from '@/lib/api'
import { cn } from '@/lib/utils'

interface SearchPanelProps {
  kbId: string
}

export default function SearchPanel({ kbId }: SearchPanelProps) {
  const [query, setQuery]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [results, setResults]   = useState<SearchStoreResult[] | null>(null)
  const [lastQuery, setLastQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const run = async (q = query) => {
    const trimmed = q.trim()
    if (!trimmed || loading) return
    setLoading(true)
    setError(null)
    setResults(null)
    setLastQuery(trimmed)
    try {
      const res = await searchKB(kbId, trimmed)
      setResults(res.responses ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed')
    } finally {
      setLoading(false)
    }
  }

  const totalResults = results?.reduce((n, r) => n + (r.results?.length ?? 0), 0) ?? 0

  return (
    <div className="space-y-6">
      {/* Search input */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && run()}
            placeholder="Enter a search query…"
            className={cn(
              'w-full h-10 rounded-lg border border-input bg-card',
              'pl-9 pr-4 text-sm',
              'placeholder:text-muted-foreground',
              'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
              'transition-colors',
            )}
          />
        </div>
        <button
          onClick={() => run()}
          disabled={!query.trim() || loading}
          className={cn(
            'h-10 px-4 rounded-lg text-sm font-display font-medium',
            'bg-primary text-primary-foreground',
            'hover:bg-primary/85 active:scale-[0.97]',
            'disabled:opacity-30 disabled:cursor-not-allowed disabled:active:scale-100',
            'transition-all duration-150 whitespace-nowrap flex items-center gap-2',
          )}
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          Search
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/8 px-4 py-3 text-sm text-destructive animate-fade-slide-up">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="space-y-3 animate-fade-slide-up">
          {[1, 2].map((i) => (
            <div key={i} className="rounded-lg border border-border bg-card overflow-hidden">
              <div className="px-4 py-3 border-b border-border flex items-center gap-2">
                <div className="h-3 w-16 rounded bg-muted animate-pulse" />
                <div className="h-3 w-10 rounded bg-muted animate-pulse" />
              </div>
              <div className="p-4 space-y-2">
                {[1, 2, 3].map((j) => (
                  <div key={j} className="space-y-1.5">
                    <div className="h-2.5 w-full rounded bg-muted animate-pulse" style={{ animationDelay: `${j * 80}ms` }} />
                    <div className="h-2.5 w-4/5 rounded bg-muted animate-pulse" style={{ animationDelay: `${j * 80 + 40}ms` }} />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Results */}
      {results !== null && !loading && (
        <div className="space-y-4 animate-fade-slide-up">
          {/* Summary bar */}
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span>
              Query: <span className="text-foreground font-mono">"{lastQuery}"</span>
            </span>
            <span className="text-border">·</span>
            <span>{totalResults} result{totalResults !== 1 ? 's' : ''} across {results.length} store{results.length !== 1 ? 's' : ''}</span>
          </div>

          {results.length === 0 && (
            <EmptyResults query={lastQuery} />
          )}

          {results.map((storeResult) => (
            <StoreResultCard key={storeResult.store} result={storeResult} />
          ))}
        </div>
      )}

      {/* Empty prompt */}
      {results === null && !loading && !error && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-12 h-12 rounded-xl bg-secondary border border-border flex items-center justify-center mb-4">
            <Search className="w-5 h-5 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">
            Enter a query above to search across all configured stores.
          </p>
        </div>
      )}
    </div>
  )
}

// ── Store result card ────────────────────────────────────────────

function StoreResultCard({ result }: { result: SearchStoreResult }) {
  const count = result.results?.length ?? 0

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden animate-fade-slide-up">
      {/* Store header */}
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-border">
        <Database className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="text-xs font-semibold font-display uppercase tracking-wider">
          {result.store}
        </span>
        {result.error ? (
          <span className="ml-auto inline-flex items-center gap-1 text-[10px] font-display font-medium px-2 py-0.5 rounded-full bg-destructive/12 text-destructive border border-destructive/20">
            <AlertCircle className="w-2.5 h-2.5" />
            Error
          </span>
        ) : (
          <span className="ml-auto text-[10px] font-mono text-muted-foreground">
            {count} result{count !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Error body */}
      {result.error && (
        <div className="px-4 py-3 text-xs text-destructive font-mono leading-relaxed">
          {result.error}
        </div>
      )}

      {/* Result snippets */}
      {!result.error && (
        <div className="divide-y divide-border">
          {count === 0 ? (
            <p className="px-4 py-4 text-xs text-muted-foreground italic">No results from this store.</p>
          ) : (
            result.results!.map((snippet, i) => (
              <ResultSnippet key={i} index={i} text={snippet} />
            ))
          )}
        </div>
      )}
    </div>
  )
}

// ── Single result snippet with expand/collapse ────────────────────

const COLLAPSE_THRESHOLD = 280

function ResultSnippet({ index, text }: { index: number; text: string }) {
  const [expanded, setExpanded] = useState(false)
  const isLong = text.length > COLLAPSE_THRESHOLD
  const display = isLong && !expanded ? text.slice(0, COLLAPSE_THRESHOLD).trimEnd() + '…' : text

  return (
    <div className="px-4 py-3 group">
      <div className="flex items-start gap-3">
        <span className="text-[10px] font-mono text-muted-foreground/60 mt-0.5 w-5 flex-shrink-0 text-right select-none">
          {index + 1}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-foreground/85 leading-relaxed font-mono whitespace-pre-wrap break-words">
            {display}
          </p>
          {isLong && (
            <button
              onClick={() => setExpanded((e) => !e)}
              className="mt-1.5 flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
            >
              {expanded ? (
                <><ChevronUp className="w-3 h-3" /> Show less</>
              ) : (
                <><ChevronDown className="w-3 h-3" /> Show more</>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function EmptyResults({ query }: { query: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <SearchX className="w-8 h-8 text-muted-foreground/40 mb-3" />
      <p className="text-sm text-muted-foreground">
        No results found for <span className="text-foreground font-mono">"{query}"</span>
      </p>
    </div>
  )
}
