'use client'

import { useEffect, useRef } from 'react'
import { Message, MessageProps } from './Message'
import { TypingIndicator } from './TypingIndicator'

export interface MessageListProps {
  messages: MessageProps[]
  isTyping?: boolean
}

export function MessageList({ messages, isTyping = false }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isTyping])

  return (
    <div className="flex-1 space-y-3 overflow-y-auto rounded-2xl border border-gray-200 bg-white/70 p-4 shadow-inner">
      {messages.length === 0 ? (
        <div className="flex h-32 items-center justify-center text-sm text-gray-400">
          Start the conversation by sending a message.
        </div>
      ) : (
        messages.map((message, index) => (
          <Message key={index} {...message} />
        ))
      )}
      {isTyping && <TypingIndicator />}
      <div ref={bottomRef} />
    </div>
  )
}
