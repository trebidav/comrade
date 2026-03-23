import { useEffect, useRef, useState, useCallback } from 'react'

export interface ChatMessage {
  id: number
  text: string
}

interface Props {
  token: string | null
  room?: string
}

export function useChatSocket({ token, room = 'general' }: Props) {
  const socketRef = useRef<WebSocket | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [connected, setConnected] = useState(false)
  const idRef = useRef(0)

  useEffect(() => {
    if (!token) return

    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws'
    const ws = new WebSocket(`${protocol}://${window.location.host}/ws/chat/${room}/?token=${token}`)
    socketRef.current = ws

    ws.onopen = () => setConnected(true)

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.message) {
          setMessages((prev) => [...prev, { id: ++idRef.current, text: data.message }])
        }
      } catch {
        // ignore
      }
    }

    ws.onclose = () => setConnected(false)

    return () => ws.close()
  }, [token, room])

  const sendMessage = useCallback((text: string) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ message: text }))
    }
  }, [])

  return { messages, connected, sendMessage }
}
