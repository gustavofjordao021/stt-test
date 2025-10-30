'use client'

import { useState } from 'react'

export function BatchTestingInterface() {
  const [scenarios] = useState<string[]>([])

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-gray-900">Batch Testing</h3>
          <p className="text-sm text-gray-500">Plug in your own testing harness to drive automated flows.</p>
        </div>
        <button className="rounded-md border border-gray-200 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50">
          Import Scenarios
        </button>
      </div>

      <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-6 text-sm text-gray-500">
        {scenarios.length === 0 ? (
          <p>Upload or define scenarios to execute repeatable test runs.</p>
        ) : (
          <ul className="space-y-2">
            {scenarios.map((scenario) => (
              <li key={scenario} className="rounded-lg bg-white p-3 shadow-sm">
                {scenario}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
