import { useEffect, useRef, useState, useCallback } from 'react'
import api from '../api'

export interface FriendLocation {
  userId: number
  name: string
  lat: number
  lon: number
  accuracy: number
  friends: Array<{ id: number; name: string }>
  skills: string[]
  profilePicture: string
}

export interface PublicLocation {
  userId: number
  name: string
  lat: number
  lon: number
  accuracy: number
  profilePicture: string
}

export interface SelfLocation {
  lat: number
  lon: number
  accuracy: number
}

export interface ChatMessage {
  id: number
  text: string
  sender: string
  isSelf: boolean
}

// ── New real-time event interfaces ──

export interface TaskUpdateEvent {
  task_id: number
  state: number
  assignee: number | null
  assignee_name: string | null
  owner: number | null
  datetime_start: string | null
  datetime_finish: string | null
  datetime_paused: string | null
  action: string
}

export interface UserStatsEvent {
  coins: number
  xp: number
  total_coins_earned: number
  total_xp_earned: number
  task_streak: number
  level: number
  level_progress: { level: number; current_xp: number; required_xp: number }
  skills: string[]
}

export interface WsAchievement {
  id: number
  name: string
  icon: string
  description: string
}

export type FriendEvent =
  | { type: 'friend_request_received'; from_user: { id: number; username: string } }
  | { type: 'friend_request_accepted'; user: { id: number; username: string } }
  | { type: 'friend_request_rejected'; user_id: number }
  | { type: 'friend_removed'; user_id: number }

interface Props {
  token: string | null
  username: string
  userId: number
}

export function useLocationSocket({ token, username, userId }: Props) {
  const socketRef = useRef<WebSocket | null>(null)
  const locationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const heartbeatIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const msgIdRef = useRef(0)

  const [friends, setFriends] = useState<Map<number, FriendLocation>>(new Map())
  const [publicUsers, setPublicUsers] = useState<Map<number, PublicLocation>>(new Map())
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [selfLocation, setSelfLocation] = useState<SelfLocation | null>(null)
  const chatHistoryLoaded = useRef(false)

  // Load chat history on first mount
  useEffect(() => {
    if (chatHistoryLoaded.current || !token) return
    chatHistoryLoaded.current = true
    api.get('/chat/history/').then((res) => {
      const msgs: ChatMessage[] = (res.data.messages ?? []).map((m: { id: number; text: string; sender: string }) => ({
        id: m.id,
        text: m.text,
        sender: m.sender,
        isSelf: m.sender === username,
      }))
      setChatMessages(msgs)
    }).catch(() => {})
  }, [token, username])

  // New real-time state
  const [taskUpdates, setTaskUpdates] = useState<TaskUpdateEvent[]>([])
  const [userStats, setUserStats] = useState<UserStatsEvent | null>(null)
  const [wsAchievements, setWsAchievements] = useState<WsAchievement[]>([])
  const [friendEvents, setFriendEvents] = useState<FriendEvent[]>([])
  const [onlineFriendIds, setOnlineFriendIds] = useState<Set<number>>(new Set())

  const sendLocation = useCallback(
    (lat: number, lon: number, accuracy: number) => {
      if (socketRef.current?.readyState === WebSocket.OPEN) {
        socketRef.current.send(
          JSON.stringify({
            type: 'location_update',
            latitude: lat,
            longitude: lon,
            accuracy,
            userId,
            name: username,
          })
        )
      }
    },
    [userId, username]
  )

  const sendChatMessage = useCallback(
    (message: string) => {
      if (socketRef.current?.readyState === WebSocket.OPEN) {
        socketRef.current.send(
          JSON.stringify({
            type: 'chat_message',
            message,
            sender: username,
          })
        )
        // Use negative temp ID — will be replaced by server msg_id
        setChatMessages((prev) => [
          ...prev,
          { id: -(++msgIdRef.current), text: message, sender: username, isSelf: true },
        ])
      }
    },
    [username]
  )

  // Consume task updates (called by MapView after processing)
  const clearTaskUpdates = useCallback(() => setTaskUpdates([]), [])
  const clearUserStats = useCallback(() => setUserStats(null), [])
  const clearWsAchievements = useCallback(() => setWsAchievements([]), [])
  const clearFriendEvents = useCallback(() => setFriendEvents([]), [])

  useEffect(() => {
    if (!token) return

    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws'
    const ws = new WebSocket(`${protocol}://${window.location.host}/ws/location/?token=${token}`)
    socketRef.current = ws

    ws.onopen = () => {
      // Send heartbeat every 5s
      heartbeatIntervalRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'heartbeat' }))
        }
      }, 5000)

      // Send location every 5s
      if (navigator.geolocation) {
        const sendGeo = () => {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              const { latitude, longitude, accuracy } = pos.coords
              setSelfLocation({ lat: latitude, lon: longitude, accuracy })
              sendLocation(latitude, longitude, accuracy)
            },
            (err) => console.warn('Geolocation error:', err),
            { enableHighAccuracy: true, maximumAge: 0, timeout: 5000 }
          )
        }
        sendGeo()
        locationIntervalRef.current = setInterval(sendGeo, 5000)
      }
    }

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)

        switch (data.type) {
          case 'location_update':
            if (data.latitude && data.longitude) {
              setSelfLocation({
                lat: data.latitude,
                lon: data.longitude,
                accuracy: data.accuracy ?? 0,
              })
            }
            break

          case 'friend_location': {
            const uid = data.userId
            if (uid == null) break
            setFriends((prev) => {
              const next = new Map(prev)
              next.set(uid, {
                userId: uid,
                name: data.name ?? 'Friend',
                lat: data.latitude,
                lon: data.longitude,
                accuracy: data.accuracy ?? 0,
                friends: data.friends ?? [],
                skills: data.skills ?? [],
                profilePicture: data.profile_picture ?? '',
              })
              return next
            })
            // Friend sending location = they're online
            setOnlineFriendIds((prev) => {
              const next = new Set(prev)
              next.add(uid)
              return next
            })
            break
          }

          case 'public_location': {
            const uid = data.userId
            if (uid == null || uid === userId) break
            setPublicUsers((prev) => {
              const next = new Map(prev)
              next.set(uid, {
                userId: uid,
                name: data.name ?? 'User',
                lat: data.latitude,
                lon: data.longitude,
                accuracy: data.accuracy ?? 0,
                profilePicture: data.profile_picture ?? '',
              })
              return next
            })
            break
          }

          case 'user_offline': {
            const uid = data.userId
            if (uid == null) break
            setFriends((prev) => {
              const next = new Map(prev)
              next.delete(uid)
              return next
            })
            setPublicUsers((prev) => {
              const next = new Map(prev)
              next.delete(uid)
              return next
            })
            setOnlineFriendIds((prev) => {
              const next = new Set(prev)
              next.delete(uid)
              return next
            })
            break
          }

          case 'friend_online': {
            const uid = data.userId
            if (uid != null) {
              setOnlineFriendIds((prev) => {
                const next = new Set(prev)
                next.add(uid)
                return next
              })
            }
            break
          }

          case 'heartbeat_response':
            break

          case 'chat_message': {
            const sender = data.sender ?? 'Unknown'
            const id = data.msg_id ?? ++msgIdRef.current
            if (sender !== username) {
              setChatMessages((prev) => [
                ...prev,
                { id, text: data.message, sender, isSelf: false },
              ])
            } else if (data.msg_id) {
              // Replace the optimistic message with the server-confirmed one
              setChatMessages((prev) => {
                const last = prev[prev.length - 1]
                if (last?.isSelf && last.text === data.message && last.id < 0) {
                  return [...prev.slice(0, -1), { ...last, id: data.msg_id }]
                }
                return prev
              })
            }
            break
          }

          // ── New real-time events ──

          case 'task_update':
            setTaskUpdates((prev) => [...prev, data as TaskUpdateEvent])
            break

          case 'user_stats_update':
            setUserStats(data as UserStatsEvent)
            break

          case 'achievement_earned':
            if (data.achievements?.length) {
              setWsAchievements((prev) => [...prev, ...data.achievements])
            }
            break

          case 'friend_request_received':
          case 'friend_request_accepted':
          case 'friend_request_rejected':
          case 'friend_removed':
            setFriendEvents((prev) => [...prev, data as FriendEvent])
            break

          case 'friend_details':
            // Handle the existing friend_details event (sent on friend accept)
            if (data.userId != null) {
              setFriendEvents((prev) => [...prev, {
                type: 'friend_request_accepted' as const,
                user: { id: data.userId, username: data.name ?? '' },
              }])
            }
            break

          default:
            break
        }
      } catch {
        // ignore malformed messages
      }
    }

    ws.onclose = () => {
      if (locationIntervalRef.current) clearInterval(locationIntervalRef.current)
      if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current)
    }

    return () => {
      if (locationIntervalRef.current) clearInterval(locationIntervalRef.current)
      if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current)
      ws.close()
    }
  }, [token, sendLocation, username, userId])

  return {
    friends, publicUsers, chatMessages, selfLocation, sendChatMessage,
    // New real-time data
    taskUpdates, clearTaskUpdates,
    userStats, clearUserStats,
    wsAchievements, clearWsAchievements,
    friendEvents, clearFriendEvents,
    onlineFriendIds,
  }
}
