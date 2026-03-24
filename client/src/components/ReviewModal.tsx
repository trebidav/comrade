import { useState } from 'react'
import { type Task } from '../api'
import BottomSheet from './BottomSheet'

interface Props {
  task: Task
  onAccept: () => void
  onDecline: () => void
  onClose: () => void
}

export default function ReviewModal({ task, onAccept, onDecline, onClose }: Props) {
  const review = task.pending_review
  const [showPhoto, setShowPhoto] = useState(false)

  return (
    <>
      <BottomSheet open={true} onClose={onClose} title="Completion Report" height="auto">
        <div style={{ padding: '20px 16px' }}>
          <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: 'var(--pip-text)', marginBottom: '16px', borderBottom: '1px solid var(--pip-border)', paddingBottom: '12px' }}>
            {task.name}
          </div>

          {review ? (
            <>
              <div style={{ marginBottom: '16px' }}>
                <div className="pip-label">Comment</div>
                {review.comment ? (
                  <div style={{ fontSize: '0.9rem', color: 'var(--pip-text)', lineHeight: 1.5, padding: '10px 12px', background: 'rgba(46,194,126,0.05)', border: '1px solid var(--pip-border)' }}>
                    {review.comment}
                  </div>
                ) : (
                  <div style={{ fontSize: '0.8rem', color: 'var(--pip-green-dark)', fontStyle: 'italic' }}>
                    No comment provided
                  </div>
                )}
              </div>

              <div style={{ marginBottom: '24px' }}>
                <div className="pip-label">Photo</div>
                {review.photo ? (
                  <button
                    className="pip-popup-btn"
                    onClick={() => setShowPhoto(true)}
                    style={{ width: '100%' }}
                  >
                    View Photo →
                  </button>
                ) : (
                  <div style={{ fontSize: '0.8rem', color: 'var(--pip-green-dark)', fontStyle: 'italic' }}>
                    No photo attached
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button className="pip-btn" onClick={onClose} style={{ flex: 1 }}>Close</button>
                <button
                  className="pip-btn"
                  style={{ flex: 1, borderColor: '#EA4335', color: '#EA4335' }}
                  onClick={onDecline}
                >
                  Decline
                </button>
                <button className="pip-btn pip-btn-primary" onClick={onAccept} style={{ flex: 1 }}>
                  Accept
                </button>
              </div>
            </>
          ) : (
            <>
              <div style={{ fontSize: '0.85rem', color: 'var(--pip-green-dark)', marginBottom: '20px' }}>
                No pending review for this task.
              </div>
              <button className="pip-btn" onClick={onClose} style={{ width: '100%' }}>Close</button>
            </>
          )}
        </div>
      </BottomSheet>

      {showPhoto && review?.photo && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 3000, background: 'rgba(0,0,0,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setShowPhoto(false)}
        >
          <button
            onClick={() => setShowPhoto(false)}
            style={{ position: 'absolute', top: 'calc(env(safe-area-inset-top, 0px) + 16px)', right: '20px', background: 'none', border: 'none', color: 'white', fontSize: '2rem', cursor: 'pointer', lineHeight: 1, padding: '8px' }}
          >
            ×
          </button>
          <img
            src={review.photo}
            alt="Review photo"
            style={{ maxWidth: '94vw', maxHeight: '88dvh', objectFit: 'contain' }}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  )
}
