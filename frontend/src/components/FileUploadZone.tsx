import { useCallback, useState, useRef } from 'react'
import { Upload, FilePlus2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface FileUploadZoneProps {
  onFiles: (files: File[]) => void
}

export default function FileUploadZone({ onFiles }: FileUploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handle = useCallback(
    (files: File[]) => {
      const pdfs = files.filter((f) => f.type === 'application/pdf' || f.name.endsWith('.pdf'))
      if (pdfs.length > 0) onFiles(pdfs)
    },
    [onFiles],
  )

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      handle(Array.from(e.dataTransfer.files))
    },
    [handle],
  )

  const onChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      handle(Array.from(e.target.files || []))
      e.target.value = ''
    },
    [handle],
  )

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
      onDragLeave={(e) => {
        // Only fire when leaving the zone entirely
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragging(false)
      }}
      onDrop={onDrop}
      onClick={() => inputRef.current?.click()}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
      className={cn(
        'relative rounded-xl border-2 border-dashed p-12 text-center cursor-pointer',
        'transition-all duration-200 select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        isDragging
          ? 'border-primary bg-primary/8 shadow-[0_0_0_4px_hsl(var(--primary)/0.08)]'
          : 'border-border hover:border-primary/45 hover:bg-primary/3',
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,application/pdf"
        multiple
        className="hidden"
        onChange={onChange}
      />

      <div
        className={cn(
          'w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4',
          'transition-all duration-200',
          isDragging
            ? 'bg-primary/20 border border-primary/40 scale-110 shadow-lg shadow-primary/10'
            : 'bg-muted border border-border',
        )}
      >
        {isDragging ? (
          <FilePlus2 className="w-7 h-7 text-primary" />
        ) : (
          <Upload className="w-7 h-7 text-muted-foreground" />
        )}
      </div>

      <p
        className={cn(
          'text-sm font-semibold font-display mb-1.5 transition-colors',
          isDragging ? 'text-primary' : 'text-foreground',
        )}
      >
        {isDragging ? 'Release to upload' : 'Drag & drop PDF files here'}
      </p>
      <p className="text-xs text-muted-foreground">
        or{' '}
        <span className="text-primary hover:underline transition-colors">click to browse</span>
        {' '}· PDF files only · Multiple files supported
      </p>
    </div>
  )
}
