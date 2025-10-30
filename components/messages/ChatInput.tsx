'use client'

import { useState } from 'react'

export interface ChatInputProps {
  onSend?: (value: string) => void
  placeholder?: string
  disabled?: boolean
}

export function ChatInput({ onSend, placeholder = 'Type a message…', disabled = false }: ChatInputProps) {
  const [value, setValue] = useState('')

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    if (!value.trim()) return
    onSend?.(value)
    setValue('')
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white p-3 shadow-sm">
      <textarea
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="h-20 flex-1 resize-none rounded-xl border-none bg-transparent text-sm text-gray-700 focus:outline-none focus:ring-0"
      />
      <button
        type="submit"
        disabled={disabled || value.trim().length === 0}
        className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-500"
      >
        Send
      </button>
    </form>
  )
}
