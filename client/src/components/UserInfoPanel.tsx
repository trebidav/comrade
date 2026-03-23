import { useState, useEffect } from 'react'
import { type User } from '../api'
import FriendRequestsModal from './FriendRequestsModal'
import AccountModal from './AccountModal'
import AchievementsPanel from './AchievementsPanel'
import { useHaptics } from '../hooks/useHaptics'
import { IconFriends, IconTrophy, IconSettings, IconLogout } from './Icons'

interface Props {
  user: User
  onLogout: () => void
}

export default function UserInfoPanel({ user, onLogout }: Props) {
  const [showFriendRequests, setShowFriendRequests] = useState(false)
  const [showAccount, setShowAccount] = useState(false)
  const [showAchievements, setShowAchievements] = useState(false)
  const [friendRequestCount, setFriendRequestCount] = useState(0)
  const haptics = useHaptics()

  const lp = user.level_progress ?? { level: user.level ?? 0, current_xp: 0, required_xp: 1000 }
  const levelPct = lp.required_xp > 0 ? Math.min(100, (lp.current_xp / lp.required_xp) * 100) : 0
  const initial = (user.username?.[0] ?? '?').toUpperCase()

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
      } catch { /* ignore */ }
    }
    fetchCount()
    const interval = setInterval(fetchCount, 30000)
    return () => clearInterval(interval)
  }, [])

  const menuItems = [
    {
      label: 'Friend Requests',
      icon: <IconFriends size={20} />,
      badge: friendRequestCount,
      onClick: () => { haptics.light(); setShowFriendRequests(true) },
    },
    {
      label: 'Achievements',
      icon: <IconTrophy size={20} />,
      onClick: () => { haptics.light(); setShowAchievements(true) },
    },
    {
      label: 'Account Settings',
      icon: <IconSettings size={20} />,
      onClick: () => { haptics.light(); setShowAccount(true) },
    },
  ]

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* User header */}
        <div style={{ padding: '20px 16px 16px', borderBottom: '1px solid var(--glass-border)' }}>
          <div style={{ fontSize: '0.55rem', letterSpacing: '0.12em', color: 'var(--pip-green)', textTransform: 'uppercase', marginBottom: '14px' }}>
            COMRADE v0.1.0-beta
          </div>

          {/* Avatar + username row */}
          <div style={{ display: 'flex', gap: '14px', alignItems: 'center', marginBottom: '16px' }}>
            <div className="avatar">{initial}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: 'var(--pip-text)', marginBottom: '2px' }}>
                {user.username}
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--pip-green-dark)', wordBreak: 'break-all' }}>
                {user.email}
              </div>
            </div>
          </div>

          {/* Level bar */}
          <div style={{ marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <span style={{ fontSize: '0.65rem', color: 'var(--pip-green)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Level {lp.level}
              </span>
              <span style={{ fontSize: '0.6rem', color: 'var(--pip-green-dark)' }}>
                {Math.floor(lp.current_xp)} / {Math.floor(lp.required_xp)} XP
              </span>
            </div>
            <div className="level-bar-track">
              <div className="level-bar-fill" style={{ width: `${levelPct}%` }} />
            </div>
          </div>

          {/* Stats row — glassmorphism cards */}
          <div style={{ display: 'flex', gap: '8px' }}>
            <div className="stat-card" style={{ animationDelay: '0ms' }}>
              <div style={{ fontSize: '0.5rem', color: 'var(--pip-green-dark)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>Coins</div>
              <div style={{ fontSize: '1.05rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}>
                <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: '#FBBC05', display: 'inline-block' }} />
                {Math.round(user.coins)}
              </div>
            </div>
            <div className="stat-card" style={{ animationDelay: '60ms' }}>
              <div style={{ fontSize: '0.5rem', color: 'var(--pip-green-dark)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>XP</div>
              <div style={{ fontSize: '1.05rem', fontWeight: 'bold', color: '#4285F4' }}>{Math.round(user.xp)}</div>
            </div>
            {(user.task_streak ?? 0) > 1 && (
              <div className="stat-card" style={{ animationDelay: '120ms' }}>
                <div style={{ fontSize: '0.5rem', color: 'var(--pip-green-dark)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>Streak</div>
                <div style={{ fontSize: '1.05rem', fontWeight: 'bold', color: '#FBBC05' }}>🔥{user.task_streak}</div>
              </div>
            )}
          </div>
        </div>

        {/* Menu items */}
        <div style={{ padding: '4px 16px', overflowY: 'auto', flex: 1, WebkitOverflowScrolling: 'touch' }}>
          {menuItems.map((item) => (
            <button
              key={item.label}
              onClick={item.onClick}
              className="menu-row"
              style={{ width: '100%', border: 'none', color: 'var(--pip-text)', fontFamily: 'var(--pip-font)', textAlign: 'left' }}
            >
              <span style={{ width: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{item.icon}</span>
              <span style={{ fontSize: '0.9rem', flex: 1 }}>{item.label}</span>
              {item.badge != null && item.badge > 0 && (
                <span style={{
                  background: '#EA4335',
                  color: 'white',
                  borderRadius: '10px',
                  padding: '1px 7px',
                  fontSize: '0.65rem',
                  fontWeight: 'bold',
                  fontFamily: 'monospace',
                }}>
                  {item.badge > 9 ? '9+' : item.badge}
                </span>
              )}
              <span style={{ color: 'var(--pip-green-dark)', fontSize: '1rem' }}>›</span>
            </button>
          ))}

          <button
            onClick={() => { haptics.medium(); onLogout() }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
              padding: '16px 0',
              background: 'transparent',
              border: 'none',
              color: '#EA4335',
              cursor: 'pointer',
              fontFamily: 'var(--pip-font)',
              textAlign: 'left',
              width: '100%',
              touchAction: 'manipulation',
              minHeight: '56px',
              marginTop: '8px',
              transition: 'padding-left 0.15s var(--ease-out-expo)',
            }}
            onPointerDown={(e) => (e.currentTarget.style.paddingLeft = '6px')}
            onPointerUp={(e) => (e.currentTarget.style.paddingLeft = '0')}
            onPointerLeave={(e) => (e.currentTarget.style.paddingLeft = '0')}
          >
            <span style={{ width: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><IconLogout size={20} color="#EA4335" /></span>
            <span style={{ fontSize: '0.9rem' }}>Logout</span>
          </button>
        </div>
      </div>

      <FriendRequestsModal
        open={showFriendRequests}
        onClose={() => setShowFriendRequests(false)}
        onBadgeUpdate={setFriendRequestCount}
      />
      <AccountModal
        open={showAccount}
        onClose={() => setShowAccount(false)}
      />
      <AchievementsPanel
        open={showAchievements}
        onClose={() => setShowAchievements(false)}
      />
    </>
  )
}
