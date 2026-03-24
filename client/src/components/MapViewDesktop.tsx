import { useEffect, useState, useRef, useCallback } from 'react'
import { MapContainer, TileLayer, Circle, Marker, Popup, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import api, { type Task, type User, type NewAchievement, STATE_LABELS, haversineKm, formatDistance, formatMinutes, formatCountdown, realTaskId } from '../api'
import { getTheme, applyTheme, TILE_CONFIGS, getGoogleTileUrl, invalidateGoogleSession, type TileConfig, type Theme } from '../theme'
import Chat from './ChatDesktop'
import TasksSidebar from './TasksSidebarDesktop'
import ActiveTaskPanel from './ActiveTaskPanelDesktop'
import RatingModal from './RatingModal'
import CreateTaskModal from './CreateTaskModalDesktop'
import TutorialPanel from './TutorialPanelDesktop'
import UserInfoPanel from './UserInfoPanelDesktop'

import AchievementToasts from './AchievementToast'
import { useLocationSocket } from '../hooks/useLocationSocket'

// Fix default marker icons broken by vite bundling
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

function RecenterOnMount({ lat, lon }: { lat: number; lon: number }) {
  const map = useMap()
  const done = useRef(false)
  useEffect(() => {
    if (!done.current) {
      map.setView([lat, lon], 13)
      done.current = true
    }
  }, [lat, lon, map])
  return null
}

function MapPanTo({ target }: { target: [number, number] | null }) {
  const map = useMap()
  useEffect(() => {
    if (target) {
      map.setView(target, 15)
    }
  }, [target, map])
  return null
}

function ProximityZoom({ lat, lon, radiusKm }: { lat: number; lon: number; radiusKm: number }) {
  const map = useMap()
  const done = useRef(false)
  useEffect(() => {
    if (!done.current) {
      try {
        const R = radiusKm
        const latDelta = R / 111.32
        const lonDelta = R / (111.32 * Math.cos(lat * Math.PI / 180))
        const bounds = L.latLngBounds(
          [lat - latDelta, lon - lonDelta],
          [lat + latDelta, lon + lonDelta]
        )
        map.fitBounds(bounds.pad(0.05))
        done.current = true
      } catch (e) {
        console.warn('ProximityZoom error:', e)
      }
    }
  }, [lat, lon, radiusKm, map])
  return null
}

function CenterOnMeListener() {
  const map = useMap()
  useEffect(() => {
    const handleCenter = (e: Event) => {
      const { lat, lon } = (e as CustomEvent).detail
      map.panTo([lat, lon])
    }
    const handlePan = (e: Event) => {
      const { lat, lon } = (e as CustomEvent).detail
      map.panTo([lat, lon])
    }
    window.addEventListener('pip-center-on-me', handleCenter)
    window.addEventListener('pip-pan-to', handlePan)
    return () => {
      window.removeEventListener('pip-center-on-me', handleCenter)
      window.removeEventListener('pip-pan-to', handlePan)
    }
  }, [map])
  return null
}

// ── WoW-style quest marker factory ──────────────────────────────────────────
const PIN_SHADOW = "filter:drop-shadow(0 2px 5px rgba(0,0,0,0.55))"

function makePin(symbol: 'exclaim' | 'question' | 'book', fill: string): string {
  const pinPath = "M14 1.5C7.1 1.5 1.5 7.1 1.5 14c0 4.9 2.6 9.2 6.5 11.6L14 38l6-12.4C23.9 23.2 26.5 18.9 26.5 14 26.5 7.1 20.9 1.5 14 1.5z"
  const strokeColor = "rgba(255,255,255,0.88)"

  let inner = ''
  if (symbol === 'exclaim') {
    inner = `<rect x="11.5" y="8" width="5" height="11" rx="2.5" fill="white"/><rect x="11.5" y="22" width="5" height="5" rx="2.5" fill="white"/>`
  } else if (symbol === 'question') {
    inner = `<text x="14" y="24" text-anchor="middle" fill="white" font-family="Georgia,'Times New Roman',serif" font-size="17" font-weight="900">?</text>`
  } else {
    inner = `<g transform="translate(5.5,9)">
      <line x1="8.5" y1="0" x2="8.5" y2="14" stroke="white" stroke-width="1.5" stroke-linecap="round"/>
      <path d="M8.5 0C6 0 2 1 0 3.5v11c2-2.5 6-3 8.5-3" stroke="white" stroke-width="1.5" fill="rgba(255,255,255,0.15)" stroke-linejoin="round"/>
      <path d="M8.5 0C11 0 15 1 17 3.5v11c-2-2.5-6-3-8.5-3" stroke="white" stroke-width="1.5" fill="rgba(255,255,255,0.15)" stroke-linejoin="round"/>
    </g>`
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="40" viewBox="0 0 28 40" style="${PIN_SHADOW}">
    <path d="${pinPath}" fill="${fill}" stroke="${strokeColor}" stroke-width="1.5"/>
    ${inner}
  </svg>`
}

function makeSmallDot(color: string): L.DivIcon {
  return L.divIcon({
    className: '',
    html: `<div style="width:14px;height:14px;border-radius:50%;background:${color};border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.4)"></div>`,
    iconSize: [14, 14], iconAnchor: [7, 7],
  })
}

function taskIcon(
  task: Task,
  currentUserId: number,
  currentUserSkills: string[],
  selfLocation: { lat: number; lon: number } | null,
  proximityKm: number,
  maxDistanceKm: number,
): L.DivIcon {
  const isMyTask = task.assignee === currentUserId

  // Compute distance once for reuse
  const distKm = selfLocation && task.lat != null && task.lon != null
    ? haversineKm(selfLocation.lat, selfLocation.lon, task.lat, task.lon) : null
  const outOfMaxRange = distKm !== null && distKm > maxDistanceKm

  // Determine the task color using the same logic for both pins and dots
  let taskColor = '#555' // default: unavailable/done

  if (task.is_tutorial) {
    taskColor = '#4285F4'
  } else if (isMyTask && task.state === 2) {
    taskColor = '#FBBC05'
  } else if (isMyTask && task.state === 3) {
    taskColor = '#777'
  } else if (task.state === 1) {
    const hasSkill = task.skill_execute_names.length === 0 ||
      task.skill_execute_names.some((s) => currentUserSkills.includes(s))
    if (!hasSkill) {
      taskColor = '#777'
    } else {
      const outOfReach = distKm !== null && distKm > proximityKm
      taskColor = outOfReach ? '#b8860b' : '#FBBC05'
    }
  }

  // Out of max range — small colored dot
  if (outOfMaxRange && !isMyTask) {
    return makeSmallDot(taskColor)
  }

  // Tutorial — blue book pin
  if (task.is_tutorial) {
    return L.divIcon({ className: '', html: makePin('book', taskColor), iconSize: [28, 40], iconAnchor: [14, 39] })
  }

  // My active/paused task — question pin
  if (isMyTask && (task.state === 2 || task.state === 3)) {
    return L.divIcon({ className: '', html: makePin('question', taskColor), iconSize: [28, 40], iconAnchor: [14, 39] })
  }

  // Open task — exclaim pin
  if (task.state === 1) {
    return L.divIcon({ className: '', html: makePin('exclaim', taskColor), iconSize: [28, 40], iconAnchor: [14, 39] })
  }

  // Unavailable / done — tiny grey dot
  return makeSmallDot('#555')
}

function profileIcon(pictureUrl: string, borderColor: string, name: string): L.DivIcon {
  const size = 36
  const fallback = name.charAt(0).toUpperCase()
  const inner = pictureUrl
    ? `<img src="${pictureUrl}" alt="" style="width:100%;height:100%;border-radius:50%;object-fit:cover;" referrerpolicy="no-referrer" />`
    : `<div style="width:100%;height:100%;border-radius:50%;background:${borderColor};display:flex;align-items:center;justify-content:center;color:#fff;font-weight:bold;font-size:14px;font-family:var(--pip-font)">${fallback}</div>`
  return L.divIcon({
    className: '',
    html: `<div style="width:${size}px;height:${size}px;border-radius:50%;border:3px solid ${borderColor};overflow:hidden;box-shadow:0 2px 6px rgba(0,0,0,0.5);background:#222">${inner}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  })
}

interface Props {
  user: User
  onLogout: () => void
}

export default function MapView({ user, onLogout }: Props) {
  const token = localStorage.getItem('token')
  const [tasks, setTasks] = useState<Task[]>([])
  const [currentUser, setCurrentUser] = useState<User>(user)
  const [error, setError] = useState('')
  const [panTarget, _setPanTarget] = useState<[number, number] | null>(null)
  const markerRefs = useRef<Map<number, L.Marker>>(new Map())
  const [ratingTarget, setRatingTarget] = useState<{ id: number; name: string; requireComment: boolean } | null>(null)
  const [createTaskPos, setCreateTaskPos] = useState<{ lat: number; lon: number } | null>(null)
  const [proximityKm, setProximityKm] = useState(1.0)
  const [maxDistanceKm, setMaxDistanceKm] = useState(1.0)
  const [coinsModifier, setCoinsModifier] = useState(100.0)
  const [xpModifier, setXpModifier] = useState(1.0)
  const [timeModifierMinutes, setTimeModifierMinutes] = useState(15.0)
  const [criticalityPercentage, setCriticalityPercentage] = useState(0.25)
  const [pauseMultiplier, setPauseMultiplier] = useState(1.0)
  const [achievementToasts, setAchievementToasts] = useState<NewAchievement[]>([])
  const [showAchievementsPanel, setShowAchievementsPanel] = useState(false)
  const [tileConfig, setTileConfig] = useState<TileConfig>(() => TILE_CONFIGS[getTheme()])

  // Apply persisted theme on mount and listen for changes
  useEffect(() => {
    const loadTiles = async (t: Theme) => {
      const google = await getGoogleTileUrl(t)
      setTileConfig(google ?? TILE_CONFIGS[t])
    }
    const theme = getTheme()
    applyTheme(theme)
    loadTiles(theme)

    const onThemeChange = () => loadTiles(getTheme())
    window.addEventListener('comrade-theme-change', onThemeChange)
    return () => window.removeEventListener('comrade-theme-change', onThemeChange)
  }, [])

  const {
    friends, publicUsers, chatMessages, selfLocation, sendChatMessage,
    taskUpdates, clearTaskUpdates, userStats, clearUserStats,
    wsAchievements, clearWsAchievements, friendEvents, clearFriendEvents, onlineFriendIds,
  } = useLocationSocket({
    token,
    username: user.username,
    userId: user.id,
  })

  const fetchTasks = useCallback(async () => {
    try {
      const res = await api.get('/tasks/')
      setTasks(res.data.tasks ?? res.data)
    } catch {
      setError('Failed to load tasks')
    }
  }, [])

  const fetchUser = useCallback(async () => {
    try {
      const res = await api.get('/user/')
      setCurrentUser(res.data)
    } catch {}
  }, [])

  // ── Live task updates from WebSocket ──
  useEffect(() => {
    if (taskUpdates.length === 0) return
    setTasks((prev) => {
      const updated = [...prev]
      for (const evt of taskUpdates) {
        const idx = updated.findIndex((t) => t.id === evt.task_id)
        if (idx >= 0) {
          updated[idx] = {
            ...updated[idx],
            state: evt.state,
            assignee: evt.assignee,
            assignee_name: evt.assignee_name,
            datetime_start: evt.datetime_start,
            datetime_finish: evt.datetime_finish,
            datetime_paused: evt.datetime_paused,
          }
        }
      }
      return updated
    })
    const needsRefetch = taskUpdates.some((e) =>
      ['decline_review', 'accept_review', 'abandon', 'reset'].includes(e.action)
    )
    if (needsRefetch) fetchTasks()
    clearTaskUpdates()
  }, [taskUpdates, clearTaskUpdates, fetchTasks])

  // ── Live user stats from WebSocket ──
  useEffect(() => {
    if (!userStats) return
    setCurrentUser((prev) => ({ ...prev, ...userStats }))
    clearUserStats()
  }, [userStats, clearUserStats])

  // ── Live achievements from WebSocket ──
  useEffect(() => {
    if (wsAchievements.length === 0) return
    setAchievementToasts((prev) => [...prev, ...wsAchievements])
    clearWsAchievements()
  }, [wsAchievements, clearWsAchievements])

  useEffect(() => {
    fetchTasks()
    api.get('/settings/proximity/').then((res) => {
      setProximityKm(res.data.radius_km ?? 1.0)
      setMaxDistanceKm(res.data.max_distance_km ?? 1.0)
      setCoinsModifier(res.data.coins_modifier ?? 100.0)
      setXpModifier(res.data.xp_modifier ?? 1.0)
      setTimeModifierMinutes(res.data.time_modifier_minutes ?? 15.0)
      setCriticalityPercentage(res.data.criticality_percentage ?? 0.25)
      setPauseMultiplier(res.data.pause_multiplier ?? 1.0)
    }).catch(() => {})
  }, [fetchTasks])

  const handleTaskAction = async (action: string, taskId: number) => {
    const taskInfo = tasks.find((t) => t.id === taskId)
    const isTutorial = taskInfo?.is_tutorial ?? false
    const realId = taskInfo ? realTaskId(taskInfo) : taskId
    const urlPrefix = isTutorial && (action === 'start' || action === 'abandon') ? 'tutorial_task' : 'task'
    try {
      const res = await api.post(`/${urlPrefix}/${realId}/${action}`)
      await fetchTasks()
      if (action === 'accept_review' || action === 'finish') {
        await fetchUser()
      }
      if (res.data?.new_achievements?.length) {
        setAchievementToasts((prev) => [...prev, ...res.data.new_achievements])
      }
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error
      setError(msg || `Failed to ${action} task`)
    }
  }

  const handleTaskClick = (task: Task) => {
    if (task.lat != null && task.lon != null) {
      window.dispatchEvent(new CustomEvent('pip-pan-to', { detail: { lat: task.lat, lon: task.lon } }))
      setTimeout(() => {
        markerRefs.current.get(task.id)?.openPopup()
      }, 300)
    }
  }

  const handleAddFriend = async (userId: number) => {
    try {
      await api.post(`/friends/send/${userId}/`)
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error
      setError(msg || 'Failed to send friend request')
    }
  }

  const centerLat = selfLocation?.lat ?? user.latitude ?? 50.0755
  const centerLon = selfLocation?.lon ?? user.longitude ?? 14.4378

  return (
    <div style={{ position: 'relative', width: '100%', height: '100vh', overflow: 'hidden' }}>
      {error && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 2000,
            background: 'rgba(234,67,53,0.9)',
            color: 'white',
            fontFamily: 'var(--pip-font)',
            fontSize: '0.75rem',
            padding: '6px 16px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          {error}
          <button
            onClick={() => setError('')}
            style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', fontSize: '1rem' }}
          >
            ×
          </button>
        </div>
      )}

      {/* Map */}
      <div
        style={{
          width: '100%',
          height: '100%',
          filter: tileConfig.filter,
        }}
      >
        <MapContainer
          center={[centerLat, centerLon]}
          zoom={13}
          style={{ height: '100%', width: '100%' }}
          zoomControl={false}
        >
          <TileLayer
            key={tileConfig.url}
            attribution={tileConfig.attribution}
            url={tileConfig.url}
            crossOrigin="anonymous"
            maxZoom={18}
            maxNativeZoom={18}
            updateWhenZooming={false}
            eventHandlers={{ tileerror: () => { if (tileConfig.url.includes('tile.googleapis.com')) { const t = getTheme(); invalidateGoogleSession(t); setTileConfig(TILE_CONFIGS[t]) } } }}
          />
          <RecenterOnMount lat={centerLat} lon={centerLon} />
          <MapPanTo target={panTarget} />
          <CenterOnMeListener />
          {selfLocation && <ProximityZoom lat={selfLocation.lat} lon={selfLocation.lon} radiusKm={proximityKm} />}
          {(currentUser.is_superuser || currentUser.is_staff) && (
            <RightClickHandler onRightClick={(lat, lon) => setCreateTaskPos({ lat, lon })} />
          )}

          {/* Self location */}
          {selfLocation && (
            <>
              <Marker
                position={[selfLocation.lat, selfLocation.lon]}
                icon={profileIcon(currentUser.profile_picture, '#4285F4', currentUser.username)}
              >
                <Popup>
                  <div style={{ fontFamily: 'monospace', color: 'var(--pip-text)', minWidth: '160px' }}>
                    <div style={{ fontWeight: 'bold', marginBottom: '6px', borderBottom: '1px solid var(--pip-border)', paddingBottom: '4px' }}>
                      {currentUser.username} (You)
                    </div>
                    {currentUser.skills?.length > 0 && (
                      <div style={{ fontSize: '0.7rem', marginTop: '4px' }}>
                        <span style={{ color: 'var(--pip-green-dark)' }}>Skills: </span>
                        {currentUser.skills.join(', ')}
                      </div>
                    )}
                  </div>
                </Popup>
              </Marker>
              {selfLocation.accuracy > 0 && (
                <Circle
                  center={[selfLocation.lat, selfLocation.lon]}
                  radius={selfLocation.accuracy}
                  pathOptions={{ color: '#4285F4', weight: 1, fillColor: '#4285F4', fillOpacity: 0.1, interactive: false }}
                />
              )}
              <Circle
                center={[selfLocation.lat, selfLocation.lon]}
                radius={proximityKm * 1000}
                pathOptions={{ color: '#34A853', weight: 1.5, fillColor: '#34A853', fillOpacity: 0.04, dashArray: '4 4', interactive: false }}
              />
            </>
          )}

          {/* Friend locations */}
          {Array.from(friends.values()).map((friend) => (
            <Marker
              key={friend.userId}
              position={[friend.lat, friend.lon]}
              icon={profileIcon(friend.profilePicture, '#34A853', friend.name)}
            >
              <Popup>
                <div style={{ fontFamily: 'monospace', color: 'var(--pip-text)', minWidth: '180px' }}>
                  <div style={{ fontWeight: 'bold', marginBottom: '6px', borderBottom: '1px solid var(--pip-border)', paddingBottom: '4px' }}>
                    {friend.name}
                  </div>
                  {friend.skills?.length > 0 && (
                    <div style={{ fontSize: '0.7rem', marginBottom: '4px' }}>
                      <span style={{ color: 'var(--pip-green-dark)' }}>Skills: </span>
                      {friend.skills.join(', ')}
                    </div>
                  )}
                  {friend.friends?.length > 0 && (
                    <div style={{ fontSize: '0.7rem' }}>
                      <span style={{ color: 'var(--pip-green-dark)' }}>Mutual friends: </span>
                      {friend.friends.map((f) => f.name).join(', ')}
                    </div>
                  )}
                </div>
              </Popup>
            </Marker>
          ))}

          {/* Public user locations */}
          {Array.from(publicUsers.values()).map((pub) => (
            <Marker
              key={pub.userId}
              position={[pub.lat, pub.lon]}
              icon={profileIcon(pub.profilePicture, '#FBBC05', pub.name)}
            >
              <Popup>
                <div style={{ fontFamily: 'monospace', color: 'var(--pip-text)', minWidth: '160px' }}>
                  <div style={{ fontWeight: 'bold', marginBottom: '8px', borderBottom: '1px solid var(--pip-border)', paddingBottom: '4px' }}>
                    {pub.name}
                  </div>
                  <button
                    className="pip-popup-btn pip-popup-btn-primary"
                    onClick={() => handleAddFriend(pub.userId)}
                  >
                    Add to Friends
                  </button>
                </div>
              </Popup>
            </Marker>
          ))}

          {/* Task markers */}
          {tasks
            .filter((t) => t.lat != null && t.lon != null)
            .map((task) => {
              const icon = taskIcon(task, currentUser.id, currentUser.skills, selfLocation, proximityKm, maxDistanceKm)
              return (
                <Marker
                  key={`${task.is_tutorial ? 't' : 'r'}-${task.id}`}
                  ref={(el) => {
                    if (el) markerRefs.current.set(task.id, el)
                    else markerRefs.current.delete(task.id)
                  }}
                  position={[task.lat!, task.lon!]}
                  icon={icon}
                >
                  <Popup>
                    <TaskPopupContent
                      task={task}
                      currentUserId={currentUser.id}
                      currentUserSkills={currentUser.skills}
                      selfLocation={selfLocation}
                      proximityKm={proximityKm}
                      coinsModifier={coinsModifier}
                      xpModifier={xpModifier}
                      timeModifierMinutes={timeModifierMinutes}
                      criticalityPercentage={criticalityPercentage}
                      pauseMultiplier={pauseMultiplier}
                      onAction={handleTaskAction}
                      onRefresh={fetchTasks}
                    />
                  </Popup>
                </Marker>
              )
            })}
        </MapContainer>
      </div>

      {/* Overlays (outside filter div so they keep proper colors) */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 999 }}>
        <div style={{ pointerEvents: 'auto' }}>
          {/* Tasks sidebar - top left */}
          <TasksSidebar tasks={tasks} userId={currentUser.id} userSkills={currentUser.skills} selfLocation={selfLocation} proximityKm={proximityKm} maxDistanceKm={maxDistanceKm} coinsModifier={coinsModifier} xpModifier={xpModifier} timeModifierMinutes={timeModifierMinutes} criticalityPercentage={criticalityPercentage} pauseMultiplier={pauseMultiplier} onTaskClick={handleTaskClick} onAction={handleTaskAction} />

          {/* Active task panel - bottom center */}
          {(() => {
            const activeTask = tasks.find((t) => t.is_tutorial ? t.in_progress : ((t.state === 2 || t.state === 3) && t.assignee === currentUser.id))
            if (!activeTask) return null
            if (activeTask.is_tutorial) return (
              <TutorialPanel
                task={activeTask}
                onCompleted={() => { fetchTasks() }}
                onLocate={handleTaskClick}
                onAction={handleTaskAction}
                onNewAchievements={(a) => setAchievementToasts((prev) => [...prev, ...a])}
              />
            )
            return (
              <ActiveTaskPanel
                task={activeTask}
                coinsModifier={coinsModifier}
                xpModifier={xpModifier}
                timeModifierMinutes={timeModifierMinutes}
                criticalityPercentage={criticalityPercentage}
                onFinished={(id, name) => { setRatingTarget({ id, name, requireComment: activeTask.require_comment ?? false }); fetchTasks() }}
                onAction={handleTaskAction}
                onLocate={handleTaskClick}
              />
            )
          })()}

          {/* Rating modal - shown after finishing a task */}
          {ratingTarget && (
            <RatingModal
              taskId={ratingTarget.id}
              taskName={ratingTarget.name}
              requireComment={ratingTarget.requireComment}
              onClose={() => setRatingTarget(null)}
            />
          )}

          {/* Create task modal */}
          {createTaskPos && (
            <CreateTaskModal
              lat={createTaskPos.lat}
              lon={createTaskPos.lon}
              userSkills={currentUser.skills}
              onCreated={fetchTasks}
              onClose={() => setCreateTaskPos(null)}
            />
          )}

          {/* Achievement toasts */}
          <AchievementToasts
            toasts={achievementToasts}
            onDismiss={(id) => setAchievementToasts((prev) => prev.filter((t) => t.id !== id))}
            onTap={() => setShowAchievementsPanel(true)}
          />

          {/* User info panel - top right */}
          <UserInfoPanel user={currentUser} onLogout={onLogout} onlineFriendIds={onlineFriendIds} friendEvents={friendEvents} clearFriendEvents={clearFriendEvents} openAchievements={showAchievementsPanel} onAchievementsClosed={() => setShowAchievementsPanel(false)} />

          {/* Chat - bottom left */}
          <Chat messages={chatMessages} onSend={sendChatMessage} />

          {/* Bottom-right: Center on Me */}
          <div style={{ position: 'absolute', bottom: '16px', right: '16px', zIndex: 1000 }}>
            <CenterOnMeInOverlay selfLat={selfLocation?.lat ?? null} selfLon={selfLocation?.lon ?? null} />
          </div>
        </div>
      </div>
    </div>
  )
}

// CenterOnMe button outside the map context — uses geolocation directly
function CenterOnMeInOverlay({ selfLat, selfLon }: { selfLat: number | null; selfLon: number | null }) {
  // This just renders a placeholder; the actual centering happens inside the map via a map child
  // We need to lift state. Since this is outside the map, we use a different approach:
  // We render a button that dispatches a custom event the map listens to.
  const handleCenter = () => {
    const lat = selfLat
    const lon = selfLon
    if (lat != null && lon != null) {
      window.dispatchEvent(new CustomEvent('pip-center-on-me', { detail: { lat, lon } }))
    } else if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          window.dispatchEvent(
            new CustomEvent('pip-center-on-me', {
              detail: { lat: pos.coords.latitude, lon: pos.coords.longitude },
            })
          )
        },
        (err) => console.warn('Geolocation error:', err),
        { enableHighAccuracy: true, timeout: 5000 }
      )
    }
  }

  return (
    <button
      onClick={handleCenter}
      className="pip-btn pip-btn-primary"
      style={{ padding: '8px 14px', fontSize: '0.75rem', width: '100%' }}
    >
      Center on Me
    </button>
  )
}

function RightClickHandler({ onRightClick }: { onRightClick: (lat: number, lon: number) => void }) {
  useMapEvents({
    contextmenu(e) {
      onRightClick(e.latlng.lat, e.latlng.lng)
    },
  })
  return null
}

// Task popup content rendered inside Leaflet Popup
interface TaskPopupProps {
  task: Task
  currentUserId: number
  currentUserSkills: string[]
  selfLocation: { lat: number; lon: number } | null
  proximityKm: number
  coinsModifier: number
  xpModifier: number
  timeModifierMinutes: number
  criticalityPercentage: number
  pauseMultiplier: number
  onAction: (action: string, taskId: number) => Promise<void>
  onRefresh: () => Promise<void>
}

function TaskPopupContent({ task, currentUserId, currentUserSkills, selfLocation, proximityKm, coinsModifier, xpModifier, timeModifierMinutes, criticalityPercentage, pauseMultiplier, onAction }: TaskPopupProps) {
  const isAssignee = task.assignee === currentUserId
  const isOwner = task.owner === currentUserId
  const canStart = task.skill_execute_names.length === 0 || task.skill_execute_names.some((s) => currentUserSkills.includes(s))
  const canReview = !isAssignee && (isOwner || ((task.skill_write_names?.length ?? 0) > 0 && (task.skill_write_names ?? []).some((s) => currentUserSkills.includes(s))))
  const distanceKm = (selfLocation && task.lat != null && task.lon != null)
    ? haversineKm(selfLocation.lat, selfLocation.lon, task.lat, task.lon)
    : null
  const inProximity = distanceKm === null || distanceKm <= proximityKm
  const timeMultiplier = (task.minutes && timeModifierMinutes > 0) ? task.minutes / timeModifierMinutes : 1.0
  const criticalityFactor = 1.0 + ((task.criticality ?? 1) - 1) * criticalityPercentage

  return (
    <div style={{ fontFamily: 'monospace', color: 'var(--pip-text)', minWidth: '200px', maxWidth: '260px' }}>
      <div
        style={{
          fontWeight: 'bold',
          marginBottom: '6px',
          borderBottom: '1px solid var(--pip-border)',
          paddingBottom: '4px',
          fontSize: '0.85rem',
        }}
      >
        {task.name}
      </div>

      {task.description && (
        <div style={{ fontSize: '0.72rem', marginBottom: '6px', color: 'rgba(51,214,136,0.8)' }}>
          {task.description}
        </div>
      )}

      {task.photo && (
        <img
          src={task.photo}
          alt="Task photo"
          style={{ width: '100%', maxHeight: '140px', objectFit: 'cover', marginBottom: '8px', border: '1px solid var(--pip-border)' }}
        />
      )}

      {!task.is_tutorial && (
        <div style={{ fontSize: '0.65rem', marginBottom: '4px' }}>
          <span style={{ color: 'var(--pip-green-dark)' }}>Status: </span>
          <span>{STATE_LABELS[task.state ?? 1]}</span>
        </div>
      )}
      {task.is_tutorial && task.reward_skill_name && (
        <div style={{ fontSize: '0.65rem', marginBottom: '4px' }}>
          <span style={{ color: 'var(--pip-green-dark)' }}>Reward: </span>
          <span style={{ color: '#34A853' }}>{task.reward_skill_name}</span>
        </div>
      )}

      {task.state === 3 && task.datetime_paused && task.minutes != null && (
        <div style={{ fontSize: '0.65rem', marginBottom: '4px' }}>
          <span style={{ color: 'var(--pip-green-dark)' }}>Resets in: </span>
          <span style={{ color: '#e67e22' }}>⏱ {formatCountdown(new Date(new Date(task.datetime_paused).getTime() + task.minutes * pauseMultiplier * 60000).toISOString())}</span>
        </div>
      )}
      {!task.is_tutorial && task.respawn && (
        <div style={{ fontSize: '0.65rem', marginBottom: '4px' }}>
          <span style={{ color: 'var(--pip-green-dark)' }}>Respawn: </span>
          <span>{task.respawn_offset ? formatMinutes(task.respawn_offset) : task.respawn_time ?? 'Yes'}</span>
        </div>
      )}
      {task.state === 5 && task.datetime_respawn && (
        <div style={{ fontSize: '0.65rem', marginBottom: '4px' }}>
          <span style={{ color: 'var(--pip-green-dark)' }}>Respawns in: </span>
          <span style={{ color: '#9b59b6' }}>↺ {formatCountdown(task.datetime_respawn)}</span>
        </div>
      )}

      {task.assignee_name && (
        <div style={{ fontSize: '0.65rem', marginBottom: '4px' }}>
          <span style={{ color: 'var(--pip-green-dark)' }}>Assigned to: </span>
          <span>{task.assignee_name}</span>
        </div>
      )}

      {distanceKm !== null && (
        <div style={{ fontSize: '0.65rem', marginBottom: '4px' }}>
          <span style={{ color: 'var(--pip-green-dark)' }}>Distance: </span>
          <span style={{ color: inProximity ? 'var(--pip-text)' : '#EA4335' }}>{formatDistance(distanceKm)}</span>
          {!inProximity && <span style={{ color: '#EA4335' }}> (out of range)</span>}
        </div>
      )}

      {task.minutes != null && (
        <div style={{ fontSize: '0.65rem', marginBottom: '4px' }}>
          <span style={{ color: 'var(--pip-green-dark)' }}>Est. time: </span>
          <span>{formatMinutes(task.minutes)}</span>
        </div>
      )}

      {(task.coins != null || task.xp != null) && (
        <div style={{ fontSize: '0.65rem', marginBottom: '4px', display: 'flex', gap: '10px' }}>
          {task.coins != null && (
            <span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#FBBC05' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#FBBC05', display: 'inline-block', flexShrink: 0 }} />
                {Math.round(task.coins * coinsModifier * timeMultiplier)}
              </span>
            </span>
          )}
          {task.xp != null && (
            <span>
              <span style={{ color: 'var(--pip-green-dark)' }}>XP: </span>
              {(() => {
                const base = Math.round(task.xp * xpModifier * timeMultiplier)
                const extra = Math.round(task.xp * xpModifier * timeMultiplier * criticalityFactor) - base
                return (
                  <span style={{ color: '#4285F4' }}>
                    {base}
                    {extra > 0 && <span style={{ color: '#89b4f8' }}>+{extra}</span>}
                  </span>
                )
              })()}
            </span>
          )}
        </div>
      )}

      {task.skill_execute_names.length > 0 && (
        <div style={{ fontSize: '0.65rem', marginBottom: '6px' }}>
          <span style={{ color: 'var(--pip-green-dark)' }}>Requires: </span>
          <span style={{ display: 'inline-flex', flexWrap: 'wrap', gap: '3px', marginTop: '2px' }}>
            {task.skill_execute_names.map((s) => {
              const has = currentUserSkills.includes(s)
              return (
              <span
                key={s}
                style={{
                  fontSize: '0.6rem',
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
          </span>
        </div>
      )}

      {/* Review details for owner/reviewer when task is IN_REVIEW */}
      {task.state === 4 && canReview && task.pending_review && (
        <div style={{ margin: '8px 0', padding: '6px 8px', border: '1px solid var(--pip-border)', background: 'rgba(46,194,126,0.04)' }}>
          <div style={{ fontSize: '0.6rem', color: 'var(--pip-green-dark)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>
            Completion Report
          </div>
          {task.pending_review.comment && (
            <div style={{ fontSize: '0.72rem', color: 'var(--pip-text)', marginBottom: '4px' }}>
              {task.pending_review.comment}
            </div>
          )}
          {task.pending_review.photo && (
            <a
              href={task.pending_review.photo}
              target="_blank"
              rel="noreferrer"
              style={{ fontSize: '0.65rem', color: 'var(--pip-green)' }}
            >
              View photo
            </a>
          )}
          {!task.pending_review.comment && !task.pending_review.photo && (
            <div style={{ fontSize: '0.7rem', color: 'var(--pip-green-dark)' }}>No details provided.</div>
          )}
        </div>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '8px' }}>
        {/* Tutorial actions */}
        {task.is_tutorial && !task.in_progress && canStart && inProximity && (
          <button className="pip-popup-btn pip-popup-btn-primary" onClick={() => onAction('start', task.id)}>
            Start
          </button>
        )}
        {task.is_tutorial && task.in_progress && (
          <>
            <div style={{ fontSize: '0.65rem', color: 'var(--pip-green-dark)', fontStyle: 'italic', width: '100%' }}>
              Use the tutorial panel at the bottom to proceed.
            </div>
            <button
              className="pip-popup-btn"
              style={{ borderColor: '#EA4335', color: '#EA4335' }}
              onClick={() => onAction('abandon', task.id)}
            >
              Abandon
            </button>
          </>
        )}

        {/* Regular task actions */}
        {!task.is_tutorial && task.state === 1 && canStart && inProximity && (
          <button className="pip-popup-btn pip-popup-btn-primary" onClick={() => onAction('start', task.id)}>
            Start
          </button>
        )}
        {!task.is_tutorial && task.state === 2 && isAssignee && (
          <>
            <button className="pip-popup-btn" onClick={() => onAction('pause', task.id)}>
              Pause
            </button>
            <button className="pip-popup-btn pip-popup-btn-primary" onClick={() => onAction('finish', task.id)}>
              Finish
            </button>
            <button
              className="pip-popup-btn"
              style={{ borderColor: '#EA4335', color: '#EA4335' }}
              onClick={() => onAction('abandon', task.id)}
            >
              Abandon
            </button>
          </>
        )}
        {!task.is_tutorial && task.state === 3 && isAssignee && (
          <>
            {inProximity && (
              <button className="pip-popup-btn pip-popup-btn-primary" onClick={() => onAction('resume', task.id)}>
                Resume
              </button>
            )}
            <button
              className="pip-popup-btn"
              style={{ borderColor: '#EA4335', color: '#EA4335' }}
              onClick={() => onAction('abandon', task.id)}
            >
              Abandon
            </button>
          </>
        )}
        {!task.is_tutorial && task.state === 4 && canReview && (
          <>
            <button className="pip-popup-btn pip-popup-btn-primary" onClick={() => onAction('accept_review', task.id)}>
              Accept
            </button>
            <button className="pip-popup-btn" style={{ borderColor: '#EA4335', color: '#EA4335' }} onClick={() => onAction('decline_review', task.id)}>
              Decline
            </button>
          </>
        )}
        {!task.is_tutorial && isOwner && (
          <button
            className="pip-popup-btn"
            style={{ borderColor: '#888', color: '#888', fontSize: '0.6rem' }}
            onClick={() => onAction('reset', task.id)}
          >
            Reset
          </button>
        )}
      </div>
    </div>
  )
}
