import { useState } from 'react'
import { type Task } from '../api'

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
          style={{ width: '340px', padding: '20px 24px' }}
          onClick={(e) => e.stopPropagation()}
        >
          <div
            style={{
              fontSize: '0.6rem',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: 'var(--pip-green-dark)',
              marginBottom: '4px',
            }}
          >
            Completion Report
          </div>
          <div
            style={{
              fontSize: '1rem',
              fontWeight: 'bold',
              color: 'var(--pip-text)',
              marginBottom: '16px',
              borderBottom: '1px solid var(--pip-border)',
              paddingBottom: '10px',
            }}
          >
            {task.name}
          </div>

          {review ? (
            <>
              <div style={{ marginBottom: '14px' }}>
                <div style={{ fontSize: '0.65rem', color: 'var(--pip-green-dark)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Comment
                </div>
                {review.comment ? (
                  <div style={{ fontSize: '0.8rem', color: 'var(--pip-text)', lineHeight: 1.4 }}>
                    {review.comment}
                  </div>
                ) : (
                  <div style={{ fontSize: '0.75rem', color: 'var(--pip-green-dark)', fontStyle: 'italic' }}>
                    No comment provided
                  </div>
                )}
              </div>

              <div style={{ marginBottom: '20px' }}>
                <div style={{ fontSize: '0.65rem', color: 'var(--pip-green-dark)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Photo
                </div>
                {review.photo ? (
                  <button
                    className="pip-popup-btn"
                    onClick={() => setShowPhoto(true)}
                    style={{ fontSize: '0.7rem' }}
                  >
                    View photo →
                  </button>
                ) : (
                  <div style={{ fontSize: '0.75rem', color: 'var(--pip-green-dark)', fontStyle: 'italic' }}>
                    No photo attached
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button className="pip-popup-btn" onClick={onClose}>
                  Close
                </button>
                <button
                  className="pip-popup-btn"
                  style={{ borderColor: '#EA4335', color: '#EA4335' }}
                  onClick={onDecline}
                >
                  Decline
                </button>
                <button className="pip-popup-btn pip-popup-btn-primary" onClick={onAccept}>
                  Accept
                </button>
              </div>
            </>
          ) : (
            <>
              <div style={{ fontSize: '0.75rem', color: 'var(--pip-green-dark)', marginBottom: '16px' }}>
                No pending review for this task.
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button className="pip-popup-btn" onClick={onClose}>Close</button>
              </div>
            </>
          )}
        </div>
      </div>

      {showPhoto && review?.photo && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 3000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0,0,0,0.85)',
          }}
          onClick={() => setShowPhoto(false)}
        >
          <button
            onClick={() => setShowPhoto(false)}
            style={{
              position: 'absolute',
              top: '20px',
              right: '24px',
              background: 'none',
              border: 'none',
              color: 'white',
              fontSize: '1.8rem',
              cursor: 'pointer',
              lineHeight: 1,
            }}
          >
            ×
          </button>
          <img
            src={review.photo}
            alt="Review photo"
            style={{ maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain' }}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  )
}
