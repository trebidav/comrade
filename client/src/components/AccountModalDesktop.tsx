import { useState, useEffect } from 'react'
import api, { type User } from '../api'
import { type Theme, getTheme, applyTheme, type LayoutMode, getLayoutMode, applyLayoutMode } from '../theme'

interface LocationPreferences {
  sharing_level: 'none' | 'friends' | 'all'
}

interface GlobalConfig {
  max_distance_km: number
  task_proximity_km: number
  coins_modifier: number
  xp_modifier: number
  time_modifier_minutes: number
  criticality_percentage: number
  pause_multiplier: number
  level_modifier: number
}

const GLOBAL_CONFIG_LABELS: Record<keyof GlobalConfig, string> = {
  max_distance_km: 'Max Distance (km)',
  task_proximity_km: 'Task Proximity (km)',
  coins_modifier: 'Coins Modifier',
  xp_modifier: 'XP Modifier',
  time_modifier_minutes: 'Time Modifier (min)',
  criticality_percentage: 'Criticality %',
  pause_multiplier: 'Pause Multiplier',
  level_modifier: 'Level Modifier',
}

interface Props {
  open?: boolean
  onClose: () => void
}

export default function AccountModal({ open, onClose }: Props) {
  const [currentTheme, setCurrentTheme] = useState<Theme>(getTheme)
  const [currentLayout, setCurrentLayout] = useState<LayoutMode>(getLayoutMode)
  const [prefs, setPrefs] = useState<LocationPreferences | null>(null)
  const [userData, setUserData] = useState<User | null>(null)
  const [globalConfig, setGlobalConfig] = useState<GlobalConfig | null>(null)
  const [configDraft, setConfigDraft] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savingConfig, setSavingConfig] = useState(false)
  const [error, setError] = useState('')
  const [configError, setConfigError] = useState('')
  const [configSaved, setConfigSaved] = useState(false)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [prefsRes, userRes] = await Promise.all([
          api.get('/location/preferences/'),
          api.get('/user/'),
        ])
        setPrefs(prefsRes.data)
        setUserData(userRes.data)
        if (userRes.data.is_superuser) {
          const configRes = await api.get('/settings/global/')
          setGlobalConfig(configRes.data)
          setConfigDraft(Object.fromEntries(
            Object.entries(configRes.data as GlobalConfig).map(([k, v]) => [k, String(v)])
          ))
        }
      } catch {
        setError('Failed to load preferences')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const sharingEnabled = prefs?.sharing_level !== 'none'
  const shareWithAll = prefs?.sharing_level === 'all'

  const updatePrefs = async (newLevel: 'none' | 'friends' | 'all') => {
    if (!prefs) return
    setSaving(true)
    setError('')
    try {
      await api.post('/location/preferences/', { sharing_level: newLevel })
      setPrefs({ sharing_level: newLevel })
    } catch {
      setError('Failed to save preferences')
    } finally {
      setSaving(false)
    }
  }

  const handleSharingToggle = () => {
    if (!prefs) return
    updatePrefs(sharingEnabled ? 'none' : 'friends')
  }

  const handleAllToggle = () => {
    if (!prefs || !sharingEnabled) return
    updatePrefs(shareWithAll ? 'friends' : 'all')
  }

  const handleConfigSave = async () => {
    setSavingConfig(true)
    setConfigError('')
    setConfigSaved(false)
    try {
      const res = await api.patch('/settings/global/', Object.fromEntries(
        Object.entries(configDraft).map(([k, v]) => [k, parseFloat(v)])
      ))
      setGlobalConfig(res.data)
      setConfigSaved(true)
      setTimeout(() => setConfigSaved(false), 2000)
    } catch {
      setConfigError('Failed to save config')
    } finally {
      setSavingConfig(false)
    }
  }

  const sectionLabel = (text: string) => (
    <div style={{
      fontSize: '0.65rem',
      letterSpacing: '0.1em',
      color: 'var(--pip-green)',
      marginBottom: '10px',
      textTransform: 'uppercase',
      borderBottom: '1px solid var(--pip-border)',
      paddingBottom: '4px',
    }}>
      {text}
    </div>
  )

  if (!open) return null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.7)',
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="pip-panel" style={{ width: '360px', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{
          padding: '12px 16px',
          borderBottom: '1px solid var(--pip-border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexShrink: 0,
        }}>
          <span style={{ fontSize: '0.75rem', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            Account Settings
          </span>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--pip-text)', cursor: 'pointer', fontSize: '1.2rem', lineHeight: 1 }}
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '16px', overflowY: 'auto', flex: 1 }}>
          {error && <div style={{ color: '#EA4335', fontSize: '0.75rem', marginBottom: '10px' }}>{error}</div>}

          {loading ? (
            <div style={{ fontSize: '0.75rem', color: 'var(--pip-green-dark)' }}>Loading...</div>
          ) : (
            <>
              {sectionLabel('Layout')}
              <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
                {([
                  { id: 'mobile' as LayoutMode, label: 'Mobile', sub: 'Touch-optimised' },
                  { id: 'desktop' as LayoutMode, label: 'Desktop', sub: 'Sidebar layout' },
                ] as const).map((l) => {
                  const active = currentLayout === l.id
                  return (
                    <button
                      key={l.id}
                      onClick={() => { applyLayoutMode(l.id); setCurrentLayout(l.id) }}
                      style={{
                        flex: 1, padding: '10px 8px',
                        background: active ? 'rgba(46,194,126,0.08)' : 'transparent',
                        border: `2px solid ${active ? 'var(--pip-green)' : 'var(--pip-border)'}`,
                        color: active ? 'var(--pip-green)' : 'var(--pip-text)',
                        cursor: 'pointer', fontFamily: 'var(--pip-font)', fontSize: '0.75rem',
                        textTransform: 'uppercase', letterSpacing: '0.05em',
                      }}
                    >
                      {l.label}
                      <div style={{ fontSize: '0.6rem', marginTop: '2px', color: 'var(--pip-green-dark)', textTransform: 'none', letterSpacing: 0 }}>{l.sub}</div>
                      {active && <div style={{ fontSize: '0.55rem', marginTop: '2px', color: 'var(--pip-green)' }}>✓ Active</div>}
                    </button>
                  )
                })}
              </div>

              {sectionLabel('Theme')}
              <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
                {([
                  {
                    id: 'pipboy' as Theme,
                    label: 'Pip-Boy',
                    sub: 'Terminal Green',
                    bg: '#0a0f0d',
                    border: '#1a7346',
                    text: '#33d688',
                    accent: '#2ec27e',
                  },
                  {
                    id: 'desert' as Theme,
                    label: 'Desert',
                    sub: 'Egyptian Gold',
                    bg: '#1c1408',
                    border: '#8b6914',
                    text: '#e8c87a',
                    accent: '#d4a843',
                  },
                ] as const).map((t) => {
                  const active = currentTheme === t.id
                  return (
                    <button
                      key={t.id}
                      onClick={() => { applyTheme(t.id); setCurrentTheme(t.id) }}
                      style={{
                        flex: 1,
                        padding: '10px 8px',
                        background: t.bg,
                        border: `2px solid ${active ? t.accent : t.border}`,
                        cursor: 'pointer',
                        boxShadow: active ? `0 0 8px ${t.accent}66` : 'none',
                        transition: 'border-color 0.15s, box-shadow 0.15s',
                      }}
                    >
                      {/* Mini preview swatches */}
                      <div style={{ display: 'flex', gap: '3px', marginBottom: '6px', justifyContent: 'center' }}>
                        {[t.accent, t.text, t.border].map((c) => (
                          <div key={c} style={{ width: '10px', height: '10px', borderRadius: '50%', background: c }} />
                        ))}
                      </div>
                      <div style={{ fontSize: '0.68rem', color: t.text, fontWeight: active ? 'bold' : 'normal', fontFamily: t.id === 'desert' ? 'Cinzel, Palatino, serif' : 'monospace', letterSpacing: '0.05em' }}>
                        {t.label}
                      </div>
                      <div style={{ fontSize: '0.55rem', color: t.border, marginTop: '2px', fontFamily: t.id === 'desert' ? 'Cinzel, Palatino, serif' : 'monospace' }}>
                        {t.sub}
                      </div>
                      {active && (
                        <div style={{ fontSize: '0.55rem', color: t.accent, marginTop: '3px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                          ✓ Active
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>

              {sectionLabel('Location Sharing')}

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <label style={{ fontSize: '0.8rem', cursor: 'pointer' }}>Enable Location Sharing</label>
                <button
                  onClick={handleSharingToggle}
                  disabled={saving}
                  style={{
                    background: sharingEnabled ? 'var(--pip-green-dark)' : 'transparent',
                    border: '1px solid var(--pip-border)',
                    color: 'var(--pip-text)',
                    fontFamily: 'var(--pip-font)',
                    fontSize: '0.7rem',
                    padding: '3px 10px',
                    cursor: 'pointer',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    opacity: saving ? 0.6 : 1,
                  }}
                >
                  {sharingEnabled ? 'ON' : 'OFF'}
                </button>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', opacity: sharingEnabled ? 1 : 0.4 }}>
                <label style={{ fontSize: '0.8rem', cursor: sharingEnabled ? 'pointer' : 'default' }}>Share with Everyone</label>
                <button
                  onClick={handleAllToggle}
                  disabled={saving || !sharingEnabled}
                  style={{
                    background: shareWithAll ? 'var(--pip-green-dark)' : 'transparent',
                    border: '1px solid var(--pip-border)',
                    color: 'var(--pip-text)',
                    fontFamily: 'var(--pip-font)',
                    fontSize: '0.7rem',
                    padding: '3px 10px',
                    cursor: sharingEnabled ? 'pointer' : 'default',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    opacity: saving ? 0.6 : 1,
                  }}
                >
                  {shareWithAll ? 'ON' : 'OFF'}
                </button>
              </div>

              <div style={{ fontSize: '0.65rem', color: 'var(--pip-green-dark)', marginTop: '8px', paddingTop: '8px', borderTop: '1px solid rgba(26,115,70,0.3)' }}>
                Current: {prefs?.sharing_level === 'none' ? 'Not sharing' : prefs?.sharing_level === 'friends' ? 'Friends only' : 'Everyone'}
              </div>

              {/* Global Config — superuser only */}
              {userData?.is_superuser && globalConfig && (
                <>
                  <div style={{ marginTop: '20px' }}>
                    {sectionLabel('Global Configuration')}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
                    {(Object.keys(GLOBAL_CONFIG_LABELS) as (keyof GlobalConfig)[]).map((field) => (
                      <div key={field} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                        <label style={{ fontSize: '0.7rem', color: 'var(--pip-green-dark)', flexShrink: 0 }}>
                          {GLOBAL_CONFIG_LABELS[field]}
                        </label>
                        <input
                          type="number"
                          step="any"
                          value={configDraft[field] ?? ''}
                          onChange={(e) => setConfigDraft((d) => ({ ...d, [field]: e.target.value }))}
                          style={{
                            width: '90px',
                            background: 'rgba(46,194,126,0.05)',
                            border: '1px solid var(--pip-border)',
                            color: 'var(--pip-text)',
                            fontFamily: 'var(--pip-font)',
                            fontSize: '0.75rem',
                            padding: '3px 6px',
                            outline: 'none',
                            textAlign: 'right',
                          }}
                        />
                      </div>
                    ))}
                  </div>
                  {configError && <div style={{ color: '#EA4335', fontSize: '0.7rem', marginBottom: '6px' }}>{configError}</div>}
                  <button
                    className="pip-btn"
                    onClick={handleConfigSave}
                    disabled={savingConfig}
                    style={{ width: '100%', color: configSaved ? '#34A853' : undefined }}
                  >
                    {configSaved ? 'Saved!' : savingConfig ? 'Saving...' : 'Save Configuration'}
                  </button>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
