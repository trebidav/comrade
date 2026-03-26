import { useState, useRef } from 'react'
import api from '../api'

interface Props {
  selfLocation: { lat: number; lon: number } | null
  onClose: () => void
}

export default function BugReportModal({ selfLocation, onClose }: Props) {
  const [description, setDescription] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || [])
    setFiles((prev) => [...prev, ...selected])
    setPreviews((prev) => [...prev, ...selected.map((f) => URL.createObjectURL(f))])
  }

  const removeFile = (idx: number) => {
    URL.revokeObjectURL(previews[idx])
    setFiles((prev) => prev.filter((_, i) => i !== idx))
    setPreviews((prev) => prev.filter((_, i) => i !== idx))
  }

  const handleSubmit = async () => {
    if (!description.trim()) { setError('Please describe the issue'); return }
    setSubmitting(true)
    setError('')
    try {
      const fd = new FormData()
      fd.append('description', description.trim())
      fd.append('url', window.location.href)
      fd.append('screen_size', `${window.innerWidth}x${window.innerHeight}`)
      if (selfLocation) fd.append('location', `${selfLocation.lat.toFixed(5)},${selfLocation.lon.toFixed(5)}`)
      files.forEach((f, i) => fd.append(`screenshot_${i}`, f))
      await api.post('/bug-report/', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      setSubmitted(true)
      setTimeout(onClose, 1500)
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error
      setError(msg || 'Failed to submit bug report')
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 5000,
        background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{
          background: 'var(--pip-bg, #1a1a2e)', color: 'var(--pip-text, #e0e0e0)',
          borderRadius: 12, padding: '32px 24px', textAlign: 'center', maxWidth: 320,
        }}>
          <div style={{ fontSize: '2rem', marginBottom: 8 }}>&#10003;</div>
          <div>Bug report submitted. Thank you!</div>
        </div>
      </div>
    )
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 5000,
      background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 16,
    }} onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{
        background: 'var(--pip-bg, #1a1a2e)', color: 'var(--pip-text, #e0e0e0)',
        borderRadius: 12, padding: '20px', width: '100%', maxWidth: 420, maxHeight: '80vh',
        overflow: 'auto', border: '1px solid var(--pip-border, #333)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: '1rem' }}>Report a Bug</h3>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', color: 'var(--pip-text, #e0e0e0)',
            fontSize: '1.2rem', cursor: 'pointer', padding: '4px 8px',
          }}>&times;</button>
        </div>

        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe the issue..."
          rows={4}
          style={{
            width: '100%', boxSizing: 'border-box', padding: 10, borderRadius: 8,
            background: 'var(--pip-input-bg, #0d1117)', color: 'var(--pip-text, #e0e0e0)',
            border: '1px solid var(--pip-border, #333)', resize: 'vertical',
            fontSize: '0.85rem', fontFamily: 'inherit',
          }}
        />

        <div style={{ marginTop: 12 }}>
          <button onClick={() => fileRef.current?.click()} style={{
            background: 'var(--pip-input-bg, #0d1117)', color: 'var(--pip-text, #e0e0e0)',
            border: '1px solid var(--pip-border, #333)', borderRadius: 8,
            padding: '8px 14px', cursor: 'pointer', fontSize: '0.8rem',
          }}>
            + Add Screenshots
          </button>
          <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={handleFiles} />
        </div>

        {previews.length > 0 && (
          <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
            {previews.map((src, i) => (
              <div key={i} style={{ position: 'relative' }}>
                <img src={src} alt="" style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--pip-border, #333)' }} />
                <button onClick={() => removeFile(i)} style={{
                  position: 'absolute', top: -6, right: -6,
                  background: '#e74c3c', color: '#fff', border: 'none', borderRadius: '50%',
                  width: 18, height: 18, fontSize: '0.65rem', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>&times;</button>
              </div>
            ))}
          </div>
        )}

        {error && (
          <div style={{ color: '#e74c3c', fontSize: '0.8rem', marginTop: 10 }}>{error}</div>
        )}

        <button
          onClick={handleSubmit}
          disabled={submitting}
          style={{
            marginTop: 16, width: '100%', padding: '10px',
            background: submitting ? '#555' : '#e74c3c', color: '#fff',
            border: 'none', borderRadius: 8, cursor: submitting ? 'not-allowed' : 'pointer',
            fontSize: '0.85rem', fontWeight: 'bold',
          }}
        >
          {submitting ? 'Submitting...' : 'Submit Bug Report'}
        </button>

        <div style={{ fontSize: '0.65rem', color: '#666', marginTop: 8, textAlign: 'center' }}>
          Browser info and location are automatically included.
        </div>
      </div>
    </div>
  )
}
