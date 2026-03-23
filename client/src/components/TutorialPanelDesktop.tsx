import { useEffect, useState } from 'react'
import api, { type Task, type TutorialData, type TutorialPart, type NewAchievement, realTaskId } from '../api'

interface Props {
  task: Task
  onCompleted: (taskId: number, taskName: string) => void
  onLocate: (task: Task) => void
  onAction: (action: string, taskId: number) => Promise<void>
  onNewAchievements?: (achievements: NewAchievement[]) => void
}

export default function TutorialPanel({ task, onCompleted, onLocate, onAction, onNewAchievements }: Props) {
  const [tutorial, setTutorial] = useState<TutorialData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const tutorialId = realTaskId(task)

  const fetchTutorial = async () => {
    try {
      const res = await api.get(`/tutorial/${tutorialId}/`)
      setTutorial(res.data)
    } catch {
      setError('Failed to load tutorial')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchTutorial() }, [tutorialId])

  const currentPart = tutorial?.parts.find((p) => !p.completed) ?? null
  const allDone = tutorial ? tutorial.parts.every((p) => p.completed) : false
  const progress = tutorial ? tutorial.parts.filter((p) => p.completed).length : 0
  const total = tutorial?.parts.length ?? 0

  const submitPart = async (partId: number, data: Record<string, unknown> | FormData) => {
    setSubmitting(true)
    setError('')
    try {
      const res = await api.post(`/tutorial/${tutorialId}/submit/${partId}/`, data,
        data instanceof FormData ? { headers: { 'Content-Type': 'multipart/form-data' } } : undefined
      )
      if (res.data.completed) {
        if (res.data.new_achievements?.length && onNewAchievements) {
          onNewAchievements(res.data.new_achievements)
        }
        onCompleted(task.id, task.name)
      } else {
        fetchTutorial()
      }
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error
      setError(msg || 'Submission failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="pip-panel"
      style={{
        position: 'absolute',
        bottom: '16px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 1000,
        minWidth: '300px',
        maxWidth: '420px',
        padding: '12px 16px',
        maxHeight: '70vh',
        overflowY: 'auto',
      }}
    >
      {/* Header */}
      <div style={{ fontSize: '0.6rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--pip-green-dark)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#4285F4', display: 'inline-block' }} />
        Tutorial Task
        {task.lat != null && task.lon != null && (
          <button className="pip-popup-btn" style={{ marginLeft: 'auto', fontSize: '0.55rem', padding: '1px 6px' }} onClick={() => onLocate(task)}>Locate</button>
        )}
        <button className="pip-popup-btn" style={{ fontSize: '0.55rem', padding: '1px 6px', borderColor: '#EA4335', color: '#EA4335' }} onClick={() => onAction('abandon', task.id)}>Abandon</button>
      </div>

      <div style={{ fontSize: '0.9rem', fontWeight: 'bold', color: 'var(--pip-text)', marginBottom: '8px' }}>{task.name}</div>

      {error && (
        <div style={{ fontSize: '0.7rem', color: '#EA4335', marginBottom: '8px', padding: '4px 6px', border: '1px solid rgba(234,67,53,0.4)', background: 'rgba(234,67,53,0.08)' }}>
          {error}
        </div>
      )}

      {loading && <div style={{ fontSize: '0.75rem', color: 'var(--pip-green-dark)' }}>Loading...</div>}

      {tutorial && !allDone && (
        <>
          {/* Progress bar */}
          <div style={{ marginBottom: '10px' }}>
            <div style={{ fontSize: '0.6rem', color: 'var(--pip-green-dark)', marginBottom: '3px' }}>
              Step {progress + 1} of {total} — {tutorial.reward_skill_name} certification
            </div>
            <div style={{ height: '3px', background: 'var(--pip-border)', borderRadius: '2px' }}>
              <div style={{ height: '100%', width: `${(progress / total) * 100}%`, background: 'var(--pip-green)', borderRadius: '2px', transition: 'width 0.3s' }} />
            </div>
          </div>

          {currentPart && <PartRenderer part={currentPart} onSubmit={submitPart} submitting={submitting} />}
        </>
      )}

      {tutorial && allDone && (
        <div style={{ fontSize: '0.8rem', color: 'var(--pip-green)', textAlign: 'center', padding: '8px 0' }}>
          All parts complete!
        </div>
      )}
    </div>
  )
}

// ── Part Renderers ─────────────────────────────────────────────────────────────

function PartRenderer({ part, onSubmit, submitting }: {
  part: TutorialPart
  onSubmit: (partId: number, data: Record<string, unknown> | FormData) => void
  submitting: boolean
}) {
  if (part.type === 'text') return <TextPart part={part} onSubmit={onSubmit} submitting={submitting} />
  if (part.type === 'video') return <VideoPart part={part} onSubmit={onSubmit} submitting={submitting} />
  if (part.type === 'quiz') return <QuizPart part={part} onSubmit={onSubmit} submitting={submitting} />
  if (part.type === 'password') return <PasswordPart part={part} onSubmit={onSubmit} submitting={submitting} />
  if (part.type === 'file_upload') return <FileUploadPart part={part} onSubmit={onSubmit} submitting={submitting} />
  return null
}

function PartHeader({ part }: { part: TutorialPart }) {
  const icons: Record<string, string> = { text: '📄', video: '▶', quiz: '?', password: '🔑', file_upload: '📎' }
  return (
    <div style={{ marginBottom: '8px', paddingBottom: '6px', borderBottom: '1px solid var(--pip-border)' }}>
      <span style={{ fontSize: '0.6rem', color: 'var(--pip-green-dark)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
        {icons[part.type]} {part.type}
      </span>
      {part.title && <div style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--pip-green)', marginTop: '2px' }}>{part.title}</div>}
    </div>
  )
}

type SubmitFn = (id: number, d: Record<string, unknown> | FormData) => void

function TextPart({ part, onSubmit, submitting }: { part: TutorialPart; onSubmit: SubmitFn; submitting: boolean }) {
  return (
    <div>
      <PartHeader part={part} />
      <div style={{ fontSize: '0.75rem', color: 'var(--pip-text)', lineHeight: 1.6, marginBottom: '12px', whiteSpace: 'pre-wrap' }}>
        {part.text_content}
      </div>
      <button className="pip-popup-btn pip-popup-btn-primary" onClick={() => onSubmit(part.id, {})} disabled={submitting}>
        {submitting ? 'Saving...' : 'Continue'}
      </button>
    </div>
  )
}

function VideoPart({ part, onSubmit, submitting }: { part: TutorialPart; onSubmit: SubmitFn; submitting: boolean }) {
  return (
    <div>
      <PartHeader part={part} />
      {part.video_url && (
        <div style={{ marginBottom: '10px' }}>
          <iframe
            src={part.video_url}
            style={{ width: '100%', height: '180px', border: '1px solid var(--pip-border)' }}
            allowFullScreen
            title={part.title}
          />
        </div>
      )}
      {part.text_content && (
        <div style={{ fontSize: '0.75rem', color: 'var(--pip-text)', marginBottom: '10px', whiteSpace: 'pre-wrap' }}>{part.text_content}</div>
      )}
      <button className="pip-popup-btn pip-popup-btn-primary" onClick={() => onSubmit(part.id, {})} disabled={submitting}>
        {submitting ? 'Saving...' : 'Continue'}
      </button>
    </div>
  )
}

function QuizPart({ part, onSubmit, submitting }: { part: TutorialPart; onSubmit: SubmitFn; submitting: boolean }) {
  const [selected, setSelected] = useState<Record<number, number>>({})

  const allAnswered = part.questions.every((q) => selected[q.id] != null)

  const handleSubmit = () => {
    const answers: Record<string, number> = {}
    for (const [qId, aId] of Object.entries(selected)) answers[qId] = aId
    onSubmit(part.id, { answers })
  }

  return (
    <div>
      <PartHeader part={part} />
      {part.questions.map((q) => (
        <div key={q.id} style={{ marginBottom: '12px' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--pip-text)', marginBottom: '6px', fontWeight: 'bold' }}>{q.text}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {q.answers.map((a) => {
              const isSelected = selected[q.id] === a.id
              return (
                <button
                  key={a.id}
                  onClick={() => setSelected((prev) => ({ ...prev, [q.id]: a.id }))}
                  style={{
                    textAlign: 'left',
                    fontSize: '0.72rem',
                    padding: '5px 8px',
                    background: isSelected ? 'rgba(52,168,83,0.15)' : 'transparent',
                    border: `1px solid ${isSelected ? '#34A853' : 'var(--pip-border)'}`,
                    color: isSelected ? '#34A853' : 'var(--pip-text)',
                    cursor: 'pointer',
                    fontFamily: 'var(--pip-font)',
                    borderRadius: '2px',
                  }}
                >
                  {a.text}
                </button>
              )
            })}
          </div>
        </div>
      ))}
      <button className="pip-popup-btn pip-popup-btn-primary" onClick={handleSubmit} disabled={submitting || !allAnswered}>
        {submitting ? 'Checking...' : 'Submit Answers'}
      </button>
    </div>
  )
}

function PasswordPart({ part, onSubmit, submitting }: { part: TutorialPart; onSubmit: SubmitFn; submitting: boolean }) {
  const [password, setPassword] = useState('')

  return (
    <div>
      <PartHeader part={part} />
      {part.text_content && (
        <div style={{ fontSize: '0.75rem', color: 'var(--pip-text)', marginBottom: '10px', whiteSpace: 'pre-wrap' }}>{part.text_content}</div>
      )}
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Enter access code..."
        onKeyDown={(e) => e.key === 'Enter' && password && onSubmit(part.id, { password })}
        style={{
          width: '100%',
          background: 'rgba(46,194,126,0.05)',
          border: '1px solid var(--pip-border)',
          color: 'var(--pip-text)',
          fontFamily: 'var(--pip-font)',
          fontSize: '0.72rem',
          padding: '5px 7px',
          boxSizing: 'border-box',
          outline: 'none',
          marginBottom: '8px',
        }}
      />
      <button
        className="pip-popup-btn pip-popup-btn-primary"
        onClick={() => onSubmit(part.id, { password })}
        disabled={submitting || !password}
      >
        {submitting ? 'Verifying...' : 'Submit Code'}
      </button>
    </div>
  )
}

function FileUploadPart({ part, onSubmit, submitting }: { part: TutorialPart; onSubmit: SubmitFn; submitting: boolean }) {
  const [file, setFile] = useState<File | null>(null)

  const handleSubmit = () => {
    if (!file) return
    const fd = new FormData()
    fd.append('file', file)
    onSubmit(part.id, fd)
  }

  return (
    <div>
      <PartHeader part={part} />
      {part.text_content && (
        <div style={{ fontSize: '0.75rem', color: 'var(--pip-text)', marginBottom: '10px', whiteSpace: 'pre-wrap' }}>{part.text_content}</div>
      )}
      <label
        style={{
          display: 'block',
          marginBottom: '8px',
          padding: '8px',
          border: '1px dashed var(--pip-border)',
          background: file ? 'rgba(52,168,83,0.08)' : 'transparent',
          cursor: 'pointer',
          fontSize: '0.72rem',
          color: file ? '#34A853' : 'var(--pip-green-dark)',
          textAlign: 'center',
        }}
      >
        {file ? file.name : 'Click to select a file'}
        <input
          type="file"
          style={{ display: 'none' }}
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
      </label>
      <button
        className="pip-popup-btn pip-popup-btn-primary"
        onClick={handleSubmit}
        disabled={submitting || !file}
      >
        {submitting ? 'Uploading...' : 'Upload File'}
      </button>
    </div>
  )
}
