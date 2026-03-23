import { useState, useEffect, useRef } from 'react'
import { type ChatMessage } from '../hooks/useLocationSocket'

interface Props {
  messages: ChatMessage[]
  onSend: (text: string) => void
}

export default function Chat({ messages, onSend }: Props) {
  const [minimized, setMinimized] = useState(false)
  const [input, setInput] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!minimized) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, minimized])

  const handleSend = () => {
    const text = input.trim()
    if (!text) return
    onSend(text)
    setInput('')
  }

  return (
    <div
      className="pip-panel"
      style={{
        position: 'absolute',
        bottom: '16px',
        left: '16px',
        width: '280px',
        height: minimized ? 'auto' : '340px',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        transition: 'height 0.2s',
        fontSize: '12px',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '6px 12px',
          borderBottom: '1px solid var(--pip-border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexShrink: 0,
          cursor: 'pointer',
        }}
        onClick={() => setMinimized((v) => !v)}
      >
        <span
          style={{
            fontSize: '11px',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: 'var(--pip-green)',
          }}
        >
          Chat
        </span>
        <button
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--pip-text)',
            cursor: 'pointer',
            fontSize: '14px',
            lineHeight: 1,
            padding: 0,
          }}
          onClick={(e) => { e.stopPropagation(); setMinimized((v) => !v) }}
        >
          {minimized ? '+' : '−'}
        </button>
      </div>

      {!minimized && (
        <>
          {/* Messages */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '8px 10px',
              display: 'flex',
              flexDirection: 'column',
              gap: '5px',
            }}
          >
            {messages.length === 0 ? (
              <div
                style={{
                  fontSize: '11px',
                  color: 'var(--pip-green-dark)',
                  textAlign: 'center',
                  marginTop: '12px',
                }}
              >
                No messages yet
              </div>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: msg.isSelf ? 'flex-end' : 'flex-start',
                  }}
                >
                  {!msg.isSelf && (
                    <span
                      style={{
                        fontSize: '9px',
                        color: 'var(--pip-green-dark)',
                        marginBottom: '1px',
                      }}
                    >
                      {msg.sender}
                    </span>
                  )}
                  <div
                    style={{
                      maxWidth: '80%',
                      padding: '4px 8px',
                      fontSize: '12px',
                      background: msg.isSelf
                        ? 'rgba(26, 115, 70, 0.5)'
                        : 'rgba(46, 194, 126, 0.1)',
                      border: `1px solid ${msg.isSelf ? 'var(--pip-green)' : 'var(--pip-border)'}`,
                      color: 'var(--pip-text)',
                      wordBreak: 'break-word',
                    }}
                  >
                    {msg.text}
                  </div>
                </div>
              ))
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div
            style={{
              display: 'flex',
              gap: '4px',
              padding: '6px 8px',
              borderTop: '1px solid var(--pip-border)',
              flexShrink: 0,
            }}
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Message..."
              style={{
                flex: 1,
                background: 'rgba(46, 194, 126, 0.05)',
                border: '1px solid var(--pip-border)',
                color: 'var(--pip-text)',
                fontFamily: 'var(--pip-font)',
                fontSize: '12px',
                padding: '4px 8px',
                outline: 'none',
              }}
            />
            <button
              onClick={handleSend}
              style={{
                flexShrink: 0,
                background: 'var(--pip-green-dark)',
                border: '1px solid var(--pip-green)',
                color: 'var(--pip-bg)',
                fontFamily: 'var(--pip-font)',
                fontSize: '11px',
                fontWeight: 'bold',
                padding: '4px 10px',
                cursor: 'pointer',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              Send
            </button>
          </div>
        </>
      )}
    </div>
  )
}
