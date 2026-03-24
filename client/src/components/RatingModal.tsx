import { useState } from 'react'
import api from '../api'
import BottomSheet from './BottomSheet'

interface Props {
  taskId: number
  taskName: string
  requireComment: boolean
  onClose: () => void
}

function RatingSlider({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <input
      type="range"
      className="rating-slider"
      min={0}
      max={2}
      step={0.01}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
    />
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
      // best effort
    }
    onClose()
  }

  const canSubmit = !requireComment || feedback.trim().length > 0

  return (
    <BottomSheet open={true} onClose={onClose} title="Rate Task" height="auto">
      <div style={{ padding: '20px 16px' }}>
        <div style={{ fontSize: '0.6rem', color: 'var(--pip-green-dark)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '4px' }}>
          Task Complete
        </div>
        <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: 'var(--pip-text)', marginBottom: '20px', borderBottom: '1px solid var(--pip-border)', paddingBottom: '12px' }}>
          {taskName}
        </div>

        <div style={{ marginBottom: '20px' }}>
          <div className="pip-label">How was the experience?</div>
          <RatingSlider value={happiness} onChange={setHappiness} />
        </div>

        <div style={{ marginBottom: '20px' }}>
          <div className="pip-label">Was the time estimate accurate?</div>
          <RatingSlider value={time} onChange={setTime} />
        </div>

        <div style={{ marginBottom: '24px' }}>
          <div className="pip-label">{requireComment ? 'Comment (required)' : 'Feedback (optional)'}</div>
          <textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            rows={3}
            placeholder="Any comments about this task..."
            className="pip-input"
            style={{
              resize: 'none',
              border: `1px solid ${requireComment && !feedback.trim() ? '#EA4335' : 'var(--pip-border)'}`,
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          {!requireComment && (
            <button className="pip-btn" onClick={onClose} disabled={submitting} style={{ flex: 1 }}>
              Skip
            </button>
          )}
          <button
            className="pip-btn pip-btn-primary"
            onClick={handleSubmit}
            disabled={submitting || !canSubmit}
            style={{ flex: 2 }}
          >
            {submitting ? 'Saving...' : 'Submit'}
          </button>
        </div>
      </div>
    </BottomSheet>
  )
}
