import { useEffect, useState } from 'react'
import api from '../api'

export default function WelcomeModal() {
  const [message, setMessage] = useState('')
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    api.get('/welcome/').then((res) => {
      if (res.data.show) {
        setMessage(res.data.message)
        setVisible(true)
      }
    }).catch(() => {})
  }, [])

  if (!visible) return null

  const handleAccept = () => {
    api.post('/welcome/accept/').catch(() => {})
    setVisible(false)
  }

  const handleDismiss = () => {
    setVisible(false)
  }

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 10000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'rgba(0,0,0,0.7)',
      backdropFilter: 'blur(4px)',
    }}>
      <div style={{
        background: 'var(--pip-panel)',
        border: '1px solid var(--pip-green)',
        borderRadius: '8px',
        maxWidth: '460px',
        width: '90vw',
        maxHeight: '80dvh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 0 30px rgba(46,194,126,0.15)',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 16px',
          borderBottom: '1px solid var(--pip-border)',
        }}>
          <span style={{
            fontFamily: 'var(--pip-font)',
            fontSize: '0.95rem',
            fontWeight: 'bold',
            color: 'var(--pip-green)',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
          }}>
            Welcome, Comrade
          </span>
          <button
            onClick={handleDismiss}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--pip-text)',
              cursor: 'pointer',
              fontSize: '1.2rem',
              lineHeight: 1,
              padding: '2px 6px',
              opacity: 0.7,
            }}
            title="Close (will show again next time)"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div style={{
          padding: '16px',
          overflowY: 'auto',
          flex: 1,
        }}>
          <pre style={{
            fontFamily: 'var(--pip-font)',
            fontSize: '0.8rem',
            color: 'var(--pip-text)',
            lineHeight: 1.6,
            margin: 0,
            whiteSpace: 'pre-wrap',
            wordWrap: 'break-word',
          }}>
            {message}
          </pre>
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '10px',
          padding: '12px 16px',
          borderTop: '1px solid var(--pip-border)',
        }}>
          <button
            onClick={handleAccept}
            style={{
              fontFamily: 'var(--pip-font)',
              fontSize: '0.75rem',
              padding: '8px 20px',
              background: 'var(--pip-green)',
              color: '#000',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 'bold',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
            }}
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  )
}
