import { useEffect, useState } from 'react'
import api, { type Skill, CRITICALITY_LABELS } from '../api'

interface Props {
  lat: number
  lon: number
  userSkills: string[]
  onCreated: () => void
  onClose: () => void
}

export default function CreateTaskModalDesktop({ lat, lon, userSkills, onCreated, onClose }: Props) {
  const [availableSkills, setAvailableSkills] = useState<Skill[]>([])
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [criticality, setCriticality] = useState(1)
  const [minutes, setMinutes] = useState(60)
  const [coins, setCoins] = useState('')
  const [xp, setXp] = useState('')
  const [requirePhoto, setRequirePhoto] = useState(false)
  const [requireComment, setRequireComment] = useState(false)
  const [respawn, setRespawn] = useState(false)
  const [respawnTime, setRespawnTime] = useState('10:00')
  const [respawnOffset, setRespawnOffset] = useState('')
  const [skillRead, setSkillRead] = useState<number[]>([])
  const [skillWrite, setSkillWrite] = useState<number[]>([])
  const [skillExecute, setSkillExecute] = useState<number[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    api.get('/skills/')
      .then((res) => {
        const all: Skill[] = res.data.skills ?? []
        setAvailableSkills(all.filter((s) => userSkills.includes(s.name)))
      })
      .catch(() => {})
  }, [userSkills])

  const toggleSkill = (id: number, selected: number[], setSelected: (v: number[]) => void) => {
    setSelected(selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id])
  }

  const handleSubmit = async () => {
    if (!name.trim()) { setError('Name is required'); return }
    setSubmitting(true)
    setError('')
    try {
      await api.post('/tasks/create', {
        name: name.trim(),
        description: description.trim(),
        lat,
        lon,
        criticality,
        minutes,
        coins: coins ? Number(coins) : null,
        xp: xp ? Number(xp) : null,
        require_photo: requirePhoto,
        require_comment: requireComment,
        respawn,
        respawn_time: respawn && !respawnOffset ? respawnTime : null,
        respawn_offset: respawn && respawnOffset ? Number(respawnOffset) : null,
        skill_read: skillRead,
        skill_write: skillWrite,
        skill_execute: skillExecute,
      })
      onCreated()
      onClose()
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error
      setError(msg || 'Failed to create task')
    } finally {
      setSubmitting(false)
    }
  }

  const SkillSelector = ({ label, selected, onChange }: { label: string; selected: number[]; onChange: (v: number[]) => void }) => (
    <div style={{ marginBottom: '14px' }}>
      <div className="pip-label">{label}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
        {availableSkills.length === 0 && (
          <span style={{ fontSize: '0.75rem', color: 'var(--pip-green-dark)' }}>No skills available</span>
        )}
        {availableSkills.map((s) => {
          const active = selected.includes(s.id)
          return (
            <button
              key={s.id}
              onClick={() => toggleSkill(s.id, selected, onChange)}
              style={{
                fontSize: '0.75rem',
                padding: '6px 12px',
                background: active ? 'rgba(52,168,83,0.2)' : 'transparent',
                border: `1px solid ${active ? '#34A853' : 'var(--pip-border)'}`,
                color: active ? '#34A853' : 'var(--pip-green-dark)',
                cursor: 'pointer',
                borderRadius: '3px',
              }}
            >
              {s.name}
            </button>
          )
        })}
      </div>
    </div>
  )

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
      <div className="pip-panel" style={{ width: '480px', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{
          padding: '12px 16px',
          borderBottom: '1px solid var(--pip-border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexShrink: 0,
        }}>
          <span style={{ fontSize: '0.75rem', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            Create Task
          </span>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--pip-text)', cursor: 'pointer', fontSize: '1.2rem', lineHeight: 1 }}
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '16px', overflowY: 'auto', flex: 1 }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--pip-green-dark)', marginBottom: '14px' }}>
            📍 {lat.toFixed(5)}, {lon.toFixed(5)}
          </div>

          {error && (
            <div style={{ fontSize: '0.8rem', color: '#EA4335', marginBottom: '12px', padding: '8px', border: '1px solid rgba(234,67,53,0.4)', background: 'rgba(234,67,53,0.08)' }}>
              {error}
            </div>
          )}

          {/* Name */}
          <div style={{ marginBottom: '14px' }}>
            <label className="pip-label">Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Task name"
              className="pip-input"
              style={{ border: `1px solid ${error && !name.trim() ? '#EA4335' : 'var(--pip-border)'}` }}
            />
          </div>

          {/* Description */}
          <div style={{ marginBottom: '14px' }}>
            <label className="pip-label">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Optional description..."
              className="pip-input"
              style={{ resize: 'none' }}
            />
          </div>

          {/* Criticality */}
          <div style={{ marginBottom: '14px' }}>
            <div className="pip-label">Criticality</div>
            <div style={{ display: 'flex', gap: '8px' }}>
              {([1, 2, 3] as const).map((c) => (
                <button
                  key={c}
                  onClick={() => setCriticality(c)}
                  style={{
                    flex: 1,
                    fontSize: '0.8rem',
                    padding: '8px 6px',
                    background: criticality === c ? 'rgba(52,168,83,0.2)' : 'transparent',
                    border: `1px solid ${criticality === c ? '#34A853' : 'var(--pip-border)'}`,
                    color: criticality === c ? '#34A853' : 'var(--pip-green-dark)',
                    cursor: 'pointer',
                  }}
                >
                  {CRITICALITY_LABELS[c]}
                </button>
              ))}
            </div>
          </div>

          {/* Minutes + Coins + XP */}
          <div style={{ display: 'flex', gap: '10px', marginBottom: '14px' }}>
            <div style={{ flex: 1 }}>
              <label className="pip-label">Minutes</label>
              <input type="number" min={1} value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} className="pip-input" />
            </div>
            <div style={{ flex: 1 }}>
              <label className="pip-label">Coins (0–1)</label>
              <input type="number" min={0} max={1} step={0.01} value={coins} onChange={(e) => setCoins(e.target.value)} placeholder="Optional" className="pip-input" />
            </div>
            <div style={{ flex: 1 }}>
              <label className="pip-label">XP (0–1)</label>
              <input type="number" min={0} max={1} step={0.01} value={xp} onChange={(e) => setXp(e.target.value)} placeholder="Optional" className="pip-input" />
            </div>
          </div>

          {/* Toggles */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
            {[
              { label: 'Require Photo', val: requirePhoto, set: setRequirePhoto },
              { label: 'Require Comment', val: requireComment, set: setRequireComment },
            ].map(({ label, val, set }) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8rem' }}>{label}</span>
                <label className="pip-toggle">
                  <input type="checkbox" checked={val} onChange={(e) => set(e.target.checked)} />
                  <span className="pip-toggle-slider" />
                </label>
              </div>
            ))}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.8rem' }}>Respawn when Done</span>
              <label className="pip-toggle">
                <input type="checkbox" checked={respawn} onChange={(e) => setRespawn(e.target.checked)} />
                <span className="pip-toggle-slider" />
              </label>
            </div>
          </div>

          {respawn && (
            <div style={{ marginBottom: '16px', paddingLeft: '12px', borderLeft: '2px solid var(--pip-border)' }}>
              <div style={{ display: 'flex', gap: '10px' }}>
                <div style={{ flex: 1 }}>
                  <label className="pip-label">Offset (minutes)</label>
                  <input type="number" min={1} value={respawnOffset} onChange={(e) => setRespawnOffset(e.target.value)} placeholder="e.g. 60" className="pip-input" />
                </div>
                <div style={{ flex: 1, opacity: respawnOffset ? 0.4 : 1 }}>
                  <label className="pip-label">Fixed Time</label>
                  <input type="time" value={respawnTime} onChange={(e) => setRespawnTime(e.target.value)} disabled={!!respawnOffset} className="pip-input" />
                </div>
              </div>
            </div>
          )}

          <SkillSelector label="Read Skill (who sees this task)" selected={skillRead} onChange={setSkillRead} />
          <SkillSelector label="Execute Skill (who can start)" selected={skillExecute} onChange={setSkillExecute} />
          <SkillSelector label="Write Skill (who can review)" selected={skillWrite} onChange={setSkillWrite} />
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 16px',
          borderTop: '1px solid var(--pip-border)',
          display: 'flex',
          gap: '10px',
          flexShrink: 0,
        }}>
          <button className="pip-btn" onClick={onClose} disabled={submitting} style={{ flex: 1 }}>Cancel</button>
          <button className="pip-btn pip-btn-primary" onClick={handleSubmit} disabled={submitting} style={{ flex: 2 }}>
            {submitting ? 'Creating...' : 'Create Task'}
          </button>
        </div>
      </div>
    </div>
  )
}
