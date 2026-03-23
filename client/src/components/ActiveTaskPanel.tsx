import { useState, useEffect, useRef } from 'react'
import { type Task, formatMinutes } from '../api'
import api from '../api'
import BottomSheet from './BottomSheet'
import { IconCamera } from './Icons'

interface Props {
  task: Task
  coinsModifier: number
  xpModifier: number
  timeModifierMinutes: number
  criticalityPercentage: number
  onFinished: (taskId: number, taskName: string) => void
  onAction: (action: string, taskId: number) => Promise<void>
  onLocate: (task: Task) => void
}

function computeElapsedMs(task: Task): number {
  const accumulated = (task.time_spent_minutes ?? 0) * 60000
  if (task.datetime_start) {
    const sessionMs = Date.now() - new Date(task.datetime_start).getTime()
    return accumulated + Math.max(0, sessionMs)
  }
  return accumulated
}

export default function ActiveTaskPanel({ task, coinsModifier, xpModifier, timeModifierMinutes, criticalityPercentage, onFinished, onAction, onLocate }: Props) {
  const [elapsedMs, setElapsedMs] = useState(() => computeElapsedMs(task))
  const taskRef = useRef(task)
  taskRef.current = task
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [comment, setComment] = useState('')
  const [finishing, setFinishing] = useState(false)
  const [showSheet, setShowSheet] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setElapsedMs(computeElapsedMs(task))
    const interval = setInterval(() => setElapsedMs(computeElapsedMs(taskRef.current)), 1000)
    return () => clearInterval(interval)
  }, [task.id, task.datetime_start, task.time_spent_minutes])

  const totalMinutes = elapsedMs / 60000
  const timeMultiplier = timeModifierMinutes > 0 ? totalMinutes / timeModifierMinutes : 1.0
  const criticalityFactor = 1.0 + ((task.criticality ?? 1) - 1) * criticalityPercentage
  const canConfirm = (!task.require_photo || photoFile !== null) && (!task.require_comment || comment.trim() !== '')

  const handleFinishConfirm = async () => {
    setFinishing(true)
    try {
      const form = new FormData()
      if (photoFile) form.append('photo', photoFile)
      form.append('comment', comment)
      await api.post(`/task/${task.id}/finish`, form, { headers: { 'Content-Type': 'multipart/form-data' } })
      onFinished(task.id, task.name)
      setShowSheet(false)
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error
      console.error('Finish failed:', msg)
    } finally {
      setFinishing(false)
      setPhotoFile(null)
      setComment('')
    }
  }

  return (
    <>
      {/* Compact bar — tapping opens the full sheet */}
      <div className="active-task-bar" onClick={() => setShowSheet(true)} style={{ cursor: 'pointer' }}>
        <span
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: task.state === 3 ? '#e67e22' : '#FBBC05',
            display: 'inline-block',
            flexShrink: 0,
            animation: task.state === 3 ? undefined : 'pip-blink 1.2s ease-in-out infinite',
          }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--pip-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {task.name}
          </div>
          <div style={{ fontSize: '0.65rem', color: task.state === 3 ? '#e67e22' : '#FBBC05' }}>
            {task.state === 3 ? 'Waiting · Tap to resume' : `Active · ${formatMinutes(totalMinutes)} elapsed`}
          </div>
        </div>
        <div style={{ fontSize: '0.7rem', color: 'var(--pip-green-dark)', flexShrink: 0, paddingLeft: '8px' }}>
          Tap ›
        </div>
      </div>

      {/* Full sheet for task details + actions */}
      <BottomSheet open={showSheet} onClose={() => setShowSheet(false)} title="Active Task" height="auto">
        <div style={{ padding: '16px' }}>
          {/* Task info */}
          <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: 'var(--pip-text)', marginBottom: '4px' }}>{task.name}</div>
          {task.description && (
            <div style={{ fontSize: '0.8rem', color: 'rgba(51,214,136,0.75)', marginBottom: '10px' }}>{task.description}</div>
          )}

          {/* Time row */}
          <div style={{ display: 'flex', gap: '16px', marginBottom: '12px', padding: '10px 12px', background: 'rgba(251,188,5,0.05)', border: '1px solid rgba(251,188,5,0.2)' }}>
            <div>
              <div style={{ fontSize: '0.6rem', color: 'var(--pip-green-dark)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Elapsed</div>
              <div style={{ fontSize: '1rem', color: '#FBBC05', fontWeight: 'bold' }}>{formatMinutes(totalMinutes)}</div>
            </div>
            {task.minutes != null && (
              <div>
                <div style={{ fontSize: '0.6rem', color: 'var(--pip-green-dark)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Est.</div>
                <div style={{ fontSize: '1rem', color: 'var(--pip-text)' }}>{formatMinutes(task.minutes)}</div>
              </div>
            )}
            {task.coins != null && (
              <div>
                <div style={{ fontSize: '0.6rem', color: 'var(--pip-green-dark)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Coins</div>
                <div style={{ fontSize: '1rem', color: '#FBBC05', fontWeight: 'bold' }}>
                  {Math.round(task.coins * coinsModifier * timeMultiplier)}
                </div>
              </div>
            )}
            {task.xp != null && (
              <div>
                <div style={{ fontSize: '0.6rem', color: 'var(--pip-green-dark)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>XP</div>
                <div style={{ fontSize: '1rem', color: '#4285F4', fontWeight: 'bold' }}>
                  {(() => {
                    const base = Math.round(task.xp! * xpModifier * timeMultiplier)
                    const extra = Math.round(task.xp! * xpModifier * timeMultiplier * criticalityFactor) - base
                    return <>{base}{extra > 0 && <span style={{ color: '#89b4f8', fontSize: '0.8rem' }}>+{extra}</span>}</>
                  })()}
                </div>
              </div>
            )}
          </div>

          {/* Finish form */}
          <div style={{ marginBottom: '14px' }}>
            <div className="pip-label">{task.require_comment ? 'Comment (required)' : 'Comment (optional)'}</div>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={2}
              placeholder="Describe what was done..."
              className="pip-input"
              style={{
                resize: 'none',
                border: `1px solid ${task.require_comment && !comment.trim() ? '#EA4335' : 'var(--pip-border)'}`,
              }}
            />
          </div>

          <div style={{ marginBottom: '18px' }}>
            <div className="pip-label">{task.require_photo ? 'Photo (required)' : 'Photo (optional)'}</div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)}
              style={{ display: 'none' }}
            />
            <button
              className="pip-btn"
              onClick={() => fileInputRef.current?.click()}
              style={{ width: '100%', fontSize: '0.8rem', gap: '8px' }}
            >
              <IconCamera size={18} />
              {photoFile ? photoFile.name : 'Choose Photo'}
            </button>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {task.state === 3 ? (
              <button
                className="pip-btn pip-btn-primary"
                onClick={() => { onAction('resume', task.id); setShowSheet(false) }}
                style={{ width: '100%', fontSize: '0.9rem' }}
              >
                Resume Task
              </button>
            ) : (
              <button
                className="pip-btn pip-btn-primary"
                onClick={handleFinishConfirm}
                disabled={finishing || !canConfirm}
                style={{ width: '100%', fontSize: '0.9rem' }}
              >
                {finishing ? 'Finishing...' : 'Finish Task'}
              </button>
            )}
            <div style={{ display: 'flex', gap: '10px' }}>
              {task.state !== 3 && (
                <button
                  className="pip-btn"
                  onClick={() => { onAction('pause', task.id); setShowSheet(false) }}
                  style={{ flex: 1 }}
                >
                  Pause
                </button>
              )}
              {task.lat != null && task.lon != null && (
                <button
                  className="pip-btn"
                  onClick={() => { onLocate(task); setShowSheet(false) }}
                  style={{ flex: 1 }}
                >
                  Locate
                </button>
              )}
              <button
                className="pip-btn"
                style={{ flex: 1, borderColor: '#EA4335', color: '#EA4335' }}
                onClick={() => { onAction('abandon', task.id); setShowSheet(false) }}
              >
                Abandon
              </button>
            </div>
          </div>
        </div>
      </BottomSheet>
    </>
  )
}
