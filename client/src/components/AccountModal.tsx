import { useState, useEffect } from 'react'
import api, { type User } from '../api'
import { type Theme, getTheme, applyTheme, type LayoutMode, getLayoutMode, applyLayoutMode } from '../theme'
import BottomSheet from './BottomSheet'

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
  open: boolean
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
    if (!open) return
    setLoading(true)
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
  }, [open])

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

  return (
    <BottomSheet open={open} onClose={onClose} title="Account Settings" height="full">
      <div style={{ padding: '16px' }}>
        {error && <div style={{ color: '#EA4335', fontSize: '0.8rem', marginBottom: '12px', padding: '8px', border: '1px solid rgba(234,67,53,0.4)', background: 'rgba(234,67,53,0.08)' }}>{error}</div>}

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', paddingTop: '8px' }}>
            {[...Array(3)].map((_, i) => (
              <div key={i} className="skeleton" style={{ height: i === 0 ? '90px' : '60px', borderRadius: '8px' }} />
            ))}
          </div>
        ) : (
          <>
            {/* Stats */}
            {userData && (
              <div style={{ marginBottom: '24px' }}>
                <div className="section-label">Stats</div>
                <div style={{ display: 'flex', gap: '24px' }}>
                  <div>
                    <div style={{ fontSize: '0.6rem', color: 'var(--pip-green-dark)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '3px' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#FBBC05', display: 'inline-block' }} />
                        Coins
                      </span>
                    </div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>{Math.round(userData.coins)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.6rem', color: 'var(--pip-green-dark)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '3px' }}>XP</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>{Math.round(userData.xp)}</div>
                  </div>
                </div>
              </div>
            )}

            {/* Layout */}
            <div style={{ marginBottom: '24px' }}>
              <div className="section-label">Layout</div>
              <div style={{ display: 'flex', gap: '12px' }}>
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
                        flex: 1,
                        padding: '14px 10px',
                        background: active ? 'rgba(46,194,126,0.08)' : 'transparent',
                        border: `2px solid ${active ? 'var(--pip-green)' : 'var(--pip-border)'}`,
                        cursor: 'pointer',
                        boxShadow: active ? 'var(--pip-glow)' : 'none',
                        borderRadius: '4px',
                        touchAction: 'manipulation',
                        minHeight: '70px',
                        fontFamily: 'var(--pip-font)',
                      }}
                    >
                      <div style={{ fontSize: '0.75rem', color: active ? 'var(--pip-green)' : 'var(--pip-text)', fontWeight: active ? 'bold' : 'normal' }}>
                        {l.label}
                      </div>
                      <div style={{ fontSize: '0.6rem', color: 'var(--pip-green-dark)', marginTop: '2px' }}>
                        {l.sub}
                      </div>
                      {active && <div style={{ fontSize: '0.55rem', color: 'var(--pip-green)', marginTop: '4px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>✓ Active</div>}
                    </button>
                  )
                })}
              </div>
              <div style={{ fontSize: '0.65rem', color: 'var(--pip-green-dark)', marginTop: '8px' }}>
                Switch takes effect immediately.
              </div>
            </div>

            {/* Theme */}
            <div style={{ marginBottom: '24px' }}>
              <div className="section-label">Theme</div>
              <div style={{ display: 'flex', gap: '12px' }}>
                {([
                  { id: 'pipboy' as Theme, label: 'Pip-Boy', sub: 'Terminal Green', bg: '#0a0f0d', border: '#1a7346', text: '#33d688', accent: '#2ec27e' },
                  { id: 'desert' as Theme, label: 'Desert', sub: 'Egyptian Gold', bg: '#1c1408', border: '#8b6914', text: '#e8c87a', accent: '#d4a843' },
                ] as const).map((t) => {
                  const active = currentTheme === t.id
                  return (
                    <button
                      key={t.id}
                      onClick={() => { applyTheme(t.id); setCurrentTheme(t.id) }}
                      style={{
                        flex: 1,
                        padding: '14px 10px',
                        background: t.bg,
                        border: `2px solid ${active ? t.accent : t.border}`,
                        cursor: 'pointer',
                        boxShadow: active ? `0 0 10px ${t.accent}66` : 'none',
                        borderRadius: '4px',
                        touchAction: 'manipulation',
                        minHeight: '80px',
                      }}
                    >
                      <div style={{ display: 'flex', gap: '4px', marginBottom: '8px', justifyContent: 'center' }}>
                        {[t.accent, t.text, t.border].map((c) => (
                          <div key={c} style={{ width: '12px', height: '12px', borderRadius: '50%', background: c }} />
                        ))}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: t.text, fontWeight: active ? 'bold' : 'normal', fontFamily: t.id === 'desert' ? 'Cinzel, Palatino, serif' : 'monospace' }}>
                        {t.label}
                      </div>
                      <div style={{ fontSize: '0.6rem', color: t.border, marginTop: '2px', fontFamily: t.id === 'desert' ? 'Cinzel, Palatino, serif' : 'monospace' }}>
                        {t.sub}
                      </div>
                      {active && <div style={{ fontSize: '0.55rem', color: t.accent, marginTop: '4px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>✓ Active</div>}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Location Sharing */}
            <div style={{ marginBottom: '24px' }}>
              <div className="section-label">Location Sharing</div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid rgba(26,115,70,0.3)' }}>
                <div>
                  <div style={{ fontSize: '0.85rem' }}>Enable Location Sharing</div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--pip-green-dark)', marginTop: '2px' }}>
                    {sharingEnabled ? 'Currently sharing' : 'Not sharing'}
                  </div>
                </div>
                <label className="pip-toggle">
                  <input type="checkbox" checked={sharingEnabled} onChange={() => updatePrefs(sharingEnabled ? 'none' : 'friends')} disabled={saving} />
                  <span className="pip-toggle-slider" />
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', opacity: sharingEnabled ? 1 : 0.4 }}>
                <div>
                  <div style={{ fontSize: '0.85rem' }}>Share with Everyone</div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--pip-green-dark)', marginTop: '2px' }}>
                    {shareWithAll ? 'Visible to all users' : 'Friends only'}
                  </div>
                </div>
                <label className="pip-toggle">
                  <input type="checkbox" checked={shareWithAll} onChange={() => updatePrefs(shareWithAll ? 'friends' : 'all')} disabled={saving || !sharingEnabled} />
                  <span className="pip-toggle-slider" />
                </label>
              </div>
            </div>

            {/* Global Config — superuser only */}
            {userData?.is_superuser && globalConfig && (
              <div style={{ marginBottom: '24px' }}>
                <div className="section-label">Global Configuration</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '14px' }}>
                  {(Object.keys(GLOBAL_CONFIG_LABELS) as (keyof GlobalConfig)[]).map((field) => (
                    <div key={field} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                      <label style={{ fontSize: '0.75rem', color: 'var(--pip-green-dark)', flex: 1 }}>
                        {GLOBAL_CONFIG_LABELS[field]}
                      </label>
                      <input
                        type="number"
                        step="any"
                        value={configDraft[field] ?? ''}
                        onChange={(e) => setConfigDraft((d) => ({ ...d, [field]: e.target.value }))}
                        style={{
                          width: '100px',
                          background: 'rgba(46,194,126,0.05)',
                          border: '1px solid var(--pip-border)',
                          color: 'var(--pip-text)',
                          fontFamily: 'var(--pip-font)',
                          padding: '6px 8px',
                          outline: 'none',
                          textAlign: 'right',
                        }}
                      />
                    </div>
                  ))}
                </div>
                {configError && <div style={{ color: '#EA4335', fontSize: '0.75rem', marginBottom: '8px' }}>{configError}</div>}
                <button
                  className="pip-btn"
                  onClick={handleConfigSave}
                  disabled={savingConfig}
                  style={{ width: '100%', color: configSaved ? '#34A853' : undefined }}
                >
                  {configSaved ? '✓ Saved!' : savingConfig ? 'Saving...' : 'Save Configuration'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </BottomSheet>
  )
}
