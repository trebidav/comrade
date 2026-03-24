import { useEffect, useState, useRef, useCallback } from 'react'
import { MapContainer, TileLayer, Circle, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import api, { type Task, type User, type NewAchievement, STATE_LABELS, haversineKm, formatDistance, formatMinutes, formatCountdown, realTaskId } from '../api'
import { getTheme, applyTheme, TILE_CONFIGS, getGoogleTileUrl, invalidateGoogleSession, type TileConfig, type Theme } from '../theme'
import Chat from './Chat'
import TasksSidebar from './TasksSidebar'
import ActiveTaskPanel from './ActiveTaskPanel'
import RatingModal from './RatingModal'
import CreateTaskModal from './CreateTaskModal'
import TutorialPanel from './TutorialPanel'
import UserInfoPanel from './UserInfoPanel'
import AchievementToasts from './AchievementToast'
import BottomSheet from './BottomSheet'
import { useLocationSocket } from '../hooks/useLocationSocket'
import { IconTasks, IconChat, IconPerson, IconCenterOnMe, IconPlus } from './Icons'

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
    if (target) map.setView(target, 15)
  }, [target, map])
  return null
}

function ProximityZoom({ lat, lon, radiusKm }: { lat: number; lon: number; radiusKm: number }) {
  const map = useMap()
  const done = useRef(false)
  useEffect(() => {
    if (!done.current) {
      try {
        const latDelta = radiusKm / 111.32
        const lonDelta = radiusKm / (111.32 * Math.cos(lat * Math.PI / 180))
        map.fitBounds(L.latLngBounds([lat - latDelta, lon - lonDelta], [lat + latDelta, lon + lonDelta]).pad(0.05))
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
    window.addEventListener('pip-center-on-me', handleCenter)
    window.addEventListener('pip-pan-to', handleCenter)
    return () => {
      window.removeEventListener('pip-center-on-me', handleCenter)
      window.removeEventListener('pip-pan-to', handleCenter)
    }
  }, [map])
  return null
}

function LongPressHandler({ onLongPress }: { onLongPress: (lat: number, lon: number) => void }) {
  const map = useMap()
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null
    let startPos: { lat: number; lon: number } | null = null

    const onTouchStart = (e: L.LeafletEvent) => {
      const le = e as L.LeafletMouseEvent
      startPos = { lat: le.latlng.lat, lon: le.latlng.lng }
      timer = setTimeout(() => {
        if (startPos) onLongPress(startPos.lat, startPos.lon)
      }, 600)
    }
    const onTouchMove = () => {
      if (timer) { clearTimeout(timer); timer = null }
    }
    const onTouchEnd = () => {
      if (timer) { clearTimeout(timer); timer = null }
    }
    const onContextMenu = (e: L.LeafletMouseEvent) => {
      onLongPress(e.latlng.lat, e.latlng.lng)
    }

    map.on('mousedown', onTouchStart)
    map.on('mousemove', onTouchMove)
    map.on('mouseup', onTouchEnd)
    map.on('contextmenu', onContextMenu)
    return () => {
      map.off('mousedown', onTouchStart)
      map.off('mousemove', onTouchMove)
      map.off('mouseup', onTouchEnd)
      map.off('contextmenu', onContextMenu)
      if (timer) clearTimeout(timer)
    }
  }, [map, onLongPress])
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
    // Open book icon
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
    const hasSkill = task.skill_execute_names.length === 0 || task.skill_execute_names.some((s) => currentUserSkills.includes(s))
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

type MainSheet = null | 'tasks' | 'chat' | 'profile'

export default function MapView({ user, onLogout }: Props) {
  const token = localStorage.getItem('token')
  const [tasks, setTasks] = useState<Task[]>([])
  const [currentUser, setCurrentUser] = useState<User>(user)
  const [error, setError] = useState('')
  const [panTarget] = useState<[number, number] | null>(null)
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
  const [activeSheet, setActiveSheet] = useState<MainSheet>(null)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [animatingTab, setAnimatingTab] = useState<MainSheet | 'map' | null>(null)
  const [chatUnread, setChatUnread] = useState(0)
  const activeSheetRef = useRef<MainSheet>(null)
  activeSheetRef.current = activeSheet

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

  useEffect(() => {
    const last = chatMessages[chatMessages.length - 1]
    if (last && !last.isSelf && activeSheetRef.current !== 'chat') {
      setChatUnread((n) => n + 1)
    }
  }, [chatMessages.length]) // eslint-disable-line react-hooks/exhaustive-deps

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
    } catch { /* ignore */ }
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
      if (action === 'accept_review' || action === 'finish') await fetchUser()
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
    }
    setSelectedTask(task)
    setActiveSheet(null)
  }

  const handleAddFriend = async (userId: number) => {
    try {
      await api.post(`/friends/send/${userId}/`)
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error
      setError(msg || 'Failed to send friend request')
    }
  }

  const handleCenterOnMe = () => {
    const lat = selfLocation?.lat
    const lon = selfLocation?.lon
    if (lat != null && lon != null) {
      window.dispatchEvent(new CustomEvent('pip-center-on-me', { detail: { lat, lon } }))
    } else if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => window.dispatchEvent(new CustomEvent('pip-center-on-me', {
          detail: { lat: pos.coords.latitude, lon: pos.coords.longitude },
        })),
        (err) => console.warn('Geolocation error:', err),
        { enableHighAccuracy: true, timeout: 5000 }
      )
    }
  }

  const centerLat = selfLocation?.lat ?? user.latitude ?? 50.0755
  const centerLon = selfLocation?.lon ?? user.longitude ?? 14.4378

  const activeTask = tasks.find((t) => t.is_tutorial ? t.in_progress : ((t.state === 2 || t.state === 3) && t.assignee === currentUser.id))
  const activeTaskCount = tasks.filter((t) => t.is_tutorial ? t.in_progress : (t.state === 2 || t.state === 3) && t.assignee === currentUser.id).length

  // Calculate FAB bottom offset (above active task bar if shown)
  const ACTIVE_BAR_H = 62
  const fabBottom = activeTask
    ? `calc(var(--nav-height) + var(--safe-bottom) + ${ACTIVE_BAR_H}px + 14px)`
    : `calc(var(--nav-height) + var(--safe-bottom) + 14px)`

  return (
    <div style={{ position: 'relative', width: '100%', height: '100dvh', overflow: 'hidden' }}>
      {/* Map */}
      <div style={{ width: '100%', height: '100%', filter: tileConfig.filter }}>
        <MapContainer
          center={[centerLat, centerLon]}
          zoom={13}
          style={{ height: '100%', width: '100%' }}
          zoomControl={false}
          attributionControl={false}
        >
          <TileLayer key={tileConfig.url} attribution={tileConfig.attribution} url={tileConfig.url} crossOrigin="anonymous" maxZoom={18} maxNativeZoom={18} updateWhenZooming={false} eventHandlers={{ tileerror: () => { if (tileConfig.url.includes('tile.googleapis.com')) { const t = getTheme(); invalidateGoogleSession(t); setTileConfig(TILE_CONFIGS[t]) } } }} />
          <RecenterOnMount lat={centerLat} lon={centerLon} />
          <MapPanTo target={panTarget} />
          <CenterOnMeListener />
          {selfLocation && <ProximityZoom lat={selfLocation.lat} lon={selfLocation.lon} radiusKm={proximityKm} />}
          {(currentUser.is_superuser || currentUser.is_staff) && (
            <LongPressHandler onLongPress={(lat, lon) => setCreateTaskPos({ lat, lon })} />
          )}

          {/* Self location */}
          {selfLocation && (
            <>
              <Marker
                position={[selfLocation.lat, selfLocation.lon]}
                icon={profileIcon(currentUser.profile_picture, '#4285F4', currentUser.username)}
              >
                <Popup>
                  <div style={{ fontFamily: 'monospace', color: 'var(--pip-text)', minWidth: '140px' }}>
                    <div style={{ fontWeight: 'bold', marginBottom: '4px', borderBottom: '1px solid var(--pip-border)', paddingBottom: '3px' }}>
                      {currentUser.username} (You)
                    </div>
                    {currentUser.skills?.length > 0 && (
                      <div style={{ fontSize: '0.75rem', marginTop: '4px' }}>
                        <span style={{ color: 'var(--pip-green-dark)' }}>Skills: </span>
                        {currentUser.skills.join(', ')}
                      </div>
                    )}
                  </div>
                </Popup>
              </Marker>
              {(selfLocation as { accuracy?: number }).accuracy != null && (selfLocation as { accuracy?: number }).accuracy! > 0 && (
                <Circle
                  center={[selfLocation.lat, selfLocation.lon]}
                  radius={(selfLocation as { accuracy?: number }).accuracy!}
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
                <div style={{ fontFamily: 'monospace', color: 'var(--pip-text)', minWidth: '140px' }}>
                  <div style={{ fontWeight: 'bold', marginBottom: '4px', borderBottom: '1px solid var(--pip-border)', paddingBottom: '3px' }}>{friend.name}</div>
                  {friend.skills?.length > 0 && (
                    <div style={{ fontSize: '0.75rem' }}>
                      <span style={{ color: 'var(--pip-green-dark)' }}>Skills: </span>
                      {friend.skills.join(', ')}
                    </div>
                  )}
                </div>
              </Popup>
            </Marker>
          ))}

          {/* Public users */}
          {Array.from(publicUsers.values()).map((pub) => (
            <Marker
              key={pub.userId}
              position={[pub.lat, pub.lon]}
              icon={profileIcon(pub.profilePicture, '#FBBC05', pub.name)}
            >
              <Popup>
                <div style={{ fontFamily: 'monospace', color: 'var(--pip-text)', minWidth: '140px' }}>
                  <div style={{ fontWeight: 'bold', marginBottom: '6px', borderBottom: '1px solid var(--pip-border)', paddingBottom: '3px' }}>{pub.name}</div>
                  <button className="pip-popup-btn pip-popup-btn-primary" onClick={() => handleAddFriend(pub.userId)} style={{ fontSize: '0.75rem', padding: '6px 10px' }}>
                    Add Friend
                  </button>
                </div>
              </Popup>
            </Marker>
          ))}

          {/* Task markers — tap to open detail sheet */}
          {tasks
            .filter((t) => t.lat != null && t.lon != null)
            .map((task) => {
              const icon = taskIcon(task, currentUser.id, currentUser.skills, selfLocation, proximityKm, maxDistanceKm)
              return (
                <Marker
                  key={`${task.is_tutorial ? 't' : 'r'}-${task.id}`}
                  position={[task.lat!, task.lon!]}
                  icon={icon}
                  eventHandlers={{
                    click: () => {
                      setSelectedTask(task)
                      setActiveSheet(null)
                    },
                  }}
                />
              )
            })}
        </MapContainer>
      </div>

      {/* ── Overlays ─────────────────────────────────────────────────── */}

      {/* Error banner */}
      {error && (
        <div className="error-banner">
          <span>{error}</span>
          <button onClick={() => setError('')} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', fontSize: '1.4rem', lineHeight: 1, padding: '4px', minHeight: '36px', touchAction: 'manipulation' }}>×</button>
        </div>
      )}

      {/* Achievement toasts */}
      <AchievementToasts
        toasts={achievementToasts}
        onDismiss={(id) => setAchievementToasts((prev) => prev.filter((t) => t.id !== id))}
        onTap={() => setShowAchievementsPanel(true)}
      />

      {/* Profile button — top right corner */}
      <button
        onClick={() => setActiveSheet(activeSheet === 'profile' ? null : 'profile')}
        style={{
          position: 'fixed',
          top: `calc(var(--safe-top) + 12px)`,
          right: '14px',
          zIndex: 1100,
          width: '42px',
          height: '42px',
          borderRadius: '50%',
          background: activeSheet === 'profile' ? 'var(--pip-green-dark)' : 'var(--glass-bg)',
          backdropFilter: 'var(--glass-blur)',
          WebkitBackdropFilter: 'var(--glass-blur)',
          border: `2px solid ${activeSheet === 'profile' ? 'var(--pip-green)' : 'var(--glass-border)'}`,
          color: activeSheet === 'profile' ? 'var(--pip-bg)' : 'var(--pip-green)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          touchAction: 'manipulation',
          boxShadow: 'var(--glass-shadow)',
          transition: 'transform 0.12s var(--spring), background 0.15s, border-color 0.15s',
          animation: 'scaleIn 0.4s var(--spring) 0.1s both',
        }}
        onPointerDown={(e) => (e.currentTarget.style.transform = 'scale(0.88)')}
        onPointerUp={(e) => (e.currentTarget.style.transform = '')}
        onPointerLeave={(e) => (e.currentTarget.style.transform = '')}
      >
        <IconPerson size={20} />
      </button>

      {/* FABs */}
      <div className="fab-container" style={{ position: 'fixed', right: '14px', bottom: fabBottom, zIndex: 1100, display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <button className="fab" onClick={handleCenterOnMe} title="Center on me">
          <IconCenterOnMe size={22} />
        </button>
        {(currentUser.is_superuser || currentUser.is_staff) && (
          <button
            className="fab"
            style={{ borderColor: '#4285F4', color: '#4285F4' }}
            onClick={() => {
              const lat = selfLocation?.lat ?? user.latitude ?? 50.0755
              const lon = selfLocation?.lon ?? user.longitude ?? 14.4378
              setCreateTaskPos({ lat, lon })
            }}
            title="Create task at current location"
          >
            <IconPlus size={22} color="#4285F4" />
          </button>
        )}
      </div>

      {/* Active task bar (shown above nav when task is in progress) */}
      {activeTask && (
        activeTask.is_tutorial ? (
          <TutorialPanel
            task={activeTask}
            onCompleted={() => { fetchTasks() }}
            onLocate={handleTaskClick}
            onAction={handleTaskAction}
            onNewAchievements={(a) => setAchievementToasts((prev) => [...prev, ...a])}
          />
        ) : (
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
      )}

      {/* Bottom Navigation — Tasks + Chat only */}
      <nav className="bottom-nav">
        {([
          { key: 'tasks' as MainSheet, icon: <IconTasks size={22} />, label: 'Tasks', badge: activeTaskCount || undefined },
          { key: 'chat' as MainSheet, icon: <IconChat size={22} />, label: 'Chat', badge: chatUnread || undefined },
        ] as { key: MainSheet; icon: React.ReactNode; label: string; badge?: number }[]).map((tab) => {
          const isActive = activeSheet === tab.key
          return (
            <button
              key={tab.key}
              className={`nav-btn${isActive ? ' nav-active' : ''}`}
              onClick={() => {
                setActiveSheet(activeSheet === tab.key ? null : tab.key)
                if (tab.key === 'chat') setChatUnread(0)
                setAnimatingTab(tab.key)
                setTimeout(() => setAnimatingTab(null), 350)
              }}
            >
              <span className={`nav-icon${animatingTab === tab.key ? ' nav-icon-pop' : ''}`}>
                {tab.icon}
              </span>
              {tab.label}
              {tab.badge != null && tab.badge > 0 && (
                <span className="nav-badge">{tab.badge > 9 ? '9+' : tab.badge}</span>
              )}
            </button>
          )
        })}
      </nav>

      {/* Tasks sheet */}
      <BottomSheet
        open={activeSheet === 'tasks'}
        onClose={() => setActiveSheet(null)}
        title="Tasks"
        height="full"
      >
        <TasksSidebar
          tasks={tasks}
          userId={currentUser.id}
          userSkills={currentUser.skills}
          selfLocation={selfLocation}
          proximityKm={proximityKm}
          maxDistanceKm={maxDistanceKm}
          coinsModifier={coinsModifier}
          xpModifier={xpModifier}
          timeModifierMinutes={timeModifierMinutes}
          criticalityPercentage={criticalityPercentage}
          pauseMultiplier={pauseMultiplier}
          onTaskClick={handleTaskClick}
          onAction={handleTaskAction}
        />
      </BottomSheet>

      {/* Chat sheet */}
      <BottomSheet
        open={activeSheet === 'chat'}
        onClose={() => setActiveSheet(null)}
        title="Chat"
        height="full"
      >
        <Chat messages={chatMessages} onSend={sendChatMessage} />
      </BottomSheet>

      {/* Profile sheet */}
      <BottomSheet
        open={activeSheet === 'profile'}
        onClose={() => setActiveSheet(null)}
        title="Profile"
        height="full"
      >
        <UserInfoPanel user={currentUser} onLogout={onLogout} onlineFriendIds={onlineFriendIds} friendEvents={friendEvents} clearFriendEvents={clearFriendEvents} openAchievements={showAchievementsPanel} onAchievementsClosed={() => setShowAchievementsPanel(false)} />
      </BottomSheet>

      {/* Task detail sheet (tapping marker on map) */}
      <BottomSheet
        open={selectedTask !== null}
        onClose={() => setSelectedTask(null)}
        height="auto"
      >
        {selectedTask && (
          <TaskDetailContent
            task={selectedTask}
            currentUserId={currentUser.id}
            currentUserSkills={currentUser.skills}
            selfLocation={selfLocation}
            proximityKm={proximityKm}
            coinsModifier={coinsModifier}
            xpModifier={xpModifier}
            timeModifierMinutes={timeModifierMinutes}
            criticalityPercentage={criticalityPercentage}
            pauseMultiplier={pauseMultiplier}
            onAction={async (action, taskId) => {
              await handleTaskAction(action, taskId)
              setSelectedTask(null)
            }}
            onClose={() => setSelectedTask(null)}
          />
        )}
      </BottomSheet>

      {/* Rating modal */}
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
    </div>
  )
}

// ── Task detail sheet content ───────────────────────────────────────────────

interface TaskDetailProps {
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
  onClose: () => void
}

function TaskDetailContent({
  task, currentUserId, currentUserSkills, selfLocation, proximityKm,
  coinsModifier, xpModifier, timeModifierMinutes, criticalityPercentage,
  pauseMultiplier, onAction,
}: TaskDetailProps) {
  const [, setTick] = useState(0)
  useEffect(() => {
    const i = setInterval(() => setTick((t) => t + 1), 1000)
    return () => clearInterval(i)
  }, [])

  const isAssignee = task.assignee === currentUserId
  const isOwner = task.owner === currentUserId
  const canStart = task.skill_execute_names.length === 0 || task.skill_execute_names.some((s) => currentUserSkills.includes(s))
  const canReview = !isAssignee && (isOwner || ((task.skill_write_names?.length ?? 0) > 0 && (task.skill_write_names ?? []).some((s) => currentUserSkills.includes(s))))

  const distanceKm = (selfLocation && task.lat != null && task.lon != null)
    ? haversineKm(selfLocation.lat, selfLocation.lon, task.lat, task.lon) : null
  const inProximity = distanceKm === null || distanceKm <= proximityKm
  const tm = (task.minutes && timeModifierMinutes > 0) ? task.minutes / timeModifierMinutes : 1.0
  const cf = 1.0 + ((task.criticality ?? 1) - 1) * criticalityPercentage

  const STATE_COLORS: Record<number, string> = {
    0: '#555', 1: '#4285F4', 2: '#FBBC05', 3: '#9b59b6', 4: '#e67e22', 5: '#34A853',
  }

  // Accent bar color — matches map pin logic
  let accentColor = '#555'
  if (task.is_tutorial) {
    accentColor = '#4285F4'
  } else if (task.state === 1) {
    const hasSkill = task.skill_execute_names.length === 0 || task.skill_execute_names.some((s) => currentUserSkills.includes(s))
    if (!hasSkill) accentColor = '#777'
    else accentColor = inProximity ? '#FBBC05' : '#b8860b'
  } else if (task.state != null) {
    accentColor = STATE_COLORS[task.state] ?? '#555'
  }

  return (
    <div>
      {/* Hero accent bar */}
      <div style={{ height: '4px', background: accentColor, opacity: 0.7 }} />

      <div style={{ padding: '16px 16px 20px' }}>
        {/* Title + meta */}
        <div style={{ marginBottom: '14px' }}>
          {task.is_tutorial && (
            <div style={{ fontSize: '0.62rem', color: '#4285F4', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '5px' }}>Tutorial Task</div>
          )}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px', marginBottom: '6px' }}>
            <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: 'var(--pip-text)', flex: 1 }}>{task.name}</div>
            {distanceKm !== null && (
              <span className={`distance-badge ${inProximity ? 'distance-badge-in-range' : 'distance-badge-out-range'}`}>
                {inProximity ? '✓' : '✗'} {formatDistance(distanceKm)}
              </span>
            )}
          </div>
          {task.description && (
            <div style={{ fontSize: '0.85rem', color: 'rgba(51,214,136,0.75)', lineHeight: 1.5, marginBottom: '10px' }}>{task.description}</div>
          )}
          {task.photo && (
            <img src={task.photo} alt="Task" style={{ width: '100%', maxHeight: '180px', objectFit: 'cover', marginBottom: '10px', borderRadius: '6px', border: '1px solid var(--glass-border)' }} />
          )}
        </div>

        {/* Info rows — desktop style */}
        <div style={{ fontSize: '0.78rem', marginBottom: '14px' }}>
          {!task.is_tutorial && task.state != null && (
            <div style={{ marginBottom: '4px' }}>
              <span style={{ color: 'var(--pip-green-dark)' }}>Status: </span>
              <span>{STATE_LABELS[task.state] ?? 'Unknown'}</span>
            </div>
          )}
          {task.is_tutorial && task.reward_skill_name && (
            <div style={{ marginBottom: '4px' }}>
              <span style={{ color: 'var(--pip-green-dark)' }}>Reward: </span>
              <span style={{ color: '#34A853' }}>{task.reward_skill_name}</span>
            </div>
          )}
          {task.state === 3 && task.datetime_paused && task.minutes != null && (
            <div style={{ marginBottom: '4px' }}>
              <span style={{ color: 'var(--pip-green-dark)' }}>Resets in: </span>
              <span style={{ color: '#e67e22' }}>{formatCountdown(new Date(new Date(task.datetime_paused).getTime() + task.minutes * pauseMultiplier * 60000).toISOString())}</span>
            </div>
          )}
          {!task.is_tutorial && task.respawn && (
            <div style={{ marginBottom: '4px' }}>
              <span style={{ color: 'var(--pip-green-dark)' }}>Respawn: </span>
              <span>{task.respawn_offset ? formatMinutes(task.respawn_offset) : task.respawn_time ?? 'Yes'}</span>
            </div>
          )}
          {task.assignee_name && (
            <div style={{ marginBottom: '4px' }}>
              <span style={{ color: 'var(--pip-green-dark)' }}>Assigned to: </span>
              <span>{task.assignee_name}</span>
            </div>
          )}
          {distanceKm !== null && (
            <div style={{ marginBottom: '4px' }}>
              <span style={{ color: 'var(--pip-green-dark)' }}>Distance: </span>
              <span style={{ color: inProximity ? 'var(--pip-text)' : '#EA4335' }}>{formatDistance(distanceKm)}</span>
              {!inProximity && <span style={{ color: '#EA4335' }}> (out of range)</span>}
            </div>
          )}
          {task.minutes != null && (
            <div style={{ marginBottom: '4px' }}>
              <span style={{ color: 'var(--pip-green-dark)' }}>Est. time: </span>
              <span>{formatMinutes(task.minutes)}</span>
            </div>
          )}
          {(task.coins != null || task.xp != null) && (
            <div style={{ marginBottom: '4px', display: 'flex', gap: '10px' }}>
              {task.coins != null && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#FBBC05' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#FBBC05', display: 'inline-block', flexShrink: 0 }} />
                  {Math.round(task.coins * coinsModifier * tm)}
                </span>
              )}
              {task.xp != null && (() => {
                const base = Math.round(task.xp! * xpModifier * tm)
                const extra = Math.round(task.xp! * xpModifier * tm * cf) - base
                return (
                  <span>
                    <span style={{ color: 'var(--pip-green-dark)' }}>XP: </span>
                    <span style={{ color: '#4285F4' }}>{base}{extra > 0 && <span style={{ color: '#89b4f8' }}>+{extra}</span>}</span>
                  </span>
                )
              })()}
            </div>
          )}
        </div>

      {/* Skills */}
      {task.skill_execute_names.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginBottom: '14px' }}>
          {task.skill_execute_names.map((s) => {
            const has = currentUserSkills.includes(s)
            return <span key={s} className={`skill-tag ${has ? 'skill-tag-has' : 'skill-tag-missing'}`}>{s}</span>
          })}
        </div>
      )}

      {/* Action buttons */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {task.is_tutorial && !task.in_progress && (
          <button
            className="pip-btn pip-btn-primary"
            onClick={() => onAction('start', task.id)}
            style={{ width: '100%' }}
          >
            Start Tutorial
          </button>
        )}

        {!task.is_tutorial && task.state === 1 && !isAssignee && canStart && inProximity && (
          <button
            className="pip-btn pip-btn-primary"
            onClick={() => onAction('start', task.id)}
            style={{ width: '100%' }}
          >
            Start Task
          </button>
        )}

        {!task.is_tutorial && task.state === 1 && !isAssignee && !canStart && (
          <div style={{ padding: '10px', background: 'rgba(234,67,53,0.08)', border: '1px solid rgba(234,67,53,0.3)', fontSize: '0.8rem', color: '#EA4335', textAlign: 'center' }}>
            Missing required skill
          </div>
        )}

        {!task.is_tutorial && task.state === 1 && !isAssignee && canStart && !inProximity && (
          <div style={{ padding: '10px', background: 'rgba(184,134,11,0.08)', border: '1px solid rgba(184,134,11,0.3)', fontSize: '0.8rem', color: '#b8860b', textAlign: 'center' }}>
            Out of range
          </div>
        )}

        {!task.is_tutorial && task.state === 4 && canReview && task.pending_review && (
          <div style={{ display: 'flex', gap: '10px' }}>
            <button className="pip-btn" style={{ flex: 1, borderColor: '#EA4335', color: '#EA4335' }} onClick={() => onAction('decline_review', task.id)}>
              Decline
            </button>
            <button className="pip-btn pip-btn-primary" style={{ flex: 2 }} onClick={() => onAction('accept_review', task.id)}>
              Accept Review
            </button>
          </div>
        )}

        {!task.is_tutorial && task.state === 5 && task.datetime_respawn && (
          <div style={{ padding: '10px', background: 'rgba(155,89,182,0.08)', border: '1px solid rgba(155,89,182,0.3)', fontSize: '0.8rem', color: '#9b59b6', textAlign: 'center' }}>
            Respawns in ↺ {formatCountdown(task.datetime_respawn)}
          </div>
        )}

        {!task.is_tutorial && isOwner && (task.state === 5 || task.state === 4 || task.state === 2 || task.state === 3) && (
          <button
            className="pip-btn"
            style={{ width: '100%', borderColor: '#9b59b6', color: '#9b59b6' }}
            onClick={() => onAction('reset', task.id)}
          >
            Reset Task
          </button>
        )}
      </div>

      </div>
    </div>
  )
}
