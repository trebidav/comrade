import { useEffect, useRef, useState, useCallback } from 'react'

export interface FriendLocation {
  userId: number
  name: string
  lat: number
  lon: number
  accuracy: number
  friends: Array<{ id: number; name: string }>
  skills: string[]
}

export interface PublicLocation {
  userId: number
  name: string
  lat: number
  lon: number
  accuracy: number
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
        setChatMessages((prev) => [
          ...prev,
          { id: ++msgIdRef.current, text: message, sender: username, isSelf: true },
        ])
      }
    },
    [username]
  )

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
            // Own location echo — update self location if provided
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
              })
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
            break
          }

          case 'heartbeat_response':
            // ignore
            break

          case 'chat_message': {
            const sender = data.sender ?? 'Unknown'
            if (sender !== username) {
              setChatMessages((prev) => [
                ...prev,
                { id: ++msgIdRef.current, text: data.message, sender, isSelf: false },
              ])
            }
            break
          }

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

  return { friends, publicUsers, chatMessages, selfLocation, sendChatMessage }
}
