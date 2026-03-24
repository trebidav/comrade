import { useState, useEffect, useCallback, useRef } from 'react'
import api from '../api'
import { type FriendEvent } from '../hooks/useLocationSocket'

interface Friend {
  id: number
  username: string
  email: string
}

interface PendingRequest {
  id: number
  username: string
  email: string
}

interface Props {
  open?: boolean
  onClose: () => void
  onBadgeUpdate?: (count: number) => void
  onlineFriendIds: Set<number>
  friendEvents: FriendEvent[]
  clearFriendEvents: () => void
}

export default function FriendRequestsModal({
  open,
  onClose,
  onBadgeUpdate,
  onlineFriendIds,
  friendEvents,
  clearFriendEvents,
}: Props) {
  const [friends, setFriends] = useState<Friend[]>([])
  const [requests, setRequests] = useState<PendingRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const processedRef = useRef(0)

  const fetchData = useCallback(async () => {
    try {
      const [friendsRes, pendingRes] = await Promise.all([
        api.get('/friends/'),
        api.get('/friends/pending/'),
      ])
      const friendsList: Friend[] = friendsRes.data.friends ?? []
      const pendingList: PendingRequest[] = pendingRes.data.pending_requests ?? []
      setFriends(friendsList)
      setRequests(pendingList)
      onBadgeUpdate?.(pendingList.length)
    } catch {
      setError('Failed to load friends data')
    } finally {
      setLoading(false)
    }
  }, [onBadgeUpdate])

  // Fetch data when modal becomes visible
  useEffect(() => {
    if (!open) return
    setLoading(true)
    fetchData()
  }, [fetchData, open])

  // Process WebSocket friend events reactively
  useEffect(() => {
    if (friendEvents.length === 0 || friendEvents.length <= processedRef.current) return

    const newEvents = friendEvents.slice(processedRef.current)
    processedRef.current = friendEvents.length

    for (const evt of newEvents) {
      switch (evt.type) {
        case 'friend_request_received':
          setRequests((prev) => {
            if (prev.some((r) => r.id === evt.from_user.id)) return prev
            return [...prev, { id: evt.from_user.id, username: evt.from_user.username, email: '' }]
          })
          break
        case 'friend_request_accepted':
          setFriends((prev) => {
            if (prev.some((f) => f.id === evt.user.id)) return prev
            return [...prev, { id: evt.user.id, username: evt.user.username, email: '' }]
          })
          setRequests((prev) => prev.filter((r) => r.id !== evt.user.id))
          break
        case 'friend_removed':
          setFriends((prev) => prev.filter((f) => f.id !== evt.user_id))
          break
        case 'friend_request_rejected':
          setRequests((prev) => prev.filter((r) => r.id !== evt.user_id))
          break
      }
    }

    clearFriendEvents()
    processedRef.current = 0
  }, [friendEvents, clearFriendEvents])

  // Update badge when requests change
  useEffect(() => {
    onBadgeUpdate?.(requests.length)
  }, [requests.length, onBadgeUpdate])

  const handleAccept = async (id: number) => {
    try {
      await api.post(`/friends/accept/${id}/`)
      const accepted = requests.find((r) => r.id === id)
      setRequests((prev) => prev.filter((r) => r.id !== id))
      if (accepted) {
        setFriends((prev) => [...prev, { id: accepted.id, username: accepted.username, email: accepted.email }])
      }
    } catch {
      setError('Failed to accept request')
    }
  }

  const handleReject = async (id: number) => {
    try {
      await api.post(`/friends/reject/${id}/`)
      setRequests((prev) => prev.filter((r) => r.id !== id))
    } catch {
      setError('Failed to reject request')
    }
  }

  const handleRemove = async (id: number) => {
    try {
      await api.post(`/friends/remove/${id}/`)
      setFriends((prev) => prev.filter((f) => f.id !== id))
    } catch {
      setError('Failed to remove friend')
    }
  }

  const sectionLabel = (text: string) => (
    <div
      style={{
        fontSize: '0.65rem',
        letterSpacing: '0.1em',
        color: 'var(--pip-green)',
        marginBottom: '10px',
        marginTop: '16px',
        textTransform: 'uppercase',
        borderBottom: '1px solid var(--pip-border)',
        paddingBottom: '4px',
      }}
    >
      {text}
    </div>
  )

  const onlineDot = (isOnline: boolean) => (
    <span
      style={{
        width: '7px',
        height: '7px',
        borderRadius: '50%',
        background: isOnline ? '#34A853' : '#666',
        display: 'inline-block',
        flexShrink: 0,
        boxShadow: isOnline ? '0 0 6px rgba(52,168,83,0.6)' : 'none',
      }}
    />
  )

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
      <div
        className="pip-panel"
        style={{ width: '360px', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}
      >
        {/* Header */}
        <div
          style={{
            padding: '12px 16px',
            borderBottom: '1px solid var(--pip-border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: '0.75rem', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            Friends
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
            x
          </button>
        </div>

        {/* Content */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '12px 16px' }}>
          {error && (
            <div style={{ color: '#EA4335', fontSize: '0.75rem', marginBottom: '8px' }}>{error}</div>
          )}

          {loading ? (
            <div style={{ fontSize: '0.75rem', color: 'var(--pip-green-dark)' }}>Loading...</div>
          ) : (
            <>
              {/* Friends List */}
              {sectionLabel(`Friends (${friends.length})`)}
              {friends.length === 0 ? (
                <div
                  style={{
                    fontSize: '0.75rem',
                    color: 'var(--pip-green-dark)',
                    textAlign: 'center',
                    padding: '16px 0',
                  }}
                >
                  No friends yet
                </div>
              ) : (
                friends.map((friend) => {
                  const isOnline = onlineFriendIds.has(friend.id)
                  return (
                    <div
                      key={friend.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 0',
                        borderBottom: '1px solid rgba(26, 115, 70, 0.3)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
                        {onlineDot(isOnline)}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <span style={{ fontSize: '0.8rem' }}>{friend.username}</span>
                          <div
                            style={{
                              fontSize: '0.6rem',
                              color: isOnline ? '#34A853' : 'var(--pip-green-dark)',
                              textTransform: 'uppercase',
                              letterSpacing: '0.05em',
                            }}
                          >
                            {isOnline ? 'Online' : 'Offline'}
                          </div>
                        </div>
                      </div>
                      <button
                        className="pip-btn"
                        onClick={() => handleRemove(friend.id)}
                        style={{ borderColor: '#EA4335', color: '#EA4335', fontSize: '0.7rem' }}
                      >
                        Remove
                      </button>
                    </div>
                  )
                })
              )}

              {/* Pending Requests */}
              {sectionLabel(`Pending Requests (${requests.length})`)}
              {requests.length === 0 ? (
                <div
                  style={{
                    fontSize: '0.75rem',
                    color: 'var(--pip-green-dark)',
                    textAlign: 'center',
                    padding: '16px 0',
                  }}
                >
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
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ fontSize: '0.8rem' }}>{req.username}</span>
                      {req.email && (
                        <div
                          style={{
                            fontSize: '0.65rem',
                            color: 'var(--pip-green-dark)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {req.email}
                        </div>
                      )}
                    </div>
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
            </>
          )}
        </div>
      </div>
    </div>
  )
}
