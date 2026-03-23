import { useState, useEffect } from 'react'
import { type User } from '../api'
import FriendRequestsModal from './FriendRequestsModal'
import AccountModal from './AccountModal'
import AchievementsPanel from './AchievementsPanel'

interface Props {
  user: User
  onLogout: () => void
}

export default function UserInfoPanel({ user, onLogout }: Props) {
  const [showFriendRequests, setShowFriendRequests] = useState(false)
  const [showAccount, setShowAccount] = useState(false)
  const [showAchievements, setShowAchievements] = useState(false)
  const [friendRequestCount, setFriendRequestCount] = useState(0)

  const lp = user.level_progress ?? { level: user.level ?? 0, current_xp: 0, required_xp: 1000 }
  const levelPct = lp.required_xp > 0 ? Math.min(100, (lp.current_xp / lp.required_xp) * 100) : 0

  // Poll friend requests count in background even when modal is closed
  useEffect(() => {
    const fetchCount = async () => {
      try {
        const token = localStorage.getItem('token')
        if (!token) return
        const res = await fetch('/api/friends/pending/', {
          headers: { Authorization: `Token ${token}` },
        })
        if (res.ok) {
          const data = await res.json()
          setFriendRequestCount(data.pending_requests?.length ?? 0)
        }
      } catch {
        // ignore
      }
    }
    fetchCount()
    const interval = setInterval(fetchCount, 30000)
    return () => clearInterval(interval)
  }, [])

  return (
    <>
      <div
        className="pip-panel absolute z-[1000]"
        style={{
          top: '16px',
          right: '16px',
          width: '180px',
          padding: '12px',
        }}
      >
        <div
          style={{
            fontSize: '0.65rem',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: 'var(--pip-green)',
            borderBottom: '1px solid var(--pip-border)',
            paddingBottom: '6px',
            marginBottom: '8px',
          }}
        >
          COMRADE v0.1.0-beta
        </div>

        <div style={{ fontSize: '0.8rem', marginBottom: '2px', color: 'var(--pip-text)' }}>
          {user.username}
        </div>
        <div
          style={{
            fontSize: '0.65rem',
            color: 'var(--pip-green-dark)',
            marginBottom: '8px',
            wordBreak: 'break-all',
          }}
        >
          {user.email}
        </div>

        {/* Level bar */}
        <div style={{ marginBottom: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' }}>
            <span style={{ fontSize: '0.6rem', color: 'var(--pip-green)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Level {lp.level}
            </span>
            <span style={{ fontSize: '0.55rem', color: 'var(--pip-green-dark)' }}>
              {Math.floor(lp.current_xp)} / {Math.floor(lp.required_xp)} XP
            </span>
          </div>
          <div style={{ height: '4px', background: 'rgba(46,194,126,0.15)', borderRadius: '2px' }}>
            <div style={{ height: '100%', width: `${levelPct}%`, background: '#34A853', borderRadius: '2px', transition: 'width 0.3s' }} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px', marginBottom: '12px', alignItems: 'baseline' }}>
          <div style={{ minWidth: '60px' }}>
            <div style={{ fontSize: '0.55rem', color: 'var(--pip-green-dark)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '2px' }}>Coins</div>
            <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--pip-text)' }}>{Math.round(user.coins)}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.55rem', color: 'var(--pip-green-dark)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '2px' }}>XP</div>
            <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--pip-text)' }}>{Math.round(user.xp)}</div>
          </div>
          {(user.task_streak ?? 0) > 1 && (
            <div>
              <div style={{ fontSize: '0.55rem', color: 'var(--pip-green-dark)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '2px' }}>Streak</div>
              <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#FBBC05' }}>🔥{user.task_streak}</div>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <button
            className="pip-btn"
            onClick={() => setShowFriendRequests(true)}
            style={{ position: 'relative', textAlign: 'left' }}
          >
            Friend Requests
            {friendRequestCount > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: '-6px',
                  right: '-6px',
                  background: '#EA4335',
                  color: 'white',
                  borderRadius: '50%',
                  width: '16px',
                  height: '16px',
                  fontSize: '0.6rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 'bold',
                }}
              >
                {friendRequestCount > 9 ? '9+' : friendRequestCount}
              </span>
            )}
          </button>

          <button className="pip-btn" onClick={() => setShowAchievements(true)}>
            Achievements
          </button>

          <button className="pip-btn" onClick={() => setShowAccount(true)}>
            Account Settings
          </button>

          <button
            className="pip-btn"
            onClick={onLogout}
            style={{ borderColor: '#EA4335', color: '#EA4335' }}
          >
            Logout
          </button>
        </div>
      </div>

      {showFriendRequests && (
        <FriendRequestsModal
          onClose={() => setShowFriendRequests(false)}
          onBadgeUpdate={setFriendRequestCount}
        />
      )}

      {showAccount && (
        <AccountModal onClose={() => setShowAccount(false)} />
      )}

      {showAchievements && (
        <AchievementsPanel onClose={() => setShowAchievements(false)} />
      )}
    </>
  )
}
