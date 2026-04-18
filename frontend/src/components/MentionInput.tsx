import { useState, useRef, useCallback, useEffect } from 'react'
import { Send, Database, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { KnowledgeBase } from '@/types'

interface MentionInputProps {
  onSend: (text: string, attachedKBs: string[]) => void
  availableKBs: KnowledgeBase[]
  disabled?: boolean
}

export default function MentionInput({ onSend, availableKBs, disabled }: MentionInputProps) {
  const [text, setText]               = useState('')
  const [attachedKBs, setAttachedKBs] = useState<string[]>([])
  const [mentionQuery, setMentionQuery] = useState<string | null>(null)
  const [mentionIdx, setMentionIdx]   = useState(0)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // KBs matching current @query, excluding already-attached ones
  const suggestions = mentionQuery !== null
    ? availableKBs.filter(
        (kb) =>
          !attachedKBs.includes(kb.id) &&
          (kb.name.toLowerCase().includes(mentionQuery.toLowerCase()) ||
           kb.id.toLowerCase().includes(mentionQuery.toLowerCase())),
      )
    : []

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = `${Math.min(ta.scrollHeight, 160)}px`
  }, [text])

  const closeMention = () => setMentionQuery(null)

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value
    setText(val)

    const cursor = e.target.selectionStart ?? val.length
    const before = val.slice(0, cursor)
    const match  = before.match(/@(\w*)$/)

    if (match) {
      setMentionQuery(match[1])
      setMentionIdx(0)
    } else {
      closeMention()
    }
  }

  const selectKB = useCallback(
    (kb: KnowledgeBase) => {
      // Remove the @<partial> token from the textarea
      const cursor = textareaRef.current?.selectionStart ?? text.length
      const before = text.slice(0, cursor)
      const match  = before.match(/@(\w*)$/)

      if (match) {
        const start = cursor - match[0].length
        setText(text.slice(0, start) + text.slice(cursor))
      }

      setAttachedKBs((prev) => (prev.includes(kb.id) ? prev : [...prev, kb.id]))
      closeMention()

      // Restore focus after state update
      setTimeout(() => textareaRef.current?.focus(), 0)
    },
    [text],
  )

  const detachKB = (id: string) =>
    setAttachedKBs((prev) => prev.filter((x) => x !== id))

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Mention navigation
    if (mentionQuery !== null && suggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setMentionIdx((i) => (i + 1) % suggestions.length)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setMentionIdx((i) => (i - 1 + suggestions.length) % suggestions.length)
        return
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        selectKB(suggestions[mentionIdx])
        return
      }
      if (e.key === 'Escape') {
        closeMention()
        return
      }
    }

    // Send on Enter (no shift)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleSend = () => {
    if (disabled || (!text.trim() && attachedKBs.length === 0)) return
    onSend(text.trim(), attachedKBs)
    setText('')
    setAttachedKBs([])
    closeMention()
  }

  const attachedKBObjects = attachedKBs
    .map((id) => availableKBs.find((k) => k.id === id))
    .filter(Boolean) as KnowledgeBase[]

  const canSend = !disabled && (text.trim().length > 0 || attachedKBs.length > 0)

  return (
    <div className="relative space-y-2">
      {/* @mention dropdown — rendered above input */}
      {mentionQuery !== null && (
        <div className="absolute bottom-full mb-2 left-0 right-14 bg-popover border border-border rounded-xl shadow-2xl shadow-black/40 overflow-hidden z-50 animate-fade-slide-up">
          <div className="px-3 py-2 border-b border-border flex items-center gap-2">
            <Database className="w-3.5 h-3.5 text-primary" />
            <p className="text-xs font-display font-semibold text-muted-foreground uppercase tracking-wider">
              Attach Knowledge Base
            </p>
          </div>

          {suggestions.length === 0 ? (
            <p className="text-xs text-muted-foreground px-4 py-3">
              {availableKBs.length === 0
                ? 'No knowledge bases yet — create one in the Knowledge section.'
                : 'No matching knowledge bases.'}
            </p>
          ) : (
            <div className="max-h-52 overflow-y-auto">
              {suggestions.map((kb, i) => (
                <button
                  key={kb.id}
                  onMouseDown={(e) => { e.preventDefault(); selectKB(kb) }}
                  className={cn(
                    'w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors',
                    i === mentionIdx
                      ? 'bg-primary/12 text-primary'
                      : 'text-foreground hover:bg-accent',
                  )}
                >
                  <Database className="w-4 h-4 flex-shrink-0 text-primary/70" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate font-display">{kb.name}</div>
                    <div className="text-xs text-muted-foreground font-mono truncate">{kb.id}</div>
                  </div>
                  <span className="text-xs text-muted-foreground flex-shrink-0">
                    {kb.articleCount} article{kb.articleCount !== 1 ? 's' : ''}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Attached KB chips */}
      {attachedKBObjects.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {attachedKBObjects.map((kb) => (
            <span
              key={kb.id}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs bg-primary/12 text-primary border border-primary/25 font-display font-medium"
            >
              <Database className="w-3 h-3" />
              {kb.name}
              <button
                onClick={() => detachKB(kb.id)}
                className="hover:text-destructive transition-colors"
                aria-label={`Remove ${kb.name}`}
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Textarea + send button */}
      <div className="flex items-end gap-2">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder="Message… type @ to attach a knowledge base"
          rows={1}
          className={cn(
            'flex-1 resize-none rounded-xl border border-input bg-card',
            'px-4 py-3 text-sm leading-relaxed',
            'placeholder:text-muted-foreground',
            'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            'transition-all min-h-[46px] max-h-[160px]',
          )}
        />

        <button
          onClick={handleSend}
          disabled={!canSend}
          className={cn(
            'w-[46px] h-[46px] rounded-xl flex items-center justify-center flex-shrink-0',
            'bg-primary text-primary-foreground',
            'transition-all duration-150 active:scale-95',
            'hover:bg-primary/90',
            'disabled:opacity-30 disabled:cursor-not-allowed disabled:active:scale-100',
          )}
          aria-label="Send message"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>

      <p className="text-[10px] text-muted-foreground px-1">
        Enter to send · Shift+Enter for newline · Type <span className="text-primary font-mono">@</span> to attach a knowledge base
      </p>
    </div>
  )
}
