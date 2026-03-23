import { useState, useEffect } from 'react'
import Login from './components/Login'
import MapView from './components/MapView'
import api, { type User } from './api'
import './index.css'

export default function App() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchUser = async () => {
    try {
      const res = await api.get('/user/')
      setUser(res.data)
    } catch {
      localStorage.removeItem('token')
      setUser(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const googleToken = params.get('google_token')
    if (googleToken) {
      localStorage.setItem('token', googleToken)
      window.history.replaceState({}, '', '/')
      fetchUser()
      return
    }
    if (localStorage.getItem('token')) {
      fetchUser()
    } else {
      setLoading(false)
    }
  }, [])

  const handleLogin = () => fetchUser()

  const handleLogout = () => {
    localStorage.removeItem('token')
    setUser(null)
  }

  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          fontFamily: 'var(--pip-font)',
          color: 'var(--pip-text)',
          background: 'var(--pip-bg)',
          fontSize: '0.9rem',
          letterSpacing: '0.15em',
          textTransform: 'uppercase',
        }}
      >
        Initializing Pip-Boy...
      </div>
    )
  }

  if (!user) {
    return <Login onLogin={handleLogin} />
  }

  return <MapView user={user} onLogout={handleLogout} />
}
