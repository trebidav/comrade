import { useState, useEffect, useRef } from 'react'
import { type ChatMessage } from '../hooks/useLocationSocket'
import { useHaptics } from '../hooks/useHaptics'
import { IconChatEmpty } from './Icons'

interface Props {
  messages: ChatMessage[]
  onSend: (text: string) => void
}

export default function Chat({ messages, onSend }: Props) {
  const [input, setInput] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const prevCountRef = useRef(messages.length)
  const haptics = useHaptics()

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    if (messages.length > prevCountRef.current) {
      const latest = messages[messages.length - 1]
      if (latest && !latest.isSelf) haptics.light()
    }
    prevCountRef.current = messages.length
  }, [messages]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSend = () => {
    const text = input.trim()
    if (!text) return
    haptics.light()
    onSend(text)
    setInput('')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Messages */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '12px 14px',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {messages.length === 0 ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            flex: 1,
            gap: '12px',
            color: 'var(--pip-green-dark)',
            padding: '32px 0',
            animation: 'scaleIn 0.3s var(--spring) both',
          }}>
            <IconChatEmpty color="var(--pip-green-dark)" />
            <div style={{ fontSize: '0.8rem', textAlign: 'center', lineHeight: 1.5 }}>
              No messages yet.<br />Be the first to say something!
            </div>
          </div>
        ) : (
          messages.map((msg, index) => (
            <div
              key={msg.id}
              className="chat-msg-enter"
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: msg.isSelf ? 'flex-end' : 'flex-start',
                animationDelay: index === messages.length - 1 ? '0ms' : undefined,
              }}
            >
              {!msg.isSelf && (
                <span style={{
                  fontSize: '0.6rem',
                  color: 'var(--pip-green-dark)',
                  marginBottom: '3px',
                  paddingLeft: '4px',
                  letterSpacing: '0.04em',
                }}>
                  {msg.sender}
                </span>
              )}
              <div
                style={{
                  maxWidth: '80%',
                  padding: '9px 13px',
                  fontSize: '0.9rem',
                  background: msg.isSelf
                    ? 'rgba(26, 115, 70, 0.55)'
                    : 'var(--glass-bg)',
                  backdropFilter: msg.isSelf ? undefined : 'var(--glass-blur)',
                  WebkitBackdropFilter: msg.isSelf ? undefined : 'var(--glass-blur)',
                  border: `1px solid ${msg.isSelf ? 'var(--pip-green)' : 'var(--glass-border)'}`,
                  color: 'var(--pip-text)',
                  wordBreak: 'break-word',
                  borderRadius: msg.isSelf ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                  boxShadow: msg.isSelf ? 'var(--pip-glow)' : undefined,
                  lineHeight: 1.45,
                }}
              >
                {msg.text}
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div
        className="pip-glass"
        style={{
          display: 'flex',
          gap: '8px',
          padding: '10px 12px',
          borderTop: '1px solid var(--glass-border)',
          flexShrink: 0,
          alignItems: 'center',
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
            background: 'rgba(46, 194, 126, 0.06)',
            border: '1px solid var(--glass-border)',
            color: 'var(--pip-text)',
            fontFamily: 'var(--pip-font)',
            padding: '10px 14px',
            outline: 'none',
            borderRadius: '22px',
            transition: 'border-color 0.2s, box-shadow 0.2s',
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = 'var(--pip-green)'
            e.currentTarget.style.boxShadow = '0 0 0 2px rgba(46,194,126,0.15)'
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = 'var(--glass-border)'
            e.currentTarget.style.boxShadow = ''
          }}
        />
        <button
          onClick={handleSend}
          className="send-btn"
          disabled={!input.trim()}
          style={{ opacity: input.trim() ? 1 : 0.45 }}
        >
          ›
        </button>
      </div>
    </div>
  )
}
