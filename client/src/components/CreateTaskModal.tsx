import { useEffect, useState } from 'react'
import api, { type Skill, CRITICALITY_LABELS } from '../api'
import BottomSheet from './BottomSheet'

type PartType = 'text' | 'video' | 'quiz' | 'password' | 'file_upload' | 'freetext'

interface QuizAnswer { text: string; is_correct: boolean }
interface QuizQuestion { text: string; answers: QuizAnswer[] }

interface TutorialPart {
  type: PartType
  title: string
  text_content?: string
  video_url?: string
  password?: string
  min_length?: number
  max_length?: number
  questions?: QuizQuestion[]
}

interface Props {
  lat: number
  lon: number
  userSkills: string[]
  onCreated: () => void
  onClose: () => void
}

export default function CreateTaskModal({ lat, lon, userSkills, onCreated, onClose }: Props) {
  const [tab, setTab] = useState<'task' | 'tutorial'>('task')
  const [availableSkills, setAvailableSkills] = useState<Skill[]>([])
  const [allSkills, setAllSkills] = useState<Skill[]>([])
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
  const [photo, setPhoto] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  // Tutorial state
  const [tutName, setTutName] = useState('')
  const [tutDescription, setTutDescription] = useState('')
  const [tutRewardSkill, setTutRewardSkill] = useState<number | ''>('')
  const [tutSkillExecute, setTutSkillExecute] = useState<number[]>([])
  const [tutParts, setTutParts] = useState<TutorialPart[]>([])
  const [tutSubmitting, setTutSubmitting] = useState(false)
  const [tutError, setTutError] = useState('')

  useEffect(() => {
    api.get('/skills/')
      .then((res) => {
        const all: Skill[] = res.data.skills ?? []
        setAllSkills(all)
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
      const fd = new FormData()
      fd.append('name', name.trim())
      fd.append('description', description.trim())
      fd.append('lat', String(lat))
      fd.append('lon', String(lon))
      fd.append('criticality', String(criticality))
      fd.append('minutes', String(minutes))
      if (coins) fd.append('coins', coins)
      if (xp) fd.append('xp', xp)
      fd.append('require_photo', String(requirePhoto))
      fd.append('require_comment', String(requireComment))
      fd.append('respawn', String(respawn))
      if (respawn && !respawnOffset) fd.append('respawn_time', respawnTime)
      if (respawn && respawnOffset) fd.append('respawn_offset', respawnOffset)
      skillRead.forEach((id) => fd.append('skill_read', String(id)))
      skillWrite.forEach((id) => fd.append('skill_write', String(id)))
      skillExecute.forEach((id) => fd.append('skill_execute', String(id)))
      if (photo) fd.append('photo', photo)
      await api.post('/tasks/create', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      onCreated()
      onClose()
    } catch (e: unknown) {
      const resp = (e as { response?: { data?: { error?: string; fields?: Record<string, string[]> } } })?.response?.data
      if (resp?.fields) {
        // Show first field error
        const firstField = Object.keys(resp.fields)[0]
        const firstError = resp.fields[firstField]
        setError(`${firstField}: ${Array.isArray(firstError) ? firstError[0] : firstError}`)
      } else {
        setError(resp?.error || 'Failed to create task')
      }
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
                minHeight: '36px',
                touchAction: 'manipulation',
              }}
            >
              {s.name}
            </button>
          )
        })}
      </div>
    </div>
  )

  const AllSkillSelector = ({ label, selected, onChange }: { label: string; selected: number[]; onChange: (v: number[]) => void }) => (
    <div style={{ marginBottom: '14px' }}>
      <div className="pip-label">{label}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
        {allSkills.length === 0 && (
          <span style={{ fontSize: '0.75rem', color: 'var(--pip-green-dark)' }}>No skills available</span>
        )}
        {allSkills.map((s) => {
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
                minHeight: '36px',
                touchAction: 'manipulation',
              }}
            >
              {s.name}
            </button>
          )
        })}
      </div>
    </div>
  )

  const addTutorialPart = () => {
    setTutParts([...tutParts, { type: 'text', title: '', text_content: '' }])
  }

  const updatePart = (index: number, updated: Partial<TutorialPart>) => {
    setTutParts(tutParts.map((p, i) => i === index ? { ...p, ...updated } : p))
  }

  const removePart = (index: number) => {
    setTutParts(tutParts.filter((_, i) => i !== index))
  }

  const addQuestion = (partIndex: number) => {
    const part = tutParts[partIndex]
    const questions = part.questions ?? []
    updatePart(partIndex, { questions: [...questions, { text: '', answers: [{ text: '', is_correct: false }] }] })
  }

  const updateQuestion = (partIndex: number, qIndex: number, updated: Partial<QuizQuestion>) => {
    const part = tutParts[partIndex]
    const questions = (part.questions ?? []).map((q, i) => i === qIndex ? { ...q, ...updated } : q)
    updatePart(partIndex, { questions })
  }

  const addAnswer = (partIndex: number, qIndex: number) => {
    const part = tutParts[partIndex]
    const questions = (part.questions ?? []).map((q, i) =>
      i === qIndex ? { ...q, answers: [...q.answers, { text: '', is_correct: false }] } : q
    )
    updatePart(partIndex, { questions })
  }

  const updateAnswer = (partIndex: number, qIndex: number, aIndex: number, updated: Partial<QuizAnswer>) => {
    const part = tutParts[partIndex]
    const questions = (part.questions ?? []).map((q, qi) =>
      qi === qIndex ? { ...q, answers: q.answers.map((a, ai) => ai === aIndex ? { ...a, ...updated } : a) } : q
    )
    updatePart(partIndex, { questions })
  }

  const handleTutorialSubmit = async () => {
    if (!tutName.trim()) { setTutError('Name is required'); return }
    setTutSubmitting(true)
    setTutError('')
    try {
      await api.post('/tutorials/create', {
        name: tutName.trim(),
        description: tutDescription.trim(),
        lat,
        lon,
        reward_skill: tutRewardSkill || undefined,
        skill_execute: tutSkillExecute,
        parts: tutParts.map((p) => {
          const base: Record<string, unknown> = { type: p.type, title: p.title }
          if (p.type === 'text') base.text_content = p.text_content
          if (p.type === 'video') base.video_url = p.video_url
          if (p.type === 'password') base.password = p.password
          if (p.type === 'freetext') { base.min_length = p.min_length; base.max_length = p.max_length }
          if (p.type === 'quiz') base.questions = p.questions
          return base
        }),
      })
      onCreated()
      onClose()
    } catch (e: unknown) {
      const resp = (e as { response?: { data?: { error?: string; fields?: Record<string, string[]> } } })?.response?.data
      if (resp?.fields) {
        const firstField = Object.keys(resp.fields)[0]
        const firstError = resp.fields[firstField]
        setTutError(`${firstField}: ${Array.isArray(firstError) ? firstError[0] : firstError}`)
      } else {
        setTutError(resp?.error || 'Failed to create tutorial')
      }
    } finally {
      setTutSubmitting(false)
    }
  }

  const PART_TYPES: { value: PartType; label: string }[] = [
    { value: 'text', label: 'Text' },
    { value: 'video', label: 'Video' },
    { value: 'quiz', label: 'Quiz' },
    { value: 'password', label: 'Password' },
    { value: 'file_upload', label: 'File Upload' },
    { value: 'freetext', label: 'Free Text' },
  ]

  const renderPartFields = (part: TutorialPart, index: number) => {
    switch (part.type) {
      case 'text':
        return (
          <div style={{ marginTop: '8px' }}>
            <label className="pip-label">Text Content</label>
            <textarea value={part.text_content ?? ''} onChange={(e) => updatePart(index, { text_content: e.target.value })} rows={3} className="pip-input" style={{ resize: 'none' }} placeholder="Enter text content..." />
          </div>
        )
      case 'video':
        return (
          <div style={{ marginTop: '8px' }}>
            <label className="pip-label">Video URL</label>
            <input type="text" value={part.video_url ?? ''} onChange={(e) => updatePart(index, { video_url: e.target.value })} className="pip-input" placeholder="https://..." />
          </div>
        )
      case 'password':
        return (
          <div style={{ marginTop: '8px' }}>
            <label className="pip-label">Password</label>
            <input type="text" value={part.password ?? ''} onChange={(e) => updatePart(index, { password: e.target.value })} className="pip-input" placeholder="Enter password..." />
          </div>
        )
      case 'freetext':
        return (
          <div style={{ marginTop: '8px', display: 'flex', gap: '10px' }}>
            <div style={{ flex: 1 }}>
              <label className="pip-label">Min Length</label>
              <input type="number" min={0} value={part.min_length ?? ''} onChange={(e) => updatePart(index, { min_length: e.target.value ? Number(e.target.value) : undefined })} className="pip-input" />
            </div>
            <div style={{ flex: 1 }}>
              <label className="pip-label">Max Length</label>
              <input type="number" min={0} value={part.max_length ?? ''} onChange={(e) => updatePart(index, { max_length: e.target.value ? Number(e.target.value) : undefined })} className="pip-input" />
            </div>
          </div>
        )
      case 'quiz':
        return (
          <div style={{ marginTop: '8px' }}>
            {(part.questions ?? []).map((q, qIdx) => (
              <div key={qIdx} style={{ marginBottom: '10px', paddingLeft: '10px', borderLeft: '2px solid var(--pip-border)' }}>
                <label className="pip-label">Question {qIdx + 1}</label>
                <input type="text" value={q.text} onChange={(e) => updateQuestion(index, qIdx, { text: e.target.value })} className="pip-input" placeholder="Question text..." />
                {q.answers.map((a, aIdx) => (
                  <div key={aIdx} style={{ display: 'flex', gap: '6px', alignItems: 'center', marginTop: '4px' }}>
                    <input type="text" value={a.text} onChange={(e) => updateAnswer(index, qIdx, aIdx, { text: e.target.value })} className="pip-input" style={{ flex: 1 }} placeholder="Answer..." />
                    <label className="pip-toggle" style={{ flexShrink: 0 }}>
                      <input type="checkbox" checked={a.is_correct} onChange={(e) => updateAnswer(index, qIdx, aIdx, { is_correct: e.target.checked })} />
                      <span className="pip-toggle-slider" />
                    </label>
                    <span style={{ fontSize: '0.65rem', color: 'var(--pip-green-dark)', flexShrink: 0, width: '40px' }}>{a.is_correct ? 'Correct' : 'Wrong'}</span>
                  </div>
                ))}
                <button onClick={() => addAnswer(index, qIdx)} className="pip-btn" style={{ marginTop: '4px', fontSize: '0.7rem', padding: '4px 8px' }}>+ Add Answer</button>
              </div>
            ))}
            <button onClick={() => addQuestion(index)} className="pip-btn" style={{ fontSize: '0.7rem', padding: '4px 8px' }}>+ Add Question</button>
          </div>
        )
      default:
        return null
    }
  }

  const tabStyle = (active: boolean) => ({
    flex: 1,
    padding: '8px 12px',
    fontSize: '0.8rem',
    background: active ? 'rgba(52,168,83,0.2)' : 'transparent',
    border: `1px solid ${active ? '#34A853' : 'var(--pip-border)'}`,
    color: active ? '#34A853' : 'var(--pip-green-dark)',
    cursor: 'pointer' as const,
    minHeight: '36px',
    touchAction: 'manipulation' as const,
  })

  return (
    <BottomSheet open={true} onClose={onClose} title={tab === 'task' ? 'Create Task' : 'Create Tutorial'} height="full">
      <div style={{ padding: '16px' }}>
        {/* Tab Switcher */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
          <button style={tabStyle(tab === 'task')} onClick={() => setTab('task')}>Task</button>
          <button style={tabStyle(tab === 'tutorial')} onClick={() => setTab('tutorial')}>Tutorial</button>
        </div>

        <div style={{ fontSize: '0.7rem', color: 'var(--pip-green-dark)', marginBottom: '14px' }}>
          📍 {lat.toFixed(5)}, {lon.toFixed(5)}
        </div>

        {tab === 'task' && (
          <>
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

            {/* Photo */}
            <div style={{ marginBottom: '14px' }}>
              <label className="pip-label">Photo</label>
              {photoPreview && (
                <div style={{ position: 'relative', marginBottom: '8px' }}>
                  <img src={photoPreview} alt="Preview" style={{ width: '100%', maxHeight: '160px', objectFit: 'cover', borderRadius: '4px', border: '1px solid var(--pip-border)' }} />
                  <button
                    onClick={() => { setPhoto(null); setPhotoPreview(null) }}
                    style={{ position: 'absolute', top: '4px', right: '4px', background: 'rgba(0,0,0,0.6)', color: '#fff', border: 'none', borderRadius: '50%', width: '24px', height: '24px', cursor: 'pointer', fontSize: '14px', lineHeight: '24px', textAlign: 'center' }}
                  >×</button>
                </div>
              )}
              {!photoPreview && (
                <label style={{ display: 'block', padding: '12px', border: '1px dashed var(--pip-border)', textAlign: 'center', cursor: 'pointer', fontSize: '0.8rem', color: 'var(--pip-green-dark)' }}>
                  Tap to add photo
                  <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) { setPhoto(file); setPhotoPreview(URL.createObjectURL(file)) }
                  }} />
                </label>
              )}
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
                      padding: '10px 6px',
                      background: criticality === c ? 'rgba(52,168,83,0.2)' : 'transparent',
                      border: `1px solid ${criticality === c ? '#34A853' : 'var(--pip-border)'}`,
                      color: criticality === c ? '#34A853' : 'var(--pip-green-dark)',
                      cursor: 'pointer',
                      minHeight: '44px',
                      touchAction: 'manipulation',
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
              {[
                { label: 'Require Photo', val: requirePhoto, set: setRequirePhoto },
                { label: 'Require Comment', val: requireComment, set: setRequireComment },
              ].map(({ label, val, set }) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.85rem' }}>{label}</span>
                  <label className="pip-toggle">
                    <input type="checkbox" checked={val} onChange={(e) => set(e.target.checked)} />
                    <span className="pip-toggle-slider" />
                  </label>
                </div>
              ))}

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.85rem' }}>Respawn when Done</span>
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

            <div style={{ display: 'flex', gap: '10px', marginTop: '8px', paddingBottom: '8px' }}>
              <button className="pip-btn" onClick={onClose} disabled={submitting} style={{ flex: 1 }}>Cancel</button>
              <button className="pip-btn pip-btn-primary" onClick={handleSubmit} disabled={submitting} style={{ flex: 2 }}>
                {submitting ? 'Creating...' : 'Create Task'}
              </button>
            </div>
          </>
        )}

        {tab === 'tutorial' && (
          <>
            {tutError && (
              <div style={{ fontSize: '0.8rem', color: '#EA4335', marginBottom: '12px', padding: '8px', border: '1px solid rgba(234,67,53,0.4)', background: 'rgba(234,67,53,0.08)' }}>
                {tutError}
              </div>
            )}

            {/* Name */}
            <div style={{ marginBottom: '14px' }}>
              <label className="pip-label">Name *</label>
              <input
                type="text"
                value={tutName}
                onChange={(e) => setTutName(e.target.value)}
                placeholder="Tutorial name"
                className="pip-input"
                style={{ border: `1px solid ${tutError && !tutName.trim() ? '#EA4335' : 'var(--pip-border)'}` }}
              />
            </div>

            {/* Description */}
            <div style={{ marginBottom: '14px' }}>
              <label className="pip-label">Description</label>
              <textarea
                value={tutDescription}
                onChange={(e) => setTutDescription(e.target.value)}
                rows={2}
                placeholder="Optional description..."
                className="pip-input"
                style={{ resize: 'none' }}
              />
            </div>

            {/* Reward Skill */}
            <div style={{ marginBottom: '14px' }}>
              <label className="pip-label">Reward Skill</label>
              <select
                value={tutRewardSkill}
                onChange={(e) => setTutRewardSkill(e.target.value ? Number(e.target.value) : '')}
                className="pip-input"
              >
                <option value="">-- None --</option>
                {allSkills.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            {/* Prerequisite Skills */}
            <AllSkillSelector label="Prerequisite Skills (who can start)" selected={tutSkillExecute} onChange={setTutSkillExecute} />

            {/* Parts */}
            <div style={{ marginBottom: '14px' }}>
              <div className="pip-label">Parts</div>
              {tutParts.map((part, idx) => (
                <div key={idx} style={{ marginBottom: '12px', padding: '10px', border: '1px solid var(--pip-border)', borderRadius: '3px', position: 'relative' }}>
                  <button
                    onClick={() => removePart(idx)}
                    style={{ position: 'absolute', top: '4px', right: '4px', background: 'none', border: 'none', color: '#EA4335', cursor: 'pointer', fontSize: '1.1rem', lineHeight: 1 }}
                  >×</button>
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                    <div style={{ flex: 1 }}>
                      <label className="pip-label">Type</label>
                      <select
                        value={part.type}
                        onChange={(e) => updatePart(idx, { type: e.target.value as PartType })}
                        className="pip-input"
                      >
                        {PART_TYPES.map((pt) => (
                          <option key={pt.value} value={pt.value}>{pt.label}</option>
                        ))}
                      </select>
                    </div>
                    <div style={{ flex: 2 }}>
                      <label className="pip-label">Title</label>
                      <input
                        type="text"
                        value={part.title}
                        onChange={(e) => updatePart(idx, { title: e.target.value })}
                        placeholder="Part title..."
                        className="pip-input"
                      />
                    </div>
                  </div>
                  {renderPartFields(part, idx)}
                </div>
              ))}
              <button onClick={addTutorialPart} className="pip-btn" style={{ fontSize: '0.8rem', padding: '8px 14px' }}>+ Add Part</button>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '8px', paddingBottom: '8px' }}>
              <button className="pip-btn" onClick={onClose} disabled={tutSubmitting} style={{ flex: 1 }}>Cancel</button>
              <button className="pip-btn pip-btn-primary" onClick={handleTutorialSubmit} disabled={tutSubmitting} style={{ flex: 2 }}>
                {tutSubmitting ? 'Creating...' : 'Create Tutorial'}
              </button>
            </div>
          </>
        )}
      </div>
    </BottomSheet>
  )
}
