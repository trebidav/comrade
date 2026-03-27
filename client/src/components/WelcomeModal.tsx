import { useEffect, useState } from 'react'
import api from '../api'

interface WelcomeModalProps {
  selfLocation: { lat: number; lon: number } | null
  locationError: string | null
  onAccepted: () => void
}

export default function WelcomeModal({ selfLocation, locationError, onAccepted }: WelcomeModalProps) {
  const [message, setMessage] = useState('')
  const [visible, setVisible] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    api.get('/welcome/').then((res) => {
      if (res.data.show) {
        setMessage(res.data.message)
        setVisible(true)
      }
    }).catch(() => {})
  }, [])

  if (!visible) return null

  const canAccept = selfLocation !== null

  const handleAccept = async () => {
    if (!canAccept || submitting) return
    setSubmitting(true)
    try {
      await api.post('/welcome/accept/', {
        latitude: selfLocation!.lat,
        longitude: selfLocation!.lon,
      })
      setVisible(false)
      onAccepted()
    } catch {
      // ignore
    } finally {
      setSubmitting(false)
    }
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
          flexDirection: 'column',
          gap: '8px',
          padding: '10px 14px',
          borderTop: '1px solid var(--pip-border)',
        }}>
          {!canAccept && locationError && (
            <div style={{
              fontSize: '0.65rem',
              color: 'var(--pip-danger, #ff6b6b)',
              lineHeight: 1.5,
            }}>
              Location access is required to continue. Please enable location permissions in your browser settings and reload the page.
            </div>
          )}
          {!canAccept && !locationError && (
            <div style={{
              fontSize: '0.65rem',
              color: 'var(--pip-text)',
              opacity: 0.7,
              lineHeight: 1.5,
            }}>
              Waiting for location...
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              onClick={handleAccept}
              disabled={!canAccept || submitting}
              className="pip-btn pip-btn-primary"
              style={{
                fontSize: '0.7rem',
                padding: '6px 18px',
                opacity: canAccept ? 1 : 0.4,
                cursor: canAccept ? 'pointer' : 'not-allowed',
              }}
            >
              {submitting ? 'Accepting...' : 'Accept & Continue'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
