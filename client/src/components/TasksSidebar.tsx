import { useState, useEffect } from 'react'
import { type Task, STATE_LABELS, haversineKm, formatDistance, formatMinutes, formatCountdown } from '../api'
import ReviewModal from './ReviewModal'

interface Props {
  tasks: Task[]
  userId: number
  userSkills: string[]
  selfLocation: { lat: number; lon: number } | null
  proximityKm: number
  coinsModifier: number
  xpModifier: number
  timeModifierMinutes: number
  criticalityPercentage: number
  pauseMultiplier: number
  onTaskClick: (task: Task) => void
  onAction: (action: string, taskId: number) => Promise<void>
}

const STATE_COLORS: Record<number, string> = {
  0: '#555',
  1: '#4285F4',
  2: '#FBBC05',
  3: '#9b59b6',
  4: '#e67e22',
  5: '#34A853',
}

type View = 'all' | 'active' | 'owned'

function canReview(task: Task, userId: number, userSkills: string[]): boolean {
  if (task.assignee === userId) return false
  if (task.owner === userId) return true
  return (task.skill_write_names?.length ?? 0) > 0 && (task.skill_write_names ?? []).some((s) => userSkills.includes(s))
}

export default function TasksSidebar({ tasks, userId, userSkills, selfLocation, proximityKm, coinsModifier, xpModifier, timeModifierMinutes, criticalityPercentage, pauseMultiplier, onTaskClick, onAction }: Props) {
  const getDistance = (task: Task): number | null => {
    if (!selfLocation || task.lat == null || task.lon == null) return null
    return haversineKm(selfLocation.lat, selfLocation.lon, task.lat, task.lon)
  }
  const inProximity = (task: Task): boolean => {
    const d = getDistance(task)
    return d === null || d <= proximityKm
  }

  const activeTasks = tasks.filter((t) =>
    t.is_tutorial ? t.in_progress : (t.state === 2 || t.state === 3) && t.assignee === userId
  )
  const ownedTasks = tasks
    .filter((t) => !t.is_tutorial && (t.owner === userId || (t.state === 4 && canReview(t, userId, userSkills))))
    .sort((a, b) => {
      const aReview = a.state === 4 ? 0 : 1
      const bReview = b.state === 4 ? 0 : 1
      if (aReview !== bReview) return aReview - bReview
      if (!a.datetime_finish && !b.datetime_finish) return 0
      if (!a.datetime_finish) return 1
      if (!b.datetime_finish) return -1
      return new Date(a.datetime_finish).getTime() - new Date(b.datetime_finish).getTime()
    })
  const startableTasks = tasks
    .filter((t) =>
      t.is_tutorial
        ? !t.in_progress
        : t.owner !== userId && t.state !== 2 && t.state !== 3 && t.state !== 4 &&
          (t.state !== 5 || t.datetime_respawn != null)
    )
    .sort((a, b) => {
      const canExec = (t: Task) => t.skill_execute_names.length === 0 || t.skill_execute_names.some((s) => userSkills.includes(s))
      const priority = (t: Task) => {
        if (t.state === 5) return 1              // DONE+respawn — middle
        return canExec(t) && inProximity(t) ? 0 : 2  // available first, unavailable last
      }
      const pa = priority(a), pb = priority(b)
      if (pa !== pb) return pa - pb
      const da = getDistance(a) ?? Infinity
      const db = getDistance(b) ?? Infinity
      return da - db
    })
  const [view, setView] = useState<View>('all')
  const [reviewTask, setReviewTask] = useState<Task | null>(null)
  const [, setTick] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 1000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (tasks.length > 0) {
      const ownedInReview = ownedTasks.some((t) => t.state === 4)
      if (ownedInReview) setView('owned')
      else if (activeTasks.length > 0) setView('active')
      else setView('all')
    }
  }, [tasks])

  const displayedTasks = view === 'active' ? activeTasks : view === 'owned' ? ownedTasks : startableTasks

  const HEADER: Record<View, string> = { all: 'My Tasks', active: 'Active Tasks', owned: 'Owned Tasks' }

  const tabs: { key: View; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'active', label: activeTasks.length > 0 ? `Active (${activeTasks.length})` : 'Active' },
    ...(ownedTasks.length > 0 ? [{ key: 'owned' as View, label: ownedTasks.filter((t) => t.state === 4).length > 0 ? `Owned (${ownedTasks.filter((t) => t.state === 4).length})` : 'Owned' }] : []),
  ]

  const handleAccept = async () => {
    if (!reviewTask) return
    await onAction('accept_review', reviewTask.id)
    setReviewTask(null)
  }

  const handleDecline = async () => {
    if (!reviewTask) return
    await onAction('decline_review', reviewTask.id)
    setReviewTask(null)
  }

  return (
    <>
      <div
        className="pip-panel absolute z-[1000]"
        style={{
          top: '16px',
          left: '16px',
          width: '250px',
          maxHeight: 'calc(100vh - 450px)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '10px 14px',
            borderBottom: '1px solid var(--pip-border)',
            fontSize: '0.75rem',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: 'var(--pip-green)',
            flexShrink: 0,
          }}
        >
          {HEADER[view]}
          <span
            style={{
              float: 'right',
              background: 'var(--pip-green-dark)',
              color: 'var(--pip-bg)',
              borderRadius: '2px',
              padding: '0 6px',
              fontSize: '0.65rem',
            }}
          >
            {displayedTasks.length}
          </span>
        </div>

        {/* View toggle */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--pip-border)', flexShrink: 0 }}>
          {tabs.map((tab, i) => (
            <button
              key={tab.key}
              onClick={() => setView(tab.key)}
              style={{
                flex: 1,
                padding: '5px',
                fontSize: '0.6rem',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                background: view === tab.key ? 'rgba(46,194,126,0.12)' : 'transparent',
                color: view === tab.key ? 'var(--pip-green)' : 'var(--pip-green-dark)',
                border: 'none',
                borderRight: i < tabs.length - 1 ? '1px solid var(--pip-border)' : 'none',
                cursor: 'pointer',
                fontFamily: 'var(--pip-font)',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Task list */}
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {displayedTasks.length === 0 ? (
            <div
              style={{
                padding: '16px 14px',
                fontSize: '0.75rem',
                color: 'var(--pip-green-dark)',
                textAlign: 'center',
              }}
            >
              {view === 'active' ? 'No active tasks' : view === 'owned' ? 'No owned tasks' : 'No available tasks'}
            </div>
          ) : (
            displayedTasks.map((task) => {
              const dist = getDistance(task)
              const canExecute = task.skill_execute_names.length === 0 || task.skill_execute_names.some((s) => userSkills.includes(s))
              const near = view !== 'all' || (inProximity(task) && canExecute)
              return (
              <div
                key={task.id}
                onClick={() => onTaskClick(task)}
                style={{
                  padding: '8px 14px',
                  borderBottom: '1px solid rgba(26, 115, 70, 0.3)',
                  borderLeft: (task.is_tutorial ? task.in_progress : task.state === 2) ? '3px solid #FBBC05' : '3px solid transparent',
                  cursor: 'pointer',
                  transition: 'background 0.1s',
                  opacity: task.state === 5 ? 0.4 : (near ? 1 : 0.45),
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLDivElement).style.background = 'rgba(46, 194, 126, 0.08)'
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLDivElement).style.background = 'transparent'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '4px' }}>
                  <div
                    style={{
                      fontSize: '0.78rem',
                      color: task.is_tutorial ? '#FBBC05' : 'var(--pip-text)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      flex: 1,
                      minWidth: 0,
                    }}
                  >
                    {task.is_tutorial && <span style={{ marginRight: '3px' }}>★</span>}{task.name}
                  </div>
                  {dist !== null && (
                    <span style={{ fontSize: '0.6rem', color: inProximity(task) ? 'var(--pip-green-dark)' : '#EA4335', marginLeft: '6px', flexShrink: 0 }}>
                      {formatDistance(dist)}
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                  {!task.is_tutorial && task.state != null && (
                    <span
                      style={{
                        fontSize: '0.6rem',
                        padding: '1px 6px',
                        border: `1px solid ${STATE_COLORS[task.state]}`,
                        color: STATE_COLORS[task.state],
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                      }}
                    >
                      {STATE_LABELS[task.state] ?? 'Unknown'}
                    </span>
                  )}
                  {task.is_tutorial && (
                    <span style={{ fontSize: '0.6rem', padding: '1px 6px', border: '1px solid #FBBC05', color: '#FBBC05', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {task.in_progress ? 'In Progress' : 'Tutorial'}
                    </span>
                  )}
                  {task.minutes != null && (
                    <span style={{ fontSize: '0.6rem', color: 'var(--pip-green-dark)', letterSpacing: '0.03em' }}>
                      {formatMinutes(task.minutes)}
                    </span>
                  )}
                  {task.coins != null && (() => {
                    const tm = (task.minutes && timeModifierMinutes > 0) ? task.minutes / timeModifierMinutes : 1.0
                    const cf = 1.0 + ((task.criticality ?? 1) - 1) * criticalityPercentage
                    return (
                      <>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '0.6rem', color: '#FBBC05' }}>
                          <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#FBBC05', display: 'inline-block', flexShrink: 0 }} />
                          {Math.round(task.coins * coinsModifier * tm)}
                        </span>
                        {task.xp != null && (() => {
                          const base = Math.round(task.xp * xpModifier * tm)
                          const extra = Math.round(task.xp * xpModifier * tm * cf) - base
                          return (
                            <span style={{ fontSize: '0.6rem', color: '#4285F4', letterSpacing: '0.03em' }}>
                              XP:{base}{extra > 0 && <span style={{ color: '#89b4f8' }}>+{extra}</span>}
                            </span>
                          )
                        })()}
                      </>
                    )
                  })()}
                  {!task.lat && !task.lon && (
                    <span style={{ fontSize: '0.6rem', color: 'var(--pip-green-dark)' }}>no location</span>
                  )}
                  {/* Paused reset countdown badge */}
                  {task.state === 3 && task.datetime_paused && task.minutes != null && (
                    <span style={{ fontSize: '0.6rem', color: '#e67e22', letterSpacing: '0.03em' }}>
                      ⏱ {formatCountdown(new Date(new Date(task.datetime_paused).getTime() + task.minutes * pauseMultiplier * 60000).toISOString())}
                    </span>
                  )}
                  {/* Respawn countdown badge */}
                  {task.state === 5 && task.datetime_respawn && (
                    <span style={{ fontSize: '0.6rem', color: '#9b59b6', letterSpacing: '0.03em' }}>
                      ↺ {formatCountdown(task.datetime_respawn)}
                    </span>
                  )}
                  {/* Pending review badge */}
                  {task.pending_review && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setReviewTask(task) }}
                      style={{
                        fontSize: '0.55rem',
                        padding: '1px 6px',
                        background: 'rgba(230,126,34,0.15)',
                        border: '1px solid rgba(230,126,34,0.6)',
                        color: '#e67e22',
                        borderRadius: '2px',
                        cursor: 'pointer',
                        fontFamily: 'var(--pip-font)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                      }}
                    >
                      Pending Review
                    </button>
                  )}
                </div>
                {task.skill_execute_names.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px', marginTop: '4px' }}>
                    {task.skill_execute_names.map((s) => {
                      const has = userSkills.includes(s)
                      return (
                        <span
                          key={s}
                          style={{
                            fontSize: '0.55rem',
                            padding: '1px 5px',
                            background: has ? 'rgba(52,168,83,0.15)' : 'rgba(234,67,53,0.15)',
                            border: `1px solid ${has ? 'rgba(52,168,83,0.4)' : 'rgba(234,67,53,0.4)'}`,
                            color: has ? '#34A853' : '#EA4335',
                            borderRadius: '2px',
                          }}
                        >
                          {s}
                        </span>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })
        )}
        </div>
      </div>

      {reviewTask && (
        <ReviewModal
          task={reviewTask}
          onAccept={handleAccept}
          onDecline={handleDecline}
          onClose={() => setReviewTask(null)}
        />
      )}
    </>
  )
}
