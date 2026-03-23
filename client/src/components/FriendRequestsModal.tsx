import { useState, useEffect, useCallback } from 'react'
import api from '../api'
import BottomSheet from './BottomSheet'

interface PendingRequest {
  id: number
  username: string
  email: string
}

interface Props {
  open: boolean
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
    if (!open) return
    fetchPending()
    const interval = setInterval(fetchPending, 30000)
    return () => clearInterval(interval)
  }, [fetchPending, open])

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

  return (
    <BottomSheet open={open} onClose={onClose} title="Friend Requests" height="full">
      <div style={{ padding: '12px 16px' }}>
        {error && (
          <div style={{ color: '#EA4335', fontSize: '0.8rem', marginBottom: '12px', padding: '8px', border: '1px solid rgba(234,67,53,0.4)', background: 'rgba(234,67,53,0.08)' }}>
            {error}
          </div>
        )}

        {loading ? (
          <div style={{ fontSize: '0.8rem', color: 'var(--pip-green-dark)', padding: '20px 0', textAlign: 'center' }}>
            Loading...
          </div>
        ) : requests.length === 0 ? (
          <div style={{ fontSize: '0.85rem', color: 'var(--pip-green-dark)', textAlign: 'center', padding: '32px 0' }}>
            No pending requests
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
            {requests.map((req) => (
              <div
                key={req.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '14px 0',
                  borderBottom: '1px solid rgba(26, 115, 70, 0.3)',
                  gap: '12px',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.9rem', color: 'var(--pip-text)' }}>{req.username}</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--pip-green-dark)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{req.email}</div>
                </div>
                <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                  <button
                    className="pip-btn pip-btn-primary"
                    onClick={() => handleAccept(req.id)}
                    style={{ padding: '8px 16px', fontSize: '0.75rem', minHeight: '40px' }}
                  >
                    Accept
                  </button>
                  <button
                    className="pip-btn"
                    onClick={() => handleReject(req.id)}
                    style={{ padding: '8px 12px', fontSize: '0.75rem', minHeight: '40px' }}
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </BottomSheet>
  )
}
