import { useState, useEffect, useCallback } from 'react'
import api from '../api'

interface PendingRequest {
  id: number
  username: string
  email: string
}

interface Props {
  open?: boolean
  onClose: () => void
  onBadgeUpdate: (count: number) => void
}

export default function FriendRequestsModal({ open, onClose, onBadgeUpdate }: Props) {
  const [requests, setRequests] = useState<PendingRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchPending = useCallback(async () => {
    try {
      const res = await api.get('/friends/pending/')
      const data: PendingRequest[] = res.data.pending_requests ?? []
      setRequests(data)
      onBadgeUpdate(data.length)
    } catch {
      setError('Failed to load friend requests')
    } finally {
      setLoading(false)
    }
  }, [onBadgeUpdate])

  useEffect(() => {
    fetchPending()
    const interval = setInterval(fetchPending, 30000)
    return () => clearInterval(interval)
  }, [fetchPending])

  const handleAccept = async (id: number) => {
    try {
      await api.post(`/friends/accept/${id}/`)
      await fetchPending()
    } catch {
      setError('Failed to accept request')
    }
  }

  const handleReject = async (id: number) => {
    try {
      await api.post(`/friends/reject/${id}/`)
      await fetchPending()
    } catch {
      setError('Failed to reject request')
    }
  }

  if (!open) return null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.7)',
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="pip-panel" style={{ width: '360px', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div
          style={{
            padding: '12px 16px',
            borderBottom: '1px solid var(--pip-border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span style={{ fontSize: '0.75rem', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            Friend Requests
          </span>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--pip-text)',
              cursor: 'pointer',
              fontSize: '1.2rem',
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '12px 16px' }}>
          {error && (
            <div style={{ color: '#EA4335', fontSize: '0.75rem', marginBottom: '8px' }}>{error}</div>
          )}
          {loading ? (
            <div style={{ fontSize: '0.75rem', color: 'var(--pip-green-dark)' }}>Loading...</div>
          ) : requests.length === 0 ? (
            <div style={{ fontSize: '0.75rem', color: 'var(--pip-green-dark)', textAlign: 'center', padding: '20px 0' }}>
              No pending requests
            </div>
          ) : (
            requests.map((req) => (
              <div
                key={req.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 0',
                  borderBottom: '1px solid rgba(26, 115, 70, 0.3)',
                }}
              >
                <span style={{ fontSize: '0.8rem' }}>{req.username}</span>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button className="pip-btn pip-btn-primary" onClick={() => handleAccept(req.id)}>
                    Accept
                  </button>
                  <button className="pip-btn" onClick={() => handleReject(req.id)}>
                    Reject
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
