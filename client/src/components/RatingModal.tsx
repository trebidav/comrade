import { useState } from 'react'
import api from '../api'

interface Props {
  taskId: number
  taskName: string
  requireComment: boolean
  onClose: () => void
}

function RatingSlider({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <input
        type="range"
        className="rating-slider"
        min={0}
        max={2}
        step={0.01}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  )
}

export default function RatingModal({ taskId, taskName, requireComment, onClose }: Props) {
  const [happiness, setHappiness] = useState(1)
  const [time, setTime] = useState(1)
  const [feedback, setFeedback] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async () => {
    setSubmitting(true)
    try {
      await api.post(`/task/${taskId}/rate`, { happiness, time, feedback })
    } catch {
      // best effort — don't block user on rating failure
    }
    onClose()
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.6)',
      }}
      onClick={onClose}
    >
      <div
        className="pip-panel"
        style={{ width: '320px', padding: '20px 24px' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            fontSize: '0.6rem',
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'var(--pip-green-dark)',
            marginBottom: '4px',
          }}
        >
          Task complete
        </div>
        <div
          style={{
            fontSize: '1rem',
            fontWeight: 'bold',
            color: 'var(--pip-text)',
            marginBottom: '18px',
            borderBottom: '1px solid var(--pip-border)',
            paddingBottom: '10px',
          }}
        >
          {taskName}
        </div>

        {/* Happiness */}
        <div style={{ marginBottom: '14px' }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--pip-green)', marginBottom: '6px' }}>
            How was the experience?
          </div>
          <RatingSlider value={happiness} onChange={setHappiness} />
        </div>

        {/* Time accuracy */}
        <div style={{ marginBottom: '14px' }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--pip-green)', marginBottom: '6px' }}>
            Was the time estimate accurate?
          </div>
          <RatingSlider value={time} onChange={setTime} />
        </div>

        {/* Feedback text */}
        <div style={{ marginBottom: '18px' }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--pip-green)', marginBottom: '6px' }}>
            {requireComment ? 'Comment (required)' : 'Feedback (optional)'}
          </div>
          <textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            rows={3}
            placeholder="Any comments about this task..."
            style={{
              width: '100%',
              background: 'rgba(46,194,126,0.05)',
              border: `1px solid ${requireComment && !feedback.trim() ? '#EA4335' : 'var(--pip-border)'}`,
              color: 'var(--pip-text)',
              fontFamily: 'var(--pip-font)',
              fontSize: '0.75rem',
              padding: '6px 8px',
              resize: 'vertical',
              boxSizing: 'border-box',
              outline: 'none',
            }}
          />
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          {!requireComment && (
            <button className="pip-popup-btn" onClick={onClose} disabled={submitting}>
              Skip
            </button>
          )}
          <button
            className="pip-popup-btn pip-popup-btn-primary"
            onClick={handleSubmit}
            disabled={submitting || (requireComment && !feedback.trim())}
          >
            {submitting ? 'Saving...' : 'Submit'}
          </button>
        </div>
      </div>
    </div>
  )
}
