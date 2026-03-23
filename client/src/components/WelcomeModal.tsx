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
      <div
        className="pip-panel"
        style={{
          maxWidth: '420px',
          width: '90vw',
          maxHeight: '80dvh',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 14px',
          borderBottom: '1px solid var(--pip-border)',
        }}>
          <span style={{
            fontSize: '0.8rem',
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
              fontSize: '1rem',
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
          padding: '14px',
          overflowY: 'auto',
          flex: 1,
        }}>
          <pre style={{
            fontFamily: 'var(--pip-font)',
            fontSize: '0.75rem',
            color: 'var(--pip-text)',
            lineHeight: 1.7,
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
          padding: '10px 14px',
          borderTop: '1px solid var(--pip-border)',
        }}>
          <button
            onClick={handleAccept}
            className="pip-btn pip-btn-primary"
            style={{ fontSize: '0.7rem', padding: '6px 18px' }}
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  )
}
