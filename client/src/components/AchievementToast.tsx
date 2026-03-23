import { useEffect, useState } from 'react'
import { type NewAchievement } from '../api'
import { useHaptics } from '../hooks/useHaptics'
import { IconAchievement } from './Icons'

interface Props {
  toasts: NewAchievement[]
  onDismiss: (id: number) => void
  onTap?: () => void
}

export default function AchievementToasts({ toasts, onDismiss, onTap }: Props) {
  return (
    <div className="toast-container">
      {toasts.map((t) => (
        <AchievementToastItem key={t.id} achievement={t} onDismiss={onDismiss} onTap={onTap} />
      ))}
    </div>
  )
}

function AchievementToastItem({ achievement, onDismiss, onTap }: { achievement: NewAchievement; onDismiss: (id: number) => void; onTap?: () => void }) {
  const [exiting, setExiting] = useState(false)
  const haptics = useHaptics()

  useEffect(() => {
    haptics.success()
    const timer = setTimeout(() => {
      setExiting(true)
      setTimeout(() => onDismiss(achievement.id), 320)
    }, 4700)
    return () => clearTimeout(timer)
  }, [achievement.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleClick = () => {
    if (exiting) return
    setExiting(true)
    setTimeout(() => onDismiss(achievement.id), 320)
    if (onTap) onTap()
  }

  return (
    <div
      className={`achievement-toast${exiting ? ' toast-exiting' : ''}`}
      onClick={handleClick}
    >
      <span style={{ flexShrink: 0 }}>
        {achievement.icon
          ? <span style={{ fontSize: '1.4rem' }}>{achievement.icon}</span>
          : <IconAchievement />
        }
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '0.55rem', color: 'var(--pip-green-dark)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '2px' }}>
          Achievement Unlocked!
        </div>
        <div style={{ fontSize: '0.8rem', color: 'var(--pip-green)', fontWeight: 'bold', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {achievement.name}
        </div>
      </div>
      {/* Countdown ring */}
      <svg width="20" height="20" viewBox="0 0 20 20" style={{ flexShrink: 0 }}>
        <circle cx="10" cy="10" r="8" fill="none" stroke="var(--glass-border)" strokeWidth="2" />
        <circle
          cx="10" cy="10" r="8" fill="none"
          stroke="#34A853" strokeWidth="2"
          strokeDasharray="50.3" strokeDashoffset="0"
          style={{
            animation: 'toastCountdown 4.7s linear forwards',
            transformOrigin: 'center',
            transform: 'rotate(-90deg)',
          }}
        />
      </svg>
    </div>
  )
}
