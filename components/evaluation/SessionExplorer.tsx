'use client'

export interface SessionSummary {
  id: string
  createdAt: Date
  metadata?: Record<string, unknown>
}

interface SessionExplorerProps {
  sessions?: SessionSummary[]
  onSelect?: (session: SessionSummary) => void
}

export function SessionExplorer({ sessions = [], onSelect }: SessionExplorerProps) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <h3 className="text-base font-semibold text-gray-900">Session Explorer</h3>
      <p className="mt-2 text-sm text-gray-500">
        Connect this component to your Supabase tables or in-memory store to inspect prototype sessions.
      </p>

      <div className="mt-4 space-y-2">
        {sessions.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4 text-center text-sm text-gray-500">
            No sessions yet. Start recording interactions and list them here.
          </div>
        ) : (
          sessions.map((session) => (
            <button
              key={session.id}
              onClick={() => onSelect?.(session)}
              className="flex w-full items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-4 py-3 text-left text-sm text-gray-600 hover:border-gray-200"
            >
              <span>
                <span className="block font-medium text-gray-800">Session {session.id}</span>
                <span className="text-xs text-gray-400">{session.createdAt.toLocaleString()}</span>
              </span>
              <span className="text-xs text-gray-400">View ↗</span>
            </button>
          ))
        )}
      </div>
    </div>
  )
}
