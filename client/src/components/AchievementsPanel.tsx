import { useEffect, useState } from 'react'
import api, { type Achievement } from '../api'

interface Props {
  open: boolean
  onClose: () => void
}

export default function AchievementsPanel({ open, onClose }: Props) {
  const [achievements, setAchievements] = useState<Achievement[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    api.get('/achievements/')
      .then((res) => setAchievements(res.data.achievements ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [open])

  if (!open) return null

  const earned = achievements.filter((a) => a.earned)
  const inProgress = achievements.filter((a) => !a.earned && !a.is_secret)
  const secret = achievements.filter((a) => !a.earned && a.is_secret)

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 3000,
      background: 'var(--pip-panel-bg)',
      display: 'flex',
      flexDirection: 'column',
      animation: 'slideUp 0.3s var(--ease-out-expo) both',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 'calc(var(--safe-top) + 14px) 16px 14px',
        borderBottom: '1px solid var(--pip-border)',
        flexShrink: 0,
      }}>
        <span className="sheet-title">Achievements</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {achievements.length > 0 && (
            <span style={{ fontSize: '0.65rem', color: 'var(--pip-green-dark)' }}>
              {earned.length} / {achievements.length}
            </span>
          )}
          <button className="sheet-close-btn" onClick={onClose}>×</button>
        </div>
      </div>

      <div style={{ padding: '12px 16px', flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', paddingTop: '8px' }}>
            {[...Array(4)].map((_, i) => (
              <div key={i} style={{ display: 'flex', gap: '12px', alignItems: 'center', padding: '12px', border: '1px solid rgba(26,115,70,0.18)', borderRadius: '6px' }}>
                <div className="skeleton" style={{ width: '36px', height: '36px', borderRadius: '50%', flexShrink: 0 }} />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div className="skeleton" style={{ height: '14px', width: `${50 + i * 10}%` }} />
                  <div className="skeleton" style={{ height: '10px', width: '90%' }} />
                </div>
              </div>
            ))}
          </div>
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
              <div style={{ fontSize: '0.85rem', color: 'var(--pip-green-dark)', textAlign: 'center', padding: '32px 0' }}>
                No achievements available yet.
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '20px' }}>
      <div className="section-label">{label}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
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
        padding: '12px',
        background: achievement.earned ? 'rgba(52,168,83,0.08)' : 'rgba(46,194,126,0.02)',
        border: `1px solid ${achievement.earned ? 'rgba(52,168,83,0.4)' : 'var(--pip-border)'}`,
        borderRadius: '4px',
        opacity: achievement.is_secret ? 0.7 : 1,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span style={{ fontSize: '1.4rem', flexShrink: 0 }}>{achievement.icon || '🏆'}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
            <span style={{ fontSize: '0.85rem', color: achievement.earned ? 'var(--pip-green)' : 'var(--pip-text)', fontWeight: achievement.earned ? 'bold' : 'normal' }}>
              {achievement.name}
            </span>
            {achievement.earned && achievement.datetime_earned && (
              <span style={{ fontSize: '0.6rem', color: 'var(--pip-green-dark)', flexShrink: 0 }}>
                {new Date(achievement.datetime_earned).toLocaleDateString()}
              </span>
            )}
          </div>
          {achievement.description && !achievement.is_secret && (
            <div style={{ fontSize: '0.72rem', color: 'var(--pip-green-dark)', marginTop: '2px' }}>
              {achievement.description}
            </div>
          )}
          {!achievement.earned && !achievement.is_secret && achievement.progress !== null && (
            <div style={{ marginTop: '6px' }}>
              <div className="level-bar-track">
                <div className="level-bar-fill" style={{ width: `${pct}%` }} />
              </div>
              <div style={{ fontSize: '0.6rem', color: 'var(--pip-green-dark)', marginTop: '3px' }}>
                {Math.floor(achievement.progress)} / {achievement.threshold}
              </div>
            </div>
          )}
        </div>
      </div>
      {rewards.length > 0 && !achievement.is_secret && (
        <div style={{ marginTop: '6px', marginLeft: '34px', fontSize: '0.65rem', color: 'var(--pip-green-dark)', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {rewards.map((r) => <span key={r}>{r}</span>)}
        </div>
      )}
    </div>
  )
}
