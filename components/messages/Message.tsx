import { cn, formatTime } from '@/lib/utils'

export type MessageRole = 'user' | 'assistant' | 'system'

export interface MessageProps {
  role: MessageRole
  content: string
  timestamp?: number
  isSpeaking?: boolean
}

export function Message({ role, content, timestamp, isSpeaking = false }: MessageProps) {
  return (
    <div
      className={cn(
        'max-w-xl rounded-2xl border border-gray-100 bg-white p-4 shadow-sm',
        role === 'assistant' && 'border-blue-200 bg-blue-50',
        role === 'system' && 'border-gray-200 bg-gray-100 text-gray-600'
      )}
    >
      <div className="mb-2 flex items-center justify-between text-xs uppercase tracking-wide text-gray-400">
        <span>{role}</span>
        {timestamp && <span>{formatTime(timestamp)}</span>}
      </div>
      <p className="whitespace-pre-wrap text-sm text-gray-700">{content}</p>
      {isSpeaking && (
        <div className="mt-2 text-xs text-blue-500">Speaking…</div>
      )}
    </div>
  )
}
