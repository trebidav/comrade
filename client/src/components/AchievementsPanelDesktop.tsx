import { useEffect, useState } from 'react'
import api, { type Achievement } from '../api'

interface Props {
  open?: boolean
  onClose: () => void
}

export default function AchievementsPanel({ open, onClose }: Props) {
  const [achievements, setAchievements] = useState<Achievement[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/achievements/')
      .then((res) => setAchievements(res.data.achievements ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const earned = achievements.filter((a) => a.earned)
  const inProgress = achievements.filter((a) => !a.earned && !a.is_secret)
  const secret = achievements.filter((a) => !a.earned && a.is_secret)

  if (!open) return null

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="pip-panel"
        style={{ width: '420px', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}
      >
        {/* Header */}
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--pip-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <span style={{ fontSize: '0.75rem', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            Achievements
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '0.65rem', color: 'var(--pip-green-dark)' }}>
              {earned.length} / {achievements.length} unlocked
            </span>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--pip-text)', cursor: 'pointer', fontSize: '1.2rem', lineHeight: 1 }}>×</button>
          </div>
        </div>

        {/* Content */}
        <div style={{ padding: '12px 16px', overflowY: 'auto', flex: 1 }}>
          {loading ? (
            <div style={{ fontSize: '0.75rem', color: 'var(--pip-green-dark)' }}>Loading...</div>
          ) : (
            <>
              {earned.length > 0 && (
                <Section label={`Earned (${earned.length})`}>
                  {earned.map((a) => <AchievementRow key={a.id} achievement={a} />)}
                </Section>
              )}
              {inProgress.length > 0 && (
                <Section label={`In Progress (${inProgress.length})`}>
                  {inProgress.map((a) => <AchievementRow key={a.id} achievement={a} />)}
                </Section>
              )}
              {secret.length > 0 && (
                <Section label={`Secret (${secret.length})`}>
                  {secret.map((a) => <AchievementRow key={a.id} achievement={a} />)}
                </Section>
              )}
              {achievements.length === 0 && (
                <div style={{ fontSize: '0.75rem', color: 'var(--pip-green-dark)', textAlign: 'center', padding: '20px 0' }}>
                  No achievements available yet.
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '16px' }}>
      <div style={{ fontSize: '0.6rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--pip-green)', borderBottom: '1px solid var(--pip-border)', paddingBottom: '4px', marginBottom: '8px' }}>
        {label}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {children}
      </div>
    </div>
  )
}

function AchievementRow({ achievement }: { achievement: Achievement }) {
  const pct = achievement.threshold > 0 && achievement.progress !== null
    ? Math.min(100, (achievement.progress / achievement.threshold) * 100)
    : achievement.earned ? 100 : 0

  const rewards = []
  if (achievement.reward_coins > 0) rewards.push(`🪙 ${achievement.reward_coins}`)
  if (achievement.reward_xp > 0) rewards.push(`⭐ ${achievement.reward_xp} XP`)
  if (achievement.reward_skill) rewards.push(`🎓 ${achievement.reward_skill}`)

  return (
    <div
      style={{
        padding: '8px 10px',
        background: achievement.earned ? 'rgba(52,168,83,0.08)' : 'rgba(46,194,126,0.02)',
        border: `1px solid ${achievement.earned ? 'rgba(52,168,83,0.4)' : 'var(--pip-border)'}`,
        opacity: achievement.is_secret ? 0.7 : 1,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>{achievement.icon || '🏆'}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.72rem', color: achievement.earned ? 'var(--pip-green)' : 'var(--pip-text)', fontWeight: achievement.earned ? 'bold' : 'normal' }}>
              {achievement.name}
            </span>
            {achievement.earned && achievement.datetime_earned && (
              <span style={{ fontSize: '0.58rem', color: 'var(--pip-green-dark)', flexShrink: 0 }}>
                {new Date(achievement.datetime_earned).toLocaleDateString()}
              </span>
            )}
          </div>
          {achievement.description && !achievement.is_secret && (
            <div style={{ fontSize: '0.62rem', color: 'var(--pip-green-dark)', marginTop: '1px' }}>
              {achievement.description}
            </div>
          )}
          {/* Progress bar */}
          {!achievement.earned && !achievement.is_secret && achievement.progress !== null && (
            <div style={{ marginTop: '4px' }}>
              <div style={{ height: '3px', background: 'rgba(46,194,126,0.15)', borderRadius: '1px' }}>
                <div style={{ height: '100%', width: `${pct}%`, background: '#34A853', borderRadius: '1px', transition: 'width 0.3s' }} />
              </div>
              <div style={{ fontSize: '0.58rem', color: 'var(--pip-green-dark)', marginTop: '2px' }}>
                {Math.floor(achievement.progress)} / {achievement.threshold}
              </div>
            </div>
          )}
        </div>
      </div>
      {rewards.length > 0 && !achievement.is_secret && (
        <div style={{ marginTop: '4px', marginLeft: '26px', fontSize: '0.6rem', color: 'var(--pip-green-dark)', display: 'flex', gap: '8px' }}>
          {rewards.map((r) => <span key={r}>{r}</span>)}
        </div>
      )}
    </div>
  )
}
