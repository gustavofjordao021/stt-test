'use client'

const placeholderStats = [
  { label: 'Sessions', value: '—' },
  { label: 'Success Rate', value: '—' },
  { label: 'Avg. Duration', value: '—' },
  { label: 'Cost', value: '—' },
]

export function MetricsDashboard() {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <h3 className="text-base font-semibold text-gray-900">Metrics</h3>
      <p className="mt-2 text-sm text-gray-500">
        Wire this dashboard up to your own analytics or Supabase tables to track prototype performance.
      </p>
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {placeholderStats.map((stat) => (
          <div key={stat.label} className="rounded-xl border border-gray-100 bg-gray-50 p-4 text-center">
            <dt className="text-xs uppercase tracking-wide text-gray-500">{stat.label}</dt>
            <dd className="mt-1 text-lg font-semibold text-gray-800">{stat.value}</dd>
          </div>
        ))}
      </div>
    </section>
  )
}
