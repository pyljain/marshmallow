import { useState } from 'react'
import { X, Plus, Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from './ui/dialog'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { createKnowledgeBase } from '@/lib/api'
import { upsertKB } from '@/lib/storage'
import { generateId } from '@/lib/utils'
import type { KnowledgeBase } from '@/types'

interface CreateKBDialogProps {
  open: boolean
  onClose: () => void
  onCreated: () => void
}

export default function CreateKBDialog({ open, onClose, onCreated }: CreateKBDialogProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [tagInput, setTagInput] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const addTag = () => {
    const t = tagInput.trim().toLowerCase().replace(/\s+/g, '-')
    if (t && !tags.includes(t)) setTags((p) => [...p, t])
    setTagInput('')
  }

  const removeTag = (t: string) => setTags((p) => p.filter((x) => x !== t))

  const reset = () => {
    setName('')
    setDescription('')
    setTags([])
    setTagInput('')
    setError(null)
  }

  const handleClose = () => { reset(); onClose() }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    setLoading(true)
    setError(null)

    try {
      const { knowledgebase } = await createKnowledgeBase(name.trim(), description.trim())

      const kb: KnowledgeBase = {
        id: knowledgebase,
        name: name.trim(),
        description: description.trim(),
        tags,
        createdAt: new Date().toISOString(),
        articleCount: 0,
      }

      upsertKB(kb)
      reset()
      onCreated()
    } catch (err) {
      // Fallback: if backend is unavailable, create a local-only KB with a generated ID
      const localId = `local-${generateId().slice(0, 8)}`
      const kb: KnowledgeBase = {
        id: localId,
        name: name.trim(),
        description: description.trim(),
        tags,
        createdAt: new Date().toISOString(),
        articleCount: 0,
      }
      upsertKB(kb)
      reset()
      onCreated()
      console.warn('Backend unavailable, KB saved locally only:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New Knowledge Base</DialogTitle>
          <DialogDescription>
            Create a collection to index and search your documents.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-1">
          {/* Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold font-display text-muted-foreground uppercase tracking-wider">
              Name <span className="text-primary">*</span>
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Product Documentation"
              autoFocus
              required
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold font-display text-muted-foreground uppercase tracking-wider">
              Description
            </label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does this knowledge base contain?"
            />
          </div>

          {/* Tags */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold font-display text-muted-foreground uppercase tracking-wider">
              Tags
            </label>
            <div className="flex gap-2">
              <Input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ',') {
                    e.preventDefault()
                    addTag()
                  }
                }}
                placeholder="Type a tag, press Enter"
              />
              <Button type="button" variant="outline" size="icon" onClick={addTag}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {tags.map((t) => (
                  <span
                    key={t}
                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs bg-primary/10 text-primary border border-primary/20 font-display font-medium"
                  >
                    {t}
                    <button
                      type="button"
                      onClick={() => removeTag(t)}
                      className="hover:text-destructive transition-colors ml-0.5"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {error && (
            <p className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" onClick={handleClose} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !name.trim()} className="flex-1">
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating…
                </>
              ) : (
                'Create Knowledge Base'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
