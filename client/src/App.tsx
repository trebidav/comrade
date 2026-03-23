import { useState, useEffect } from 'react'
import Login from './components/Login'
import MapViewMobile from './components/MapViewMobile'
import MapViewDesktop from './components/MapViewDesktop'
import api, { type User } from './api'
import { useLayoutMode } from './hooks/useLayoutMode'
import { getLayoutMode } from './theme'
import './index.css'

// Apply layout mode on load so data-layout attr is set before first render
;(function () {
  document.documentElement.setAttribute('data-layout', getLayoutMode())
})()

export default function App() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const { mode } = useLayoutMode()

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
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100dvh',
          fontFamily: 'var(--pip-font)',
          color: 'var(--pip-text)',
          background: 'var(--pip-bg)',
          gap: '20px',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Logo */}
        <div style={{
          fontSize: '2rem',
          fontWeight: 'bold',
          color: 'var(--pip-green)',
          letterSpacing: '0.25em',
          textTransform: 'uppercase',
          animation: 'glowPulse 2s ease-in-out infinite',
        }}>
          COMRADE
        </div>

        {/* Animated dots */}
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <span style={{ fontSize: '0.65rem', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--pip-green-dark)', marginRight: '4px' }}>
            Initializing
          </span>
          {[0, 200, 400].map((delay) => (
            <span
              key={delay}
              style={{
                width: '5px',
                height: '5px',
                borderRadius: '50%',
                background: 'var(--pip-green)',
                display: 'inline-block',
                animation: `pip-blink 1.2s ease-in-out ${delay}ms infinite`,
              }}
            />
          ))}
        </div>

        {/* Progress bar */}
        <div style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: '2px',
          background: 'rgba(46,194,126,0.1)',
          overflow: 'hidden',
        }}>
          <div className="splash-load-bar" />
        </div>
      </div>
    )
  }

  if (!user) {
    return <Login onLogin={handleLogin} />
  }

  return mode === 'desktop'
    ? <MapViewDesktop user={user} onLogout={handleLogout} />
    : <MapViewMobile user={user} onLogout={handleLogout} />
}
