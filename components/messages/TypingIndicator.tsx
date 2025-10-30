export function TypingIndicator() {
  return (
    <div className="flex items-center gap-2 text-xs text-gray-500">
      <span className="h-2 w-2 animate-pulse rounded-full bg-gray-400" />
      <span className="h-2 w-2 animate-pulse rounded-full bg-gray-400 animation-delay-150" />
      <span className="h-2 w-2 animate-pulse rounded-full bg-gray-400 animation-delay-300" />
      <span>Assistant is typing…</span>
    </div>
  )
}
