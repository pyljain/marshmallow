import { useState } from 'react'
import Sidebar from './components/Sidebar'
import KBList from './components/KBList'
import KBDetail from './components/KBDetail'
import ChatPanel from './components/ChatPanel'

export type View = 'knowledge' | 'kb-detail' | 'chat'

export default function App() {
  const [view, setView] = useState<View>('knowledge')
  const [selectedKBId, setSelectedKBId] = useState<string | null>(null)

  const openKB = (id: string) => {
    setSelectedKBId(id)
    setView('kb-detail')
  }

  const navigate = (v: View) => {
    setView(v)
  }

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      <Sidebar view={view} onNavigate={navigate} />

      <main className="flex-1 overflow-hidden min-w-0">
        {view === 'knowledge' && (
          <KBList onSelectKB={openKB} />
        )}
        {view === 'kb-detail' && selectedKBId && (
          <KBDetail
            kbId={selectedKBId}
            onBack={() => setView('knowledge')}
          />
        )}
        {view === 'chat' && (
          <ChatPanel />
        )}
      </main>
    </div>
  )
}
