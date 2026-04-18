import { useState, useCallback, useRef } from 'react'
import { uploadArticle } from '@/lib/api'
import { upsertArticle } from '@/lib/storage'
import { generateId } from '@/lib/utils'
import type { Article } from '@/types'

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      // Strip the data URL prefix (data:...;base64,)
      const result = reader.result as string
      resolve(result.split(',')[1])
    }
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })
}

export function useFileUpload(kbId: string) {
  const [articles, setArticles] = useState<Article[]>([])
  const fileMapRef  = useRef(new Map<string, File>())
  const queueRef    = useRef<string[]>([])
  const activeRef   = useRef(false)
  // Ref to current process fn — avoids stale closures inside setTimeout
  const processRef  = useRef<() => void>(() => {})

  const patch = useCallback((localId: string, update: Partial<Article>) => {
    setArticles((prev) =>
      prev.map((a) => {
        if (a.localId !== localId) return a
        const updated = { ...a, ...update }
        upsertArticle(updated)
        return updated
      }),
    )
  }, [])

  const process = useCallback(async () => {
    if (activeRef.current) return
    const localId = queueRef.current.shift()
    if (!localId) return

    activeRef.current = true
    patch(localId, { status: 'uploading', uploadProgress: 0 })

    const file = fileMapRef.current.get(localId)
    if (!file) {
      patch(localId, { status: 'failed', error: 'File reference lost' })
      activeRef.current = false
      processRef.current()
      return
    }

    try {
      const base64 = await readFileAsBase64(file)

      await uploadArticle(kbId, file.name, base64, (pct) => {
        patch(localId, { uploadProgress: pct })
      })

      // Upload accepted by backend — real indexing status comes from the API
      patch(localId, { status: 'indexing', uploadProgress: 100 })
      activeRef.current = false
      processRef.current()
    } catch (err) {
      patch(localId, {
        status: 'failed',
        error: err instanceof Error ? err.message : 'Upload failed',
      })
      activeRef.current = false
      processRef.current()
    }
  }, [kbId, patch])

  // Always keep processRef pointing at the latest version
  processRef.current = process

  const addFiles = useCallback(
    (files: File[]) => {
      const newArticles: Article[] = files.map((file) => ({
        localId:        generateId(),
        name:           file.name,
        kbId,
        status:         'pending' as const,
        uploadProgress: 0,
        size:           file.size,
        uploadedAt:     new Date().toISOString(),
      }))

      newArticles.forEach((a, i) => {
        fileMapRef.current.set(a.localId, files[i])
        upsertArticle(a)
      })

      setArticles((prev) => [...newArticles, ...prev])
      queueRef.current.push(...newArticles.map((a) => a.localId))

      if (!activeRef.current) processRef.current()
    },
    [kbId],
  )

  /** Call on mount with articles persisted from a previous session. */
  const initFromStorage = useCallback((stored: Article[]) => {
    // In-progress articles that were interrupted get marked as failed
    const restored = stored.map((a) =>
      a.status === 'uploading' || a.status === 'pending'
        ? { ...a, status: 'failed' as const, error: 'Interrupted by page reload' }
        : a,
    )
    setArticles(restored)
    restored.forEach(upsertArticle)
  }, [])

  return { articles, addFiles, initFromStorage }
}
