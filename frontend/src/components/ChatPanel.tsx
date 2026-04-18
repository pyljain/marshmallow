import { useState, useEffect, useRef, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { MessageSquare, Plus, Trash2, Bot, AlertCircle, Wrench } from 'lucide-react'
import { Button } from './ui/button'
import MentionInput from './MentionInput'
import {
  listKnowledgeBases,
  getAllSessions,
  getSession,
  createSession,
  sendChatMessage,
} from '@/lib/api'
import type { APISession, ChatMessage, ContentBlock } from '@/lib/api'
import { cn } from '@/lib/utils'
import type { KnowledgeBase } from '@/types'

const MODELS = [
  { value: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6' },
  { value: 'claude-haiku-4-5',  label: 'Claude Haiku 4.5'  },
]

const SIDEBAR_MIN = 160
const SIDEBAR_MAX = 400
const SIDEBAR_DEFAULT = 200

function extractText(content: ContentBlock[]): string {
  return content
    .filter((b) => b.type === 'text' && b.text)
    .map((b) => b.text!)
    .join('\n')
}

function sessionTitle(session: APISession): string {
  const firstUser = session.history?.find((m) => m.role === 'user')
  if (!firstUser) return 'New Chat'
  const text = extractText(firstUser.content).trim()
  return text ? (text.length > 42 ? text.slice(0, 42) + '…' : text) : 'New Chat'
}

export default function ChatPanel() {
  const [sessions, setSessions]           = useState<APISession[]>([])
  const [currentId, setCurrentId]         = useState<string | null>(null)
  const [availableKBs, setAvailableKBs]   = useState<KnowledgeBase[]>([])
  const [isLoading, setIsLoading]         = useState(false)
  const [error, setError]                 = useState<string | null>(null)
  const [selectedModel, setSelectedModel] = useState(MODELS[0].value)
  const [sidebarWidth, setSidebarWidth]   = useState(SIDEBAR_DEFAULT)
  const bottomRef   = useRef<HTMLDivElement>(null)
  const isDragging  = useRef(false)
  const dragStart   = useRef({ x: 0, width: 0 })

  useEffect(() => {
    getAllSessions().then(setSessions).catch(console.error)

    listKnowledgeBases()
      .then((apiKBs) =>
        setAvailableKBs(
          apiKBs.map((kb) => ({
            id:           kb.friendlyName,
            name:         kb.name,
            description:  kb.description ?? '',
            tags:         [],
            createdAt:    new Date().toISOString(),
            articleCount: kb.articles?.length ?? 0,
          })),
        ),
      )
      .catch(console.error)
  }, [])

  // Resizable sidebar drag handlers
  const onDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    isDragging.current = true
    dragStart.current = { x: e.clientX, width: sidebarWidth }

    const onMove = (ev: MouseEvent) => {
      if (!isDragging.current) return
      const delta = ev.clientX - dragStart.current.x
      setSidebarWidth(
        Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, dragStart.current.width + delta))
      )
    }
    const onUp = () => {
      isDragging.current = false
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [sidebarWidth])

  const current = sessions.find((s) => s.id === currentId) ?? null

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [current?.history?.length, isLoading])

  const handleNewSession = async () => {
    try {
      setError(null)
      const id = await createSession(selectedModel)
      setSessions((prev) => [{ id, model: selectedModel, knowledgeBases: [], history: [] }, ...prev])
      setCurrentId(id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create session')
    }
  }

  const handleSelectSession = async (id: string) => {
    setCurrentId(id)
    try {
      const fresh = await getSession(id)
      setSessions((prev) => prev.map((s) => (s.id === id ? fresh : s)))
    } catch (e) {
      console.error('Failed to load session', e)
    }
  }

  const handleDeleteSession = (id: string) => {
    setSessions((prev) => prev.filter((s) => s.id !== id))
    if (currentId === id) setCurrentId(null)
  }

  const sendMessage = async (text: string, attachedKBs: string[]) => {
    if (!currentId) return
    setIsLoading(true)
    setError(null)

    // Optimistically add the user message immediately
    const userMessage: ChatMessage = {
      role: 'user',
      content: [{ type: 'text', text }],
    }
    setSessions((prev) =>
      prev.map((s) =>
        s.id === currentId
          ? { ...s, history: [...(s.history ?? []), userMessage] }
          : s,
      ),
    )

    try {
      const kbsToSend = attachedKBs.length > 0 ? attachedKBs : availableKBs.map((kb) => kb.id)
      const history = await sendChatMessage(currentId, text, kbsToSend)
      setSessions((prev) =>
        prev.map((s) => (s.id === currentId ? { ...s, history } : s)),
      )
    } catch (e) {
      // Remove the optimistic message on error
      setSessions((prev) =>
        prev.map((s) =>
          s.id === currentId
            ? { ...s, history: s.history?.slice(0, -1) ?? [] }
            : s,
        ),
      )
      setError(e instanceof Error ? e.message : 'Failed to send message')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="h-full flex overflow-hidden">
      {/* ── Sidebar ────────────────────────────────────────── */}
      <div
        className="flex-shrink-0 border-r border-border flex flex-col bg-card"
        style={{ width: sidebarWidth }}
      >
        <div className="p-3 border-b border-border space-y-2">
          <select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            className="w-full text-xs bg-background border border-border rounded-md px-2 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer"
          >
            {MODELS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>

          <Button variant="outline" size="sm" className="w-full" onClick={handleNewSession}>
            <Plus className="w-3.5 h-3.5" />
            New Chat
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {sessions.length === 0 && (
            <p className="text-xs text-muted-foreground text-center pt-8 px-3 leading-relaxed">
              No conversations yet
            </p>
          )}

          {sessions.map((session) => {
            const msgCount = session.history?.length ?? 0
            return (
              <div key={session.id} className="group relative">
                <button
                  onClick={() => handleSelectSession(session.id)}
                  className={cn(
                    'w-full text-left px-3 py-2.5 rounded-md text-xs transition-colors pr-7',
                    currentId === session.id
                      ? 'bg-primary/10 text-primary border border-primary/15'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent border border-transparent',
                  )}
                >
                  <div className="font-display font-medium truncate">{sessionTitle(session)}</div>
                  <div className="text-[10px] opacity-50 mt-0.5 font-mono">
                    {msgCount} msg{msgCount !== 1 ? 's' : ''}
                  </div>
                </button>

                <button
                  onClick={() => handleDeleteSession(session.id)}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 rounded opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all"
                  aria-label="Delete conversation"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Drag handle ────────────────────────────────────── */}
      <div
        onMouseDown={onDragStart}
        className="w-1 flex-shrink-0 bg-border hover:bg-primary/40 cursor-col-resize transition-colors active:bg-primary/60"
        title="Drag to resize"
      />

      {/* ── Main chat area ──────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {!currentId ? (
          <EmptyChat onNew={handleNewSession} />
        ) : (
          <>
            {/* Error banner */}
            {error && (
              <div className="flex items-center gap-2 px-6 py-2 bg-destructive/10 border-b border-destructive/20 flex-shrink-0">
                <AlertCircle className="w-3.5 h-3.5 text-destructive flex-shrink-0" />
                <p className="text-xs text-destructive flex-1">{error}</p>
                <button
                  onClick={() => setError(null)}
                  className="text-destructive/60 hover:text-destructive text-xs transition-colors"
                >
                  Dismiss
                </button>
              </div>
            )}

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              {(!current?.history || current.history.length === 0) && (
                <div className="flex flex-col items-center justify-center h-full text-center pb-8">
                  <Bot className="w-10 h-10 text-muted-foreground/30 mb-3" />
                  <p className="text-sm text-muted-foreground">
                    Start the conversation. Type{' '}
                    <span className="text-primary font-mono">@</span> to attach a knowledge base.
                  </p>
                </div>
              )}

              {current?.history?.map((msg, i) => (
                <MessageBubble key={i} message={msg} />
              ))}

              {isLoading && <TypingIndicator />}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div className="border-t border-border px-6 py-4 flex-shrink-0">
              <MentionInput
                onSend={sendMessage}
                availableKBs={availableKBs}
                disabled={isLoading}
              />
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── Sub-components ──────────────────────────────────────────────────

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user'
  const textBlocks    = message.content.filter((b): b is ContentBlock & { text: string } => b.type === 'text' && !!b.text)
  const toolUseBlocks = message.content.filter((b) => b.type === 'tool_use')

  if (textBlocks.length === 0 && toolUseBlocks.length === 0) return null

  return (
    <div className={cn('flex gap-3 animate-fade-slide-up', isUser && 'flex-row-reverse')}>
      {/* Avatar */}
      <div
        className={cn(
          'w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 text-[11px] font-bold font-display',
          isUser
            ? 'bg-primary/15 text-primary border border-primary/30'
            : 'bg-muted border border-border text-muted-foreground',
        )}
      >
        {isUser ? 'U' : <Bot className="w-3.5 h-3.5" />}
      </div>

      {/* Bubble(s) */}
      <div className={cn('max-w-[68%] space-y-1.5', isUser && 'items-end flex flex-col')}>
        {/* Tool use pills */}
        {toolUseBlocks.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {toolUseBlocks.map((block, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-muted text-muted-foreground border border-border font-mono"
              >
                <Wrench className="w-2.5 h-2.5" />
                {block.name ?? 'tool'}
              </span>
            ))}
          </div>
        )}

        {/* Text blocks */}
        {textBlocks.map((block, i) => (
          <div
            key={i}
            className={cn(
              'rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
              isUser
                ? 'bg-primary/12 border border-primary/20 rounded-tr-sm text-foreground'
                : 'bg-card border border-border rounded-tl-sm text-foreground',
            )}
          >
            {isUser ? (
              <p className="whitespace-pre-wrap">{block.text}</p>
            ) : (
              <MarkdownContent text={block.text} />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function MarkdownContent({ text }: { text: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p:          ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
        h1:         ({ children }) => <h1 className="text-lg font-bold font-display mb-2 mt-3 first:mt-0">{children}</h1>,
        h2:         ({ children }) => <h2 className="text-base font-bold font-display mb-2 mt-3 first:mt-0">{children}</h2>,
        h3:         ({ children }) => <h3 className="text-sm font-semibold font-display mb-1.5 mt-2.5 first:mt-0">{children}</h3>,
        ul:         ({ children }) => <ul className="list-disc list-inside mb-2 space-y-0.5">{children}</ul>,
        ol:         ({ children }) => <ol className="list-decimal list-inside mb-2 space-y-0.5">{children}</ol>,
        li:         ({ children }) => <li className="text-sm">{children}</li>,
        code:       ({ children, className }) => {
          const isBlock = className?.startsWith('language-')
          return isBlock
            ? <code className={cn('block bg-muted/60 rounded-md px-3 py-2 text-xs font-mono overflow-x-auto mb-2', className)}>{children}</code>
            : <code className="bg-muted/60 rounded px-1 py-0.5 text-xs font-mono">{children}</code>
        },
        pre:        ({ children }) => <pre className="mb-2 overflow-x-auto">{children}</pre>,
        blockquote: ({ children }) => <blockquote className="border-l-2 border-primary/40 pl-3 text-muted-foreground italic mb-2">{children}</blockquote>,
        a:          ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2 hover:text-primary/80">{children}</a>,
        strong:     ({ children }) => <strong className="font-semibold">{children}</strong>,
        em:         ({ children }) => <em className="italic">{children}</em>,
        hr:         () => <hr className="border-border my-3" />,
        table:      ({ children }) => <div className="overflow-x-auto mb-2"><table className="text-xs border-collapse w-full">{children}</table></div>,
        th:         ({ children }) => <th className="border border-border px-2 py-1 bg-muted font-semibold text-left">{children}</th>,
        td:         ({ children }) => <td className="border border-border px-2 py-1">{children}</td>,
      }}
    >
      {text}
    </ReactMarkdown>
  )
}

function TypingIndicator() {
  return (
    <div className="flex gap-3 animate-fade-slide-up">
      <div className="w-7 h-7 rounded-full bg-muted border border-border flex items-center justify-center flex-shrink-0">
        <Bot className="w-3.5 h-3.5 text-muted-foreground" />
      </div>
      <div className="bg-card border border-border rounded-2xl rounded-tl-sm px-4 py-3">
        <div className="flex gap-1 items-center">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-typing"
              style={{ animationDelay: `${i * 0.18}s` }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function EmptyChat({ onNew }: { onNew: () => void }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
      <div className="w-20 h-20 rounded-2xl bg-primary/8 border border-primary/15 flex items-center justify-center mb-5 shadow-inner">
        <MessageSquare className="w-9 h-9 text-primary/40" />
      </div>
      <h2 className="text-xl font-bold font-display mb-2">Start a conversation</h2>
      <p className="text-sm text-muted-foreground mb-6 max-w-sm leading-relaxed">
        Chat with Claude and use{' '}
        <span className="text-primary font-mono font-semibold">@mention</span> to attach knowledge
        bases and ground responses in your indexed documents.
      </p>
      <Button onClick={onNew}>
        <Plus className="w-4 h-4" />
        New Conversation
      </Button>
    </div>
  )
}
