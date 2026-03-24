import { useState, useEffect } from 'react'
import api from '../api'

interface Props {
  onLogin: () => void
}

function generateNonce(length = 10) {
  return Array.from({ length }, () =>
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'.charAt(
      Math.floor(Math.random() * 64)
    )
  ).join('')
}

export default function Login({ onLogin }: Props) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleClientId, setGoogleClientId] = useState<string | null>(null)

  useEffect(() => {
    api.get('/auth/google-config/').then((res) => {
      if (res.data.client_id) setGoogleClientId(res.data.client_id)
    }).catch(() => {})
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await api.post('/user/token/', { username, password })
      localStorage.setItem('token', res.data.token)
      onLogin()
    } catch {
      setError('Invalid credentials')
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleLogin = () => {
    if (!googleClientId) return
    const params = new URLSearchParams({
      client_id: googleClientId,
      redirect_uri: `${window.location.origin}/api/accounts/google/login/callback/`,
      response_type: 'code',
      scope: 'openid email profile',
      include_granted_scopes: 'true',
      state: generateNonce(),
      nonce: generateNonce(),
    })
    window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params}`
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100dvh',
      background: 'var(--pip-bg)',
      padding: '24px 20px',
      paddingTop: 'calc(env(safe-area-inset-top, 0px) + 40px)',
      paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 40px)',
    }}
    className="login-crt"
    >
      {/* Logo / header */}
      <div className="login-logo-enter" style={{ textAlign: 'center', marginBottom: '40px' }}>
        <div style={{
          fontSize: '2.2rem',
          fontWeight: 'bold',
          color: 'var(--pip-green)',
          fontFamily: 'var(--pip-font)',
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
          animation: 'glowPulse 3s ease-in-out infinite',
        }}>
          COMRADE
        </div>
        <div style={{
          fontSize: '0.7rem',
          color: 'var(--pip-green-dark)',
          letterSpacing: '0.15em',
          textTransform: 'uppercase',
          marginTop: '8px',
          animation: 'fadeInDown 0.5s ease-out 0.3s both',
        }}>
          Community Task Manager
        </div>
      </div>

      {/* Card */}
      <div
        className="pip-glass login-card-enter"
        style={{
          width: '100%',
          maxWidth: '360px',
          padding: '28px 24px',
          borderRadius: '16px',
        }}
      >
        {googleClientId && (
          <>
            <button
              onClick={handleGoogleLogin}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '12px',
                border: '1px solid var(--pip-border)',
                background: 'transparent',
                color: 'var(--pip-text)',
                fontFamily: 'var(--pip-font)',
                fontSize: '0.85rem',
                padding: '14px 20px',
                cursor: 'pointer',
                marginBottom: '20px',
                minHeight: '52px',
                letterSpacing: '0.05em',
                touchAction: 'manipulation',
                borderRadius: '8px',
                transition: 'transform 0.12s var(--spring), background 0.15s',
              }}
              onPointerDown={(e) => (e.currentTarget.style.transform = 'scale(0.97)')}
              onPointerUp={(e) => (e.currentTarget.style.transform = '')}
              onPointerLeave={(e) => (e.currentTarget.style.transform = '')}
            >
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Sign in with Google
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
              <div style={{ flex: 1, height: '1px', background: 'var(--glass-border)' }} />
              <span style={{ fontSize: '0.65rem', color: 'var(--pip-green-dark)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>or</span>
              <div style={{ flex: 1, height: '1px', background: 'var(--glass-border)' }} />
            </div>
          </>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label className="pip-label">Username</label>
            <input
              type="text"
              autoComplete="username"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="pip-input"
              required
            />
          </div>

          <div>
            <label className="pip-label">Password</label>
            <input
              type="password"
              autoComplete="current-password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pip-input"
              required
            />
          </div>

          {error && (
            <div style={{
              color: '#EA4335',
              fontSize: '0.8rem',
              textAlign: 'center',
              border: '1px solid rgba(234,67,53,0.4)',
              padding: '10px',
              background: 'rgba(234,67,53,0.08)',
              borderRadius: '6px',
              animation: 'fadeInDown 0.2s ease-out both',
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className={`pip-btn pip-btn-primary${loading ? ' pip-btn-loading' : ''}`}
            style={{ width: '100%', fontSize: '0.85rem', letterSpacing: '0.1em', minHeight: '52px', borderRadius: '8px' }}
          >
            {loading ? '' : 'Sign In'}
          </button>
        </form>

        <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--glass-border)', textAlign: 'center' }}>
          <div style={{ fontSize: '0.6rem', color: 'var(--pip-green-dark)', letterSpacing: '0.08em' }}>
            comrade-0.1.0-beta
          </div>
        </div>
      </div>
    </div>
  )
}
