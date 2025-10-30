'use client'

import { useState } from 'react'

type ConfigurationPaneProps = {
  title?: string
  description?: string
  children?: React.ReactNode
}

/**
 * Lightweight placeholder configuration panel.
 * Replace with custom controls for your prototype.
 */
export function ConfigurationPane({
  title = 'Configuration',
  description = 'Drop configuration controls here as your prototype grows.',
  children,
}: ConfigurationPaneProps) {
  const [isOpen, setIsOpen] = useState(true)

  return (
    <aside className="rounded-2xl border border-gray-200 bg-white shadow-sm">
      <header className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
          <p className="text-xs text-gray-500">{description}</p>
        </div>
        <button
          onClick={() => setIsOpen((prev) => !prev)}
          className="rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50"
        >
          {isOpen ? 'Collapse' : 'Expand'}
        </button>
      </header>
      {isOpen && (
        <div className="px-4 py-5 text-sm text-gray-600">
          {children ?? (
            <p className="text-center text-gray-400">
              Add form fields, toggles, or presets to this panel.
            </p>
          )}
        </div>
      )}
    </aside>
  )
}
