'use client'

import { useState } from 'react'

export interface DebugEntry {
  id: string
  label: string
  value: string
  timestamp?: Date
}

interface DebugPaneProps {
  entries?: DebugEntry[]
}

/**
 * Simple expandable debug pane. Replace with custom instrumentation as needed.
 */
export function DebugPane({ entries = [] }: DebugPaneProps) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <section className="rounded-2xl border border-gray-200 bg-white shadow-sm">
      <header className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <h2 className="text-sm font-semibold text-gray-900">Debug</h2>
        <button
          onClick={() => setIsOpen((prev) => !prev)}
          className="rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50"
        >
          {isOpen ? 'Hide' : 'Show'}
        </button>
      </header>

      {isOpen && (
        <div className="max-h-64 overflow-auto px-4 py-3 text-xs text-gray-600">
          {entries.length === 0 ? (
            <p className="text-center text-gray-400">
              Debug entries will appear here.
            </p>
          ) : (
            <ul className="space-y-2">
              {entries.map((entry) => (
                <li key={entry.id} className="rounded-lg bg-gray-50 p-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-gray-700">{entry.label}</span>
                    {entry.timestamp && (
                      <span className="text-[10px] text-gray-400">{entry.timestamp.toLocaleTimeString()}</span>
                    )}
                  </div>
                  <pre className="mt-1 whitespace-pre-wrap text-[11px] text-gray-500">
                    {entry.value}
                  </pre>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  )
}
