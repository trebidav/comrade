import { useState, useEffect, useRef } from 'react'
import { type Task, STATE_LABELS, formatMinutes } from '../api'
import api from '../api'

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
  const [showFinishPrompt, setShowFinishPrompt] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Live timer — ticks every second, recomputes from server-side start time
  useEffect(() => {
    setElapsedMs(computeElapsedMs(task))
    const interval = setInterval(() => {
      setElapsedMs(computeElapsedMs(taskRef.current))
    }, 1000)
    return () => clearInterval(interval)
  }, [task.id, task.datetime_start, task.time_spent_minutes])

  const totalMinutes = elapsedMs / 60000
  const timeMultiplier = timeModifierMinutes > 0 ? totalMinutes / timeModifierMinutes : 1.0
  const criticalityFactor = 1.0 + ((task.criticality ?? 1) - 1) * criticalityPercentage

  const canConfirm =
    (!task.require_photo || photoFile !== null) &&
    (!task.require_comment || comment.trim() !== '')

  const handlePause = async () => {
    await onAction('pause', task.id)
  }

  const handleAbandon = async () => {
    await onAction('abandon', task.id)
  }

  const handleFinishConfirm = async () => {
    setFinishing(true)
    try {
      const form = new FormData()
      if (photoFile) form.append('photo', photoFile)
      form.append('comment', comment)
      await api.post(`/task/${task.id}/finish`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      onFinished(task.id, task.name)
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error
      console.error('Finish failed:', msg)
    } finally {
      setFinishing(false)
      setShowFinishPrompt(false)
      setPhotoFile(null)
      setComment('')
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
        minWidth: '280px',
        maxWidth: '380px',
        padding: '12px 16px',
      }}
    >
      {/* Header */}
      <div
        style={{
          fontSize: '0.6rem',
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: 'var(--pip-green-dark)',
          marginBottom: '6px',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
        }}
      >
        <span
          style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            background: '#FBBC05',
            display: 'inline-block',
            animation: 'pip-blink 1.2s ease-in-out infinite',
          }}
        />
        Active Task
      </div>

      {/* Task name */}
      <div
        style={{
          fontSize: '0.9rem',
          fontWeight: 'bold',
          color: 'var(--pip-text)',
          marginBottom: '4px',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {task.name}
      </div>

      {task.description && (
        <div style={{ fontSize: '0.7rem', color: 'rgba(51,214,136,0.7)', marginBottom: '6px' }}>
          {task.description}
        </div>
      )}

      {/* Time tracking row */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '8px', alignItems: 'baseline' }}>
        <div>
          <span style={{ fontSize: '0.55rem', color: 'var(--pip-green-dark)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Elapsed </span>
          <span style={{ fontSize: '0.85rem', color: '#FBBC05', fontWeight: 'bold' }}>{formatMinutes(totalMinutes)}</span>
        </div>
        {task.minutes != null && (
          <div>
            <span style={{ fontSize: '0.55rem', color: 'var(--pip-green-dark)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Est. </span>
            <span style={{ fontSize: '0.85rem', color: 'var(--pip-text)' }}>{formatMinutes(task.minutes)}</span>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '10px', alignItems: 'center' }}>
        <span
          style={{
            fontSize: '0.6rem',
            padding: '1px 6px',
            border: '1px solid #FBBC05',
            color: '#FBBC05',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          {STATE_LABELS[task.state ?? 2] ?? 'Unknown'}
        </span>
        {task.coins != null && (
          <span style={{ fontSize: '0.6rem', padding: '1px 6px', border: '1px solid rgba(251,188,5,0.5)', color: '#FBBC05', borderRadius: '2px' }}>
            <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#FBBC05', display: 'inline-block', marginRight: '3px' }} />
            {Math.round(task.coins * coinsModifier * timeMultiplier)}
          </span>
        )}
        {task.xp != null && (
          <span style={{ fontSize: '0.6rem', padding: '1px 6px', border: '1px solid rgba(66,133,244,0.5)', color: '#4285F4', borderRadius: '2px' }}>
            {(() => {
              const base = Math.round(task.xp * xpModifier * timeMultiplier)
              const extra = Math.round(task.xp * xpModifier * timeMultiplier * criticalityFactor) - base
              return <>XP: {base}{extra > 0 && <span style={{ color: '#89b4f8' }}>+{extra}</span>}</>
            })()}
          </span>
        )}
        {task.skill_execute_names.map((s) => (
          <span
            key={s}
            style={{
              fontSize: '0.55rem',
              padding: '1px 5px',
              background: 'rgba(52,168,83,0.15)',
              border: '1px solid rgba(52,168,83,0.4)',
              color: '#34A853',
              borderRadius: '2px',
            }}
          >
            {s}
          </span>
        ))}
      </div>

      {/* Finish prompt */}
      {showFinishPrompt && (
        <div
          style={{
            marginBottom: '10px',
            padding: '8px',
            border: '1px solid var(--pip-border)',
            background: 'rgba(46,194,126,0.05)',
          }}
        >
          {/* Comment field */}
          <div style={{ marginBottom: '8px' }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--pip-green)', marginBottom: '4px' }}>
              {task.require_comment ? 'Comment (required)' : 'Comment (optional)'}
            </div>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={2}
              placeholder="Describe what was done..."
              style={{
                width: '100%',
                background: 'rgba(46,194,126,0.05)',
                border: `1px solid ${task.require_comment && !comment.trim() ? '#EA4335' : 'var(--pip-border)'}`,
                color: 'var(--pip-text)',
                fontFamily: 'var(--pip-font)',
                fontSize: '0.72rem',
                padding: '5px 7px',
                resize: 'none',
                boxSizing: 'border-box',
                outline: 'none',
              }}
            />
          </div>

          {/* Photo field */}
          <div style={{ fontSize: '0.7rem', color: 'var(--pip-green)', marginBottom: '6px' }}>
            {task.require_photo ? 'Photo (required)' : 'Photo (optional)'}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)}
            style={{ display: 'none' }}
          />
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
            <button className="pip-popup-btn" onClick={() => fileInputRef.current?.click()}>
              {photoFile ? photoFile.name : 'Choose Photo'}
            </button>
            <button
              className="pip-popup-btn pip-popup-btn-primary"
              onClick={handleFinishConfirm}
              disabled={finishing || !canConfirm}
            >
              {finishing ? 'Finishing...' : 'Confirm Finish'}
            </button>
            <button
              className="pip-popup-btn"
              onClick={() => { setShowFinishPrompt(false); setPhotoFile(null); setComment('') }}
              disabled={finishing}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Actions */}
      {!showFinishPrompt && (
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          <button className="pip-popup-btn pip-popup-btn-primary" onClick={() => setShowFinishPrompt(true)}>
            Finish
          </button>
          <button className="pip-popup-btn" onClick={handlePause}>
            Pause
          </button>
          <button
            className="pip-popup-btn"
            style={{ borderColor: '#EA4335', color: '#EA4335' }}
            onClick={handleAbandon}
          >
            Abandon
          </button>
          {task.lat != null && task.lon != null && (
            <button
              className="pip-popup-btn"
              style={{ marginLeft: 'auto' }}
              onClick={() => onLocate(task)}
            >
              Locate
            </button>
          )}
        </div>
      )}
    </div>
  )
}
