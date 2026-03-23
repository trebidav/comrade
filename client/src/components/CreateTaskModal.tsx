import { useEffect, useState } from 'react'
import api, { type Skill, CRITICALITY_LABELS } from '../api'

interface Props {
  lat: number
  lon: number
  userSkills: string[]
  onCreated: () => void
  onClose: () => void
}

export default function CreateTaskModal({ lat, lon, userSkills, onCreated, onClose }: Props) {
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
    <div style={{ marginBottom: '10px' }}>
      <div style={{ fontSize: '0.7rem', color: 'var(--pip-green)', marginBottom: '4px' }}>{label}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
        {availableSkills.length === 0 && (
          <span style={{ fontSize: '0.65rem', color: 'var(--pip-green-dark)' }}>No skills available</span>
        )}
        {availableSkills.map((s) => {
          const active = selected.includes(s.id)
          return (
            <button
              key={s.id}
              onClick={() => toggleSkill(s.id, selected, onChange)}
              style={{
                fontSize: '0.6rem',
                padding: '2px 7px',
                background: active ? 'rgba(52,168,83,0.2)' : 'transparent',
                border: `1px solid ${active ? '#34A853' : 'var(--pip-border)'}`,
                color: active ? '#34A853' : 'var(--pip-green-dark)',
                cursor: 'pointer',
                borderRadius: '2px',
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
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={onClose}
    >
      <div
        className="pip-panel"
        onClick={(e) => e.stopPropagation()}
        style={{ minWidth: '340px', maxWidth: '420px', maxHeight: '85vh', overflowY: 'auto', padding: '16px' }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <div style={{ fontSize: '0.6rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--pip-green-dark)' }}>
            Create New Task
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--pip-green-dark)', cursor: 'pointer', fontSize: '1rem', lineHeight: 1 }}>×</button>
        </div>

        <div style={{ fontSize: '0.65rem', color: 'var(--pip-green-dark)', marginBottom: '10px' }}>
          {lat.toFixed(5)}, {lon.toFixed(5)}
        </div>

        {error && (
          <div style={{ fontSize: '0.7rem', color: '#EA4335', marginBottom: '8px', padding: '4px 6px', border: '1px solid rgba(234,67,53,0.4)', background: 'rgba(234,67,53,0.08)' }}>
            {error}
          </div>
        )}

        {/* Name */}
        <div style={{ marginBottom: '10px' }}>
          <div style={labelStyle}>Name *</div>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Task name" style={inputStyle(!!error && !name.trim())} />
        </div>

        {/* Description */}
        <div style={{ marginBottom: '10px' }}>
          <div style={labelStyle}>Description</div>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Optional description..." style={{ ...inputStyle(false), resize: 'none' }} />
        </div>

        {/* Criticality */}
        <div style={{ marginBottom: '10px' }}>
          <div style={labelStyle}>Criticality</div>
          <div style={{ display: 'flex', gap: '6px' }}>
            {([1, 2, 3] as const).map((c) => (
              <button key={c} onClick={() => setCriticality(c)} style={toggleBtn(criticality === c)}>
                {CRITICALITY_LABELS[c]}
              </button>
            ))}
          </div>
        </div>

        {/* Minutes + Coins + XP */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
          <div style={{ flex: 1 }}>
            <div style={labelStyle}>Est. Minutes</div>
            <input type="number" min={1} value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} style={inputStyle(false)} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={labelStyle}>Coins (0–1)</div>
            <input type="number" min={0} max={1} step={0.01} value={coins} onChange={(e) => setCoins(e.target.value)} placeholder="Optional" style={inputStyle(false)} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={labelStyle}>XP (0–1)</div>
            <input type="number" min={0} max={1} step={0.01} value={xp} onChange={(e) => setXp(e.target.value)} placeholder="Optional" style={inputStyle(false)} />
          </div>
        </div>

        {/* Require Photo / Comment */}
        <div style={{ display: 'flex', gap: '16px', marginBottom: '12px' }}>
          {[
            { label: 'Require Photo', val: requirePhoto, set: setRequirePhoto },
            { label: 'Require Comment', val: requireComment, set: setRequireComment },
          ].map(({ label, val, set }) => (
            <label key={label} style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', fontSize: '0.7rem', color: 'var(--pip-green)' }}>
              <input type="checkbox" checked={val} onChange={(e) => set(e.target.checked)} />
              {label}
            </label>
          ))}
        </div>

        {/* Respawn */}
        <div style={{ marginBottom: '10px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.7rem', color: 'var(--pip-green)', marginBottom: '6px' }}>
            <input type="checkbox" checked={respawn} onChange={(e) => setRespawn(e.target.checked)} />
            Respawn when Done
          </label>
          {respawn && (
            <div style={{ paddingLeft: '8px', borderLeft: '2px solid var(--pip-border)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ fontSize: '0.65rem', color: 'var(--pip-green-dark)' }}>
                Offset (min after finish) — if set, overrides fixed time
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <div style={{ flex: 1 }}>
                  <div style={labelStyle}>Offset (minutes)</div>
                  <input
                    type="number"
                    min={1}
                    value={respawnOffset}
                    onChange={(e) => setRespawnOffset(e.target.value)}
                    placeholder="e.g. 60"
                    style={inputStyle(false)}
                  />
                </div>
                <div style={{ flex: 1, opacity: respawnOffset ? 0.4 : 1 }}>
                  <div style={labelStyle}>Fixed Time</div>
                  <input
                    type="time"
                    value={respawnTime}
                    onChange={(e) => setRespawnTime(e.target.value)}
                    disabled={!!respawnOffset}
                    style={inputStyle(false)}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Skill selectors */}
        <SkillSelector label="Read Skill (who sees this task)" selected={skillRead} onChange={setSkillRead} />
        <SkillSelector label="Execute Skill (who can start)" selected={skillExecute} onChange={setSkillExecute} />
        <SkillSelector label="Write Skill (who can review)" selected={skillWrite} onChange={setSkillWrite} />

        {/* Submit */}
        <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
          <button className="pip-popup-btn pip-popup-btn-primary" onClick={handleSubmit} disabled={submitting} style={{ flex: 1 }}>
            {submitting ? 'Creating...' : 'Create Task'}
          </button>
          <button className="pip-popup-btn" onClick={onClose} disabled={submitting}>Cancel</button>
        </div>
      </div>
    </div>
  )
}

const labelStyle: React.CSSProperties = { fontSize: '0.7rem', color: 'var(--pip-green)', marginBottom: '4px' }

function inputStyle(hasError: boolean): React.CSSProperties {
  return {
    width: '100%',
    background: 'rgba(46,194,126,0.05)',
    border: `1px solid ${hasError ? '#EA4335' : 'var(--pip-border)'}`,
    color: 'var(--pip-text)',
    fontFamily: 'var(--pip-font)',
    fontSize: '0.72rem',
    padding: '5px 7px',
    boxSizing: 'border-box',
    outline: 'none',
  }
}

function toggleBtn(active: boolean): React.CSSProperties {
  return {
    fontSize: '0.65rem',
    padding: '3px 10px',
    background: active ? 'rgba(52,168,83,0.2)' : 'transparent',
    border: `1px solid ${active ? '#34A853' : 'var(--pip-border)'}`,
    color: active ? '#34A853' : 'var(--pip-green-dark)',
    cursor: 'pointer',
  }
}
