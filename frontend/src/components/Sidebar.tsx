import { Database, MessageSquare, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { View } from '../App'

interface SidebarProps {
  view: View
  onNavigate: (v: View) => void
}

const navItems: { id: View; label: string; icon: React.FC<{ className?: string }> }[] = [
  { id: 'knowledge', label: 'Knowledge', icon: Database },
  { id: 'chat',      label: 'Chat',      icon: MessageSquare },
]

export default function Sidebar({ view, onNavigate }: SidebarProps) {
  const active = view === 'kb-detail' ? 'knowledge' : view

  return (
    <aside className="w-[220px] flex-shrink-0 h-screen border-r border-border flex flex-col bg-card">
      {/* Brand */}
      <div className="px-5 py-4 border-b border-border">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-md bg-primary/15 border border-primary/30 flex items-center justify-center shadow-sm shadow-primary/10">
            <Sparkles className="w-3.5 h-3.5 text-primary" />
          </div>
          <span className="text-[15px] font-bold font-display tracking-tight">
            Marshmallow
          </span>
        </div>
        <p className="text-[10px] text-muted-foreground mt-1.5 font-mono pl-[36px]">
          AI Knowledge Platform
        </p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-0.5">
        <p className="text-[10px] font-display font-semibold text-muted-foreground uppercase tracking-widest px-3 pb-2 pt-1">
          Platform
        </p>
        {navItems.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => onNavigate(id)}
            className={cn(
              'w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium font-display transition-all duration-150',
              active === id
                ? 'bg-primary/12 text-primary border border-primary/20 shadow-sm shadow-primary/5'
                : 'text-muted-foreground hover:text-foreground hover:bg-accent border border-transparent',
            )}
          >
            <Icon className="w-4 h-4 flex-shrink-0" />
            {label}
          </button>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-border">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-green-400/70" />
          <p className="text-[10px] text-muted-foreground font-mono">v0.1.0-alpha</p>
        </div>
      </div>
    </aside>
  )
}
