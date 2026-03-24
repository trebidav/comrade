// Legend removed for mobile layout
export default function Legend() {
  return null
}

/* eslint-disable */
// @ts-ignore
function LegendFull() {
  const circles = [
    { color: '#4285F4', label: 'Your Location' },
    { color: '#34A853', label: 'Friends' },
    { color: '#FBBC05', label: 'Public' },
  ]

  const taskItems = [
    { type: 'dot', color: '#34A853', label: 'Task — open & available' },
    { type: 'dot', color: '#EA4335', label: 'Task — missing skill' },
    { type: 'dot', color: '#888', label: 'Task — out of reach', opacity: 0.7 },
    { type: 'dot', color: '#FBBC05', label: 'Task — tutorial' },
    { type: 'spinner', label: 'Task — your active' },
    { type: 'stopwatch', label: 'Task — your paused' },
  ]

  return (
    <div
      className="pip-panel"
      style={{ padding: '10px 14px', minWidth: '180px' }}
    >
      <div style={{ fontSize: '0.65rem', letterSpacing: '0.1em', color: 'var(--pip-green)', marginBottom: '8px', textTransform: 'uppercase', borderBottom: '1px solid var(--pip-border)', paddingBottom: '4px' }}>
        Legend
      </div>

      {circles.map(({ color, label }) => (
        <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '5px' }}>
          <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: color, border: '2px solid white', flexShrink: 0 }} />
          <span style={{ fontSize: '0.7rem', color: 'var(--pip-text)' }}>{label}</span>
        </div>
      ))}

      <div style={{ borderTop: '1px solid var(--pip-border)', margin: '6px 0' }} />

      {taskItems.map(({ type, color, label, opacity }) => (
        <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '5px' }}>
          {type === 'dot' && (
            <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: color, border: '2px solid white', flexShrink: 0, opacity: opacity ?? 1 }} />
          )}
          {type === 'spinner' && (
            <div style={{ width: '14px', height: '14px', borderRadius: '50%', border: '2.5px solid rgba(251,188,5,0.25)', borderTop: '2.5px solid #FBBC05', flexShrink: 0, animation: 'task-spin 1s linear infinite' }} />
          )}
          {type === 'stopwatch' && (
            <span style={{ fontSize: '12px', lineHeight: 1, flexShrink: 0 }}>⏱</span>
          )}
          <span style={{ fontSize: '0.7rem', color: 'var(--pip-text)' }}>{label}</span>
        </div>
      ))}
    </div>
  )
}
