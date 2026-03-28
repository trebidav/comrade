import { useEffect, useState } from 'react'
import api, { type Task, type TutorialData, type TutorialPart, type NewAchievement, realTaskId } from '../api'
import { fetchPendingReview, acceptTutorialReview, declineTutorialReview, type TutorialReviewData } from '../api'

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

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
  const [showSheet, setShowSheet] = useState(false)

  // Review mode state
  const [reviewData, setReviewData] = useState<TutorialReviewData | null>(null)
  const [reviewStep, setReviewStep] = useState(0)
  const [showDeclineModal, setShowDeclineModal] = useState(false)
  const [declineReason, setDeclineReason] = useState('')
  const [showFullPhoto, setShowFullPhoto] = useState(false)
  const isReviewMode = (task.owner_pending_review_count ?? 0) > 0

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

  useEffect(() => {
    if (isReviewMode) {
      fetchPendingReview(tutorialId).then(setReviewData)
    }
  }, [isReviewMode, tutorialId])

  const handleAccept = async () => {
    if (!reviewData) return
    try {
      await acceptTutorialReview(tutorialId, reviewData.user.id)
    } catch {
      setError('Failed to accept review')
      return
    }
    const next = await fetchPendingReview(tutorialId)
    if (next) {
      setReviewData(next)
      setReviewStep(0)
    } else {
      setReviewData(null)
      onCompleted(task.id, task.name)
    }
  }

  const handleDecline = async () => {
    if (!reviewData || !declineReason.trim()) return
    try {
      await declineTutorialReview(tutorialId, reviewData.user.id, declineReason)
    } catch {
      setError('Failed to decline review')
      return
    }
    setShowDeclineModal(false)
    setDeclineReason('')
    const next = await fetchPendingReview(tutorialId)
    if (next) {
      setReviewData(next)
      setReviewStep(0)
    } else {
      setReviewData(null)
      onCompleted(task.id, task.name)
    }
  }

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
        if (res.data.pending_review) {
          // Tutorial has owner — enter review state, refetch task list + tutorial data
          onCompleted(task.id, task.name)
          fetchTutorial()
        } else {
          if (res.data.new_achievements?.length && onNewAchievements) {
            onNewAchievements(res.data.new_achievements)
          }
          onCompleted(task.id, task.name)
          setShowSheet(false)
        }
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

  // Review mode: show sheet directly (no compact bar)
  if (isReviewMode && reviewData) {
    const currentSubmission = reviewStep < reviewData.submissions.length ? reviewData.submissions[reviewStep] : null
    const isDecisionScreen = reviewStep >= reviewData.submissions.length

    return (
      <>
        <div style={{ position: 'fixed', inset: 0, zIndex: 1600, background: 'rgba(0,0,0,0.6)', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
          <div style={{ background: 'var(--pip-panel-bg)', border: '1px solid var(--pip-border)', borderBottom: 'none', borderRadius: '14px 14px 0 0', maxHeight: '85dvh', display: 'flex', flexDirection: 'column', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
            {/* Header */}
            <div style={{ padding: '16px 16px 10px', borderBottom: '1px solid var(--pip-border)', flexShrink: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                <div>
                  <div style={{ fontSize: '0.6rem', color: '#FBBC05', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '2px' }}>Review Submission</div>
                  <div style={{ fontSize: '1rem', fontWeight: 'bold', color: 'var(--pip-text)' }}>{task.name}</div>
                </div>
                <button
                  onClick={() => onCompleted(task.id, task.name)}
                  style={{ background: 'none', border: 'none', color: 'var(--pip-text)', cursor: 'pointer', fontSize: '1.5rem', lineHeight: 1, padding: '4px 8px', minHeight: '44px', display: 'flex', alignItems: 'center' }}
                >
                  ×
                </button>
              </div>

              {/* Review banner: user info */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 0' }}>
                {reviewData.user.profile_picture ? (
                  <img
                    src={reviewData.user.profile_picture}
                    alt={reviewData.user.username}
                    style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--pip-border)' }}
                  />
                ) : (
                  <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--pip-green-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', color: 'var(--pip-text)', fontWeight: 'bold', border: '1px solid var(--pip-border)' }}>
                    {reviewData.user.username.charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--pip-text)' }}>{reviewData.user.username}</div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--pip-green-dark)' }}>Submitted {timeAgo(reviewData.created_at)}</div>
                </div>
              </div>
            </div>

            {/* Content */}
            <div style={{ overflowY: 'auto', flex: 1, padding: '16px', WebkitOverflowScrolling: 'touch' }}>
              {!isDecisionScreen && currentSubmission && (
                <div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--pip-green-dark)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '4px' }}>
                    {currentSubmission.part_type === 'freetext' ? 'Text Response' : 'File Upload'}
                  </div>
                  {currentSubmission.part_title && (
                    <div style={{ fontSize: '0.95rem', fontWeight: 'bold', color: 'var(--pip-green)', marginBottom: '12px' }}>{currentSubmission.part_title}</div>
                  )}

                  {currentSubmission.part_type === 'freetext' && currentSubmission.submitted_text && (
                    <div style={{ fontSize: '0.85rem', color: 'var(--pip-text)', lineHeight: 1.6, whiteSpace: 'pre-wrap', padding: '12px', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--pip-border)', borderRadius: '6px', marginBottom: '16px' }}>
                      {currentSubmission.submitted_text}
                    </div>
                  )}

                  {currentSubmission.part_type === 'file_upload' && currentSubmission.submitted_file_url && (
                    <div style={{ marginBottom: '16px' }}>
                      <div style={{ fontSize: '0.8rem', color: 'var(--pip-text)', marginBottom: '8px' }}>
                        {currentSubmission.submitted_file_url.split('/').pop()}
                      </div>
                      <button
                        className="pip-btn"
                        onClick={() => setShowFullPhoto(true)}
                        style={{ width: '100%', background: '#4285F4', color: 'white' }}
                      >
                        View Photo
                      </button>
                    </div>
                  )}

                  {/* Navigation */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '16px' }}>
                    <button
                      className="pip-popup-btn"
                      onClick={() => setReviewStep((s) => s - 1)}
                      disabled={reviewStep === 0}
                      style={{ opacity: reviewStep === 0 ? 0.4 : 1 }}
                    >
                      Previous
                    </button>
                    <span style={{ fontSize: '0.75rem', color: 'var(--pip-green-dark)' }}>
                      {reviewStep + 1} / {reviewData.submissions.length}
                    </span>
                    <button
                      className="pip-popup-btn"
                      onClick={() => setReviewStep((s) => s + 1)}
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}

              {isDecisionScreen && (
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--pip-text)', marginBottom: '12px' }}>Summary</div>
                  {reviewData.submissions.map((sub, i) => (
                    <div
                      key={sub.part_id}
                      onClick={() => setReviewStep(i)}
                      style={{ padding: '10px', marginBottom: '8px', border: '1px solid var(--pip-border)', borderRadius: '6px', cursor: 'pointer', background: 'rgba(255,255,255,0.03)' }}
                    >
                      <div style={{ fontSize: '0.75rem', color: 'var(--pip-green-dark)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        {sub.part_type === 'freetext' ? 'Text' : 'File'}
                      </div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--pip-text)', marginTop: '2px' }}>
                        {sub.part_title || `Part ${i + 1}`}
                      </div>
                      {sub.part_type === 'freetext' && sub.submitted_text && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--pip-green-dark)', marginTop: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {sub.submitted_text}
                        </div>
                      )}
                      {sub.part_type === 'file_upload' && sub.submitted_file_url && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--pip-green-dark)', marginTop: '4px' }}>
                          {sub.submitted_file_url.split('/').pop()}
                        </div>
                      )}
                    </div>
                  ))}

                  <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                    <button
                      className="pip-btn"
                      onClick={() => setShowDeclineModal(true)}
                      style={{ flex: 1, background: '#EA4335', color: 'white' }}
                    >
                      Decline
                    </button>
                    <button
                      className="pip-btn"
                      onClick={handleAccept}
                      style={{ flex: 1, background: '#34A853', color: 'white' }}
                    >
                      Accept
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Full photo overlay */}
        {showFullPhoto && currentSubmission?.submitted_file_url && (
          <div
            onClick={() => setShowFullPhoto(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.85)', cursor: 'pointer' }}
          >
            <img src={currentSubmission.submitted_file_url} style={{ maxWidth: '94vw', maxHeight: '88dvh', objectFit: 'contain' }} />
          </div>
        )}

        {/* Decline modal */}
        {showDeclineModal && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 9998, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', padding: '16px' }}>
            <div style={{ width: '100%', maxWidth: '360px', background: 'var(--pip-panel-bg)', border: '1px solid var(--pip-border)', borderRadius: '12px', padding: '16px' }}>
              <div style={{ fontSize: '1rem', fontWeight: 'bold', color: 'var(--pip-text)', marginBottom: '4px' }}>Decline submission</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--pip-green-dark)', marginBottom: '12px' }}>{reviewData.user.username} will be notified and must redo the tutorial.</div>
              <textarea value={declineReason} onChange={(e) => setDeclineReason(e.target.value)} placeholder="Reason (required)" rows={3} className="pip-input" style={{ width: '100%', resize: 'none', marginBottom: '12px' }} />
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="pip-popup-btn" onClick={() => setShowDeclineModal(false)} style={{ flex: 1 }}>Cancel</button>
                <button className="pip-btn" onClick={handleDecline} disabled={!declineReason.trim()} style={{ flex: 1, background: '#EA4335', color: 'white', opacity: declineReason.trim() ? 1 : 0.4 }}>Confirm Decline</button>
              </div>
            </div>
          </div>
        )}
      </>
    )
  }

  if (isReviewMode && !reviewData) {
    return null
  }

  return (
    <>
      {/* Compact bar */}
      <div className="active-task-bar" onClick={() => setShowSheet(true)} style={{ cursor: 'pointer' }}>
        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#4285F4', display: 'inline-block', flexShrink: 0, animation: 'pip-blink 1.4s ease-in-out infinite' }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--pip-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {task.name}
          </div>
          <div style={{ fontSize: '0.65rem', color: allDone ? '#FBBC05' : '#4285F4' }}>
            {allDone
              ? task.tutorial_pending_review ? 'Pending review' : 'Complete!'
              : `Tutorial · Step ${Math.min(progress + 1, total)} of ${total}`}
          </div>
        </div>
        <div style={{ fontSize: '0.7rem', color: 'var(--pip-green-dark)', flexShrink: 0, paddingLeft: '8px' }}>
          Tap ›
        </div>
      </div>

      {showSheet && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1600, background: 'rgba(0,0,0,0.6)', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
          <div style={{ background: 'var(--pip-panel-bg)', border: '1px solid var(--pip-border)', borderBottom: 'none', borderRadius: '14px 14px 0 0', maxHeight: '85dvh', display: 'flex', flexDirection: 'column', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
            {/* Header */}
            <div style={{ padding: '16px 16px 10px', borderBottom: '1px solid var(--pip-border)', flexShrink: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                <div>
                  <div style={{ fontSize: '0.6rem', color: '#4285F4', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '2px' }}>Tutorial Task</div>
                  <div style={{ fontSize: '1rem', fontWeight: 'bold', color: 'var(--pip-text)' }}>{task.name}</div>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  {task.lat != null && task.lon != null && (
                    <button
                      className="pip-popup-btn"
                      style={{ fontSize: '0.7rem', padding: '6px 10px' }}
                      onClick={() => { onLocate(task); setShowSheet(false) }}
                    >
                      Locate
                    </button>
                  )}
                  <button
                    className="pip-popup-btn"
                    style={{ fontSize: '0.7rem', padding: '6px 10px', borderColor: '#EA4335', color: '#EA4335' }}
                    onClick={() => { onAction('abandon', task.id); setShowSheet(false) }}
                  >
                    Abandon
                  </button>
                  <button
                    onClick={() => setShowSheet(false)}
                    style={{ background: 'none', border: 'none', color: 'var(--pip-text)', cursor: 'pointer', fontSize: '1.5rem', lineHeight: 1, padding: '4px 8px', minHeight: '44px', display: 'flex', alignItems: 'center' }}
                  >
                    ×
                  </button>
                </div>
              </div>

              {/* Progress bar */}
              {tutorial && !allDone && (
                <div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--pip-green-dark)', marginBottom: '4px' }}>
                    Step {progress + 1} of {total} — {tutorial.reward_skill_name} certification
                  </div>
                  <div className="level-bar-track">
                    <div className="level-bar-fill" style={{ width: `${(progress / total) * 100}%`, background: '#4285F4' }} />
                  </div>
                </div>
              )}
            </div>

            {/* Content */}
            <div style={{ overflowY: 'auto', flex: 1, padding: '16px', WebkitOverflowScrolling: 'touch' }}>
              {error && (
                <div style={{ fontSize: '0.8rem', color: '#EA4335', marginBottom: '12px', padding: '8px', border: '1px solid rgba(234,67,53,0.4)', background: 'rgba(234,67,53,0.08)' }}>
                  {error}
                </div>
              )}
              {loading && <div style={{ fontSize: '0.8rem', color: 'var(--pip-green-dark)', textAlign: 'center', padding: '20px 0' }}>Loading...</div>}
              {tutorial && !allDone && currentPart && (
                <PartRenderer part={currentPart} onSubmit={submitPart} submitting={submitting} />
              )}
              {tutorial && allDone && (
                <div style={{ textAlign: 'center', padding: '24px 0' }}>
                  {task.tutorial_pending_review ? (
                    <>
                      <div style={{ fontSize: '1rem', color: '#FBBC05', marginBottom: 8 }}>⏳ Pending Review</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--pip-green-dark)' }}>
                        All parts complete. The owner will review your submission.<br />
                        You'll receive the <strong>{task.reward_skill_name}</strong> skill once approved.
                      </div>
                    </>
                  ) : (
                    <div style={{ fontSize: '1rem', color: 'var(--pip-green)' }}>
                      ✓ All parts complete!
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

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
  if (part.type === 'freetext') return <FreetextPart part={part} onSubmit={onSubmit} submitting={submitting} />
  return null
}

function PartHeader({ part }: { part: TutorialPart }) {
  const icons: Record<string, string> = { text: 'Text', video: 'Video', quiz: 'Quiz', password: 'Code', file_upload: 'Upload', freetext: 'Text' }
  return (
    <div style={{ marginBottom: '12px', paddingBottom: '8px', borderBottom: '1px solid var(--pip-border)' }}>
      <span style={{ fontSize: '0.65rem', color: 'var(--pip-green-dark)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
        {icons[part.type]} {part.type}
      </span>
      {part.title && <div style={{ fontSize: '0.95rem', fontWeight: 'bold', color: 'var(--pip-green)', marginTop: '4px' }}>{part.title}</div>}
    </div>
  )
}

type SubmitFn = (id: number, d: Record<string, unknown> | FormData) => void

function TextPart({ part, onSubmit, submitting }: { part: TutorialPart; onSubmit: SubmitFn; submitting: boolean }) {
  return (
    <div>
      <PartHeader part={part} />
      <div style={{ fontSize: '0.9rem', color: 'var(--pip-text)', lineHeight: 1.6, marginBottom: '20px', whiteSpace: 'pre-wrap' }}>
        {part.text_content}
      </div>
      <button className="pip-btn pip-btn-primary" onClick={() => onSubmit(part.id, {})} disabled={submitting} style={{ width: '100%' }}>
        {submitting ? 'Saving...' : 'Continue →'}
      </button>
    </div>
  )
}

function VideoPart({ part, onSubmit, submitting }: { part: TutorialPart; onSubmit: SubmitFn; submitting: boolean }) {
  return (
    <div>
      <PartHeader part={part} />
      {part.video_url && (
        <div style={{ marginBottom: '14px', position: 'relative', paddingTop: '56.25%' }}>
          <iframe
            src={part.video_url}
            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: '1px solid var(--pip-border)' }}
            allowFullScreen
            title={part.title}
          />
        </div>
      )}
      {part.text_content && (
        <div style={{ fontSize: '0.85rem', color: 'var(--pip-text)', marginBottom: '14px', whiteSpace: 'pre-wrap' }}>{part.text_content}</div>
      )}
      <button className="pip-btn pip-btn-primary" onClick={() => onSubmit(part.id, {})} disabled={submitting} style={{ width: '100%' }}>
        {submitting ? 'Saving...' : 'Continue →'}
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
        <div key={q.id} style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '0.9rem', color: 'var(--pip-text)', marginBottom: '10px', fontWeight: 'bold' }}>{q.text}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {q.answers.map((a) => {
              const isSelected = selected[q.id] === a.id
              return (
                <button
                  key={a.id}
                  onClick={() => setSelected((prev) => ({ ...prev, [q.id]: a.id }))}
                  style={{
                    textAlign: 'left',
                    fontSize: '0.85rem',
                    padding: '12px 14px',
                    background: isSelected ? 'rgba(52,168,83,0.15)' : 'transparent',
                    border: `1px solid ${isSelected ? '#34A853' : 'var(--pip-border)'}`,
                    color: isSelected ? '#34A853' : 'var(--pip-text)',
                    cursor: 'pointer',
                    fontFamily: 'var(--pip-font)',
                    borderRadius: '4px',
                    minHeight: '48px',
                    touchAction: 'manipulation',
                    width: '100%',
                  }}
                >
                  {a.text}
                </button>
              )
            })}
          </div>
        </div>
      ))}
      <button className="pip-btn pip-btn-primary" onClick={handleSubmit} disabled={submitting || !allAnswered} style={{ width: '100%' }}>
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
        <div style={{ fontSize: '0.85rem', color: 'var(--pip-text)', marginBottom: '14px', whiteSpace: 'pre-wrap' }}>{part.text_content}</div>
      )}
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Enter access code..."
        onKeyDown={(e) => e.key === 'Enter' && password && onSubmit(part.id, { password })}
        className="pip-input"
        style={{ marginBottom: '12px' }}
      />
      <button
        className="pip-btn pip-btn-primary"
        onClick={() => onSubmit(part.id, { password })}
        disabled={submitting || !password}
        style={{ width: '100%' }}
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
        <div style={{ fontSize: '0.85rem', color: 'var(--pip-text)', marginBottom: '14px', whiteSpace: 'pre-wrap' }}>{part.text_content}</div>
      )}
      <label
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '14px',
          padding: '16px',
          border: '1px dashed var(--pip-border)',
          background: file ? 'rgba(52,168,83,0.08)' : 'transparent',
          cursor: 'pointer',
          fontSize: '0.85rem',
          color: file ? '#34A853' : 'var(--pip-green-dark)',
          textAlign: 'center',
          borderRadius: '4px',
          minHeight: '60px',
        }}
      >
        {file ? `📎 ${file.name}` : '📎 Tap to select a file'}
        <input type="file" style={{ display: 'none' }} onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      </label>
      <button className="pip-btn pip-btn-primary" onClick={handleSubmit} disabled={submitting || !file} style={{ width: '100%' }}>
        {submitting ? 'Uploading...' : 'Upload File'}
      </button>
    </div>
  )
}

function FreetextPart({ part, onSubmit, submitting }: { part: TutorialPart; onSubmit: SubmitFn; submitting: boolean }) {
  const [text, setText] = useState('')
  const min = part.freetext_min_length ?? 0
  const max = part.freetext_max_length ?? 1000
  const valid = text.length >= min && text.length <= max

  return (
    <div>
      <PartHeader part={part} />
      {part.text_content && (
        <div style={{ fontSize: '0.85rem', color: 'var(--pip-text)', marginBottom: '14px', whiteSpace: 'pre-wrap' }}>{part.text_content}</div>
      )}
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value.slice(0, max))}
        placeholder="Type your answer..."
        rows={5}
        className="pip-input"
        style={{ marginBottom: '4px', resize: 'none', width: '100%', minHeight: '120px' }}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--pip-green-dark)', marginBottom: '12px' }}>
        <span>{min > 0 ? `Min ${min} characters` : ''}</span>
        <span>{text.length}/{max}</span>
      </div>
      <button
        className="pip-btn pip-btn-primary"
        onClick={() => onSubmit(part.id, { text })}
        disabled={submitting || !valid}
        style={{ width: '100%' }}
      >
        {submitting ? 'Submitting...' : 'Submit'}
      </button>
    </div>
  )
}
