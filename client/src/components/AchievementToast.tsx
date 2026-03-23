import { useEffect } from 'react'
import { type NewAchievement } from '../api'

interface Props {
  toasts: NewAchievement[]
  onDismiss: (id: number) => void
}

export default function AchievementToasts({ toasts, onDismiss }: Props) {
  return (
    <div
      style={{
        position: 'fixed',
        bottom: '80px',
        right: '16px',
        zIndex: 3000,
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        pointerEvents: 'none',
      }}
    >
      {toasts.map((t) => (
        <AchievementToastItem key={t.id} achievement={t} onDismiss={onDismiss} />
      ))}
    </div>
  )
}

function AchievementToastItem({ achievement, onDismiss }: { achievement: NewAchievement; onDismiss: (id: number) => void }) {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(achievement.id), 5000)
    return () => clearTimeout(timer)
  }, [achievement.id, onDismiss])

  return (
    <div
      className="pip-panel"
      style={{
        padding: '10px 14px',
        minWidth: '220px',
        maxWidth: '280px',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        pointerEvents: 'auto',
        animation: 'fadeInRight 0.3s ease-out',
        borderColor: '#34A853',
        boxShadow: '0 0 12px rgba(52,168,83,0.4)',
      }}
    >
      <span style={{ fontSize: '1.4rem', flexShrink: 0 }}>{achievement.icon || '🏆'}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '0.6rem', color: 'var(--pip-green-dark)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '2px' }}>
          Achievement Unlocked!
        </div>
        <div style={{ fontSize: '0.75rem', color: 'var(--pip-green)', fontWeight: 'bold' }}>
          {achievement.name}
        </div>
        {achievement.description && (
          <div style={{ fontSize: '0.62rem', color: 'var(--pip-green-dark)', marginTop: '2px' }}>
            {achievement.description}
          </div>
        )}
      </div>
      <button
        onClick={() => onDismiss(achievement.id)}
        style={{ background: 'none', border: 'none', color: 'var(--pip-green-dark)', cursor: 'pointer', fontSize: '1rem', lineHeight: 1, flexShrink: 0 }}
      >
        ×
      </button>
    </div>
  )
}
