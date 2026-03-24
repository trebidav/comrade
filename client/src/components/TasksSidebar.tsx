import { useState, useEffect } from 'react'
import { type Task, STATE_LABELS, haversineKm, formatDistance, formatMinutes, formatCountdown } from '../api'
import ReviewModal from './ReviewModal'
import { TaskListSkeleton } from './Skeleton'
import { useHaptics } from '../hooks/useHaptics'
import { IconTasksEmpty, IconBoltEmpty, IconTrophy } from './Icons'

interface Props {
  tasks: Task[]
  userId: number
  userSkills: string[]
  selfLocation: { lat: number; lon: number } | null
  proximityKm: number
  maxDistanceKm: number
  coinsModifier: number
  xpModifier: number
  timeModifierMinutes: number
  criticalityPercentage: number
  pauseMultiplier: number
  onTaskClick: (task: Task) => void
  onAction: (action: string, taskId: number) => Promise<void>
}

const STATE_COLORS: Record<number, string> = {
  0: '#555', 1: '#4285F4', 2: '#FBBC05', 3: '#9b59b6', 4: '#e67e22', 5: '#34A853',
}

type View = 'all' | 'active' | 'owned'

function canReview(task: Task, userId: number, userSkills: string[]): boolean {
  if (task.assignee === userId) return false
  if (task.owner === userId) return true
  return (task.skill_write_names?.length ?? 0) > 0 && (task.skill_write_names ?? []).some((s) => userSkills.includes(s))
}

export default function TasksSidebar({ tasks, userId, userSkills, selfLocation, proximityKm, maxDistanceKm, coinsModifier, xpModifier, timeModifierMinutes, criticalityPercentage, pauseMultiplier, onTaskClick, onAction }: Props) {
  const haptics = useHaptics()

  const getDistance = (task: Task): number | null => {
    if (!selfLocation || task.lat == null || task.lon == null) return null
    return haversineKm(selfLocation.lat, selfLocation.lon, task.lat, task.lon)
  }
  const inProximity = (task: Task): boolean => {
    const d = getDistance(task)
    return d === null || d <= proximityKm
  }
  const inMaxRange = (task: Task): boolean => {
    const d = getDistance(task)
    return d === null || d <= maxDistanceKm
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
      (t.is_tutorial
        ? !t.in_progress
        : t.owner !== userId && t.state !== 2 && t.state !== 3 && t.state !== 4 &&
          (t.state !== 5 || t.datetime_respawn != null)
      ) && inMaxRange(t)
    )
    .sort((a, b) => {
      const canExec = (t: Task) => t.skill_execute_names.length === 0 || t.skill_execute_names.some((s) => userSkills.includes(s))
      const priority = (t: Task) => {
        if (t.state === 5) return 1
        return canExec(t) && inProximity(t) ? 0 : 2
      }
      const pa = priority(a), pb = priority(b)
      if (pa !== pb) return pa - pb
      return (getDistance(a) ?? Infinity) - (getDistance(b) ?? Infinity)
    })

  const [view, setView] = useState<View>('all')
  const [reviewTask, setReviewTask] = useState<Task | null>(null)
  const [initialLoading, setInitialLoading] = useState(true)
  const [, setTick] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 1000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (tasks.length > 0 || initialLoading) {
      setInitialLoading(false)
      if (ownedTasks.some((t) => t.state === 4)) setView('owned')
      else if (activeTasks.length > 0) setView('active')
      else setView('all')
    }
  }, [tasks.length]) // eslint-disable-line react-hooks/exhaustive-deps

  // Mark as loaded after mount
  useEffect(() => {
    const t = setTimeout(() => setInitialLoading(false), 800)
    return () => clearTimeout(t)
  }, [])

  const displayedTasks = view === 'active' ? activeTasks : view === 'owned' ? ownedTasks : startableTasks

  const tabs: { key: View; label: string; badge?: number }[] = [
    { key: 'all', label: 'Nearby', badge: startableTasks.length },
    { key: 'active', label: 'Active', badge: activeTasks.length },
    ...(ownedTasks.length > 0 ? [{ key: 'owned' as View, label: 'Owned', badge: ownedTasks.filter((t) => t.state === 4).length || undefined }] : []),
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
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--glass-border)', flexShrink: 0 }}>
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => { haptics.light(); setView(tab.key) }}
              style={{
                flex: 1,
                padding: '12px 6px',
                fontSize: '0.7rem',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                background: view === tab.key ? 'rgba(46,194,126,0.08)' : 'transparent',
                color: view === tab.key ? 'var(--pip-green)' : 'var(--pip-green-dark)',
                border: 'none',
                cursor: 'pointer',
                fontFamily: 'var(--pip-font)',
                borderBottom: view === tab.key ? '2px solid var(--pip-green)' : '2px solid transparent',
                touchAction: 'manipulation',
                minHeight: '44px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '5px',
                transition: 'color 0.15s, background 0.15s',
              }}
            >
              {tab.label}
              {tab.badge != null && tab.badge > 0 && (
                <span style={{
                  background: view === tab.key ? 'var(--pip-green)' : 'var(--pip-green-dark)',
                  color: 'var(--pip-bg)',
                  borderRadius: '8px',
                  padding: '1px 6px',
                  fontSize: '0.6rem',
                  fontWeight: 'bold',
                  transition: 'background 0.15s',
                }}>
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Task list */}
        <div style={{ overflowY: 'auto', flex: 1, WebkitOverflowScrolling: 'touch' }}>
          {initialLoading && tasks.length === 0 ? (
            <TaskListSkeleton />
          ) : displayedTasks.length === 0 ? (
            <div style={{
              padding: '40px 16px',
              fontSize: '0.85rem',
              color: 'var(--pip-green-dark)',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '12px',
              animation: 'scaleIn 0.3s var(--spring) both',
            }}>
              <div style={{ opacity: 0.45 }}>
                {view === 'active' ? <IconBoltEmpty color="var(--pip-green-dark)" /> : view === 'owned' ? <IconTrophy size={48} color="var(--pip-green-dark)" /> : <IconTasksEmpty color="var(--pip-green-dark)" />}
              </div>
              {view === 'active' ? 'No active tasks' : view === 'owned' ? 'No owned tasks' : 'No available tasks'}
            </div>
          ) : (
            displayedTasks.map((task, index) => {
              const dist = getDistance(task)
              const canExecute = task.skill_execute_names.length === 0 || task.skill_execute_names.some((s) => userSkills.includes(s))
              const isReachable = view !== 'all' || (inProximity(task) && canExecute)
              const isActive = task.is_tutorial ? task.in_progress : task.state === 2
              const greyed = !isReachable || task.state === 5

              return (
                <div
                  key={task.id}
                  className="task-item-enter"
                  onClick={() => { haptics.light(); onTaskClick(task) }}
                  style={{
                    padding: '14px 16px',
                    borderBottom: '1px solid rgba(26, 115, 70, 0.2)',
                    borderLeft: isActive ? '3px solid #FBBC05' : '3px solid transparent',
                    cursor: 'pointer',
                    opacity: greyed ? 0.35 : 1,
                    filter: greyed ? 'grayscale(0.6)' : 'none',
                    touchAction: 'manipulation',
                    transition: 'background 0.12s, opacity 0.15s, filter 0.15s',
                    animationDelay: `${Math.min(index, 5) * 40}ms`,
                  }}
                  onPointerDown={(e) => { e.currentTarget.style.background = 'var(--pip-btn-hover-bg)' }}
                  onPointerUp={(e) => { e.currentTarget.style.background = '' }}
                  onPointerLeave={(e) => { e.currentTarget.style.background = '' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px', gap: '8px' }}>
                    <div style={{ fontSize: '0.9rem', color: task.is_tutorial ? '#FBBC05' : 'var(--pip-text)', flex: 1, minWidth: 0, fontWeight: '500' }}>
                      {task.name}
                    </div>
                    {dist !== null && (
                      <span style={{
                        fontSize: '0.68rem',
                        color: inProximity(task) ? '#34A853' : '#EA4335',
                        flexShrink: 0,
                        fontWeight: 'bold',
                      }}>
                        {formatDistance(dist)}
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '5px' }}>
                    {!task.is_tutorial && task.state != null && (
                      <span className="state-badge" style={{ borderColor: STATE_COLORS[task.state], color: STATE_COLORS[task.state] }}>
                        {STATE_LABELS[task.state] ?? 'Unknown'}
                      </span>
                    )}
                    {task.is_tutorial && (
                      <span className="state-badge" style={{ borderColor: '#FBBC05', color: '#FBBC05' }}>
                        {task.in_progress ? 'In Progress' : 'Tutorial'}
                      </span>
                    )}
                    {task.minutes != null && (
                      <span style={{ fontSize: '0.65rem', color: 'var(--pip-green-dark)' }}>⏱ {formatMinutes(task.minutes)}</span>
                    )}
                    {task.coins != null && (() => {
                      const tm = (task.minutes && timeModifierMinutes > 0) ? task.minutes / timeModifierMinutes : 1.0
                      const cf = 1.0 + ((task.criticality ?? 1) - 1) * criticalityPercentage
                      return (
                        <>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '0.65rem', color: '#FBBC05' }}>
                            <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#FBBC05', display: 'inline-block', flexShrink: 0 }} />
                            {Math.round(task.coins * coinsModifier * tm)}
                          </span>
                          {task.xp != null && (() => {
                            const base = Math.round(task.xp * xpModifier * tm)
                            const extra = Math.round(task.xp * xpModifier * tm * cf) - base
                            return (
                              <span style={{ fontSize: '0.65rem', color: '#4285F4' }}>
                                XP:{base}{extra > 0 && <span style={{ color: '#89b4f8' }}>+{extra}</span>}
                              </span>
                            )
                          })()}
                        </>
                      )
                    })()}
                    {task.state === 3 && task.datetime_paused && task.minutes != null && (
                      <span style={{ fontSize: '0.65rem', color: '#e67e22' }}>
                        ⏱ {formatCountdown(new Date(new Date(task.datetime_paused).getTime() + task.minutes * pauseMultiplier * 60000).toISOString())}
                      </span>
                    )}
                    {task.state === 5 && task.datetime_respawn && (
                      <span style={{ fontSize: '0.65rem', color: '#9b59b6' }}>
                        ↺ {formatCountdown(task.datetime_respawn)}
                      </span>
                    )}
                    {task.pending_review && (
                      <span
                        style={{
                          fontSize: '0.65rem',
                          padding: '3px 8px',
                          background: 'rgba(230,126,34,0.15)',
                          border: '1px solid rgba(230,126,34,0.6)',
                          color: '#e67e22',
                          borderRadius: '10px',
                          fontFamily: 'var(--pip-font)',
                          textTransform: 'uppercase',
                        }}
                      >
                        Review
                      </span>
                    )}
                  </div>

                  {task.skill_execute_names.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '7px' }}>
                      {task.skill_execute_names.map((s) => {
                        const has = userSkills.includes(s)
                        return (
                          <span key={s} className={`skill-tag ${has ? 'skill-tag-has' : 'skill-tag-missing'}`}>
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
