import { useEffect, useRef, useState } from 'react'

interface Props {
  open: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  height?: 'half' | 'full' | 'auto'
  hideHandle?: boolean
}

export default function BottomSheet({ open, onClose, title, children, height = 'full', hideHandle }: Props) {
  const [isOpen, setIsOpen] = useState(false)
  const [shouldMount, setShouldMount] = useState(open)

  // Swipe-to-dismiss state
  const dragRef = useRef({ startY: 0, startTime: 0, isDragging: false })
  const [dragOffset, setDragOffset] = useState(0)
  const [isDragging, setIsDragging] = useState(false)

  useEffect(() => {
    if (open) {
      setShouldMount(true)
      let id: ReturnType<typeof setTimeout>
      const animId = requestAnimationFrame(() => {
        id = setTimeout(() => setIsOpen(true), 10)
      })
      return () => { cancelAnimationFrame(animId); clearTimeout(id) }
    }
    setIsOpen(false)
    const t = setTimeout(() => setShouldMount(false), 350)
    return () => clearTimeout(t)
  }, [open])

  const handleHandlePointerDown = (e: React.PointerEvent) => {
    dragRef.current = { startY: e.clientY, startTime: Date.now(), isDragging: true }
    setIsDragging(true)
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current.isDragging) return
    const dy = Math.max(0, e.clientY - dragRef.current.startY)
    setDragOffset(dy)
  }

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!dragRef.current.isDragging) return
    dragRef.current.isDragging = false
    setIsDragging(false)
    const elapsed = Math.max(1, Date.now() - dragRef.current.startTime)
    const velocity = dragOffset / elapsed
    if (dragOffset > 120 || velocity > 0.5) {
      setDragOffset(0)
      onClose()
    } else {
      setDragOffset(0)
    }
    ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
  }

  const backdropOpacity = isDragging ? Math.max(0, 1 - dragOffset / 280) : undefined

  const heightClass = { half: 'sheet-half', full: 'sheet-full', auto: 'sheet-auto' }[height]

  const sheetStyle: React.CSSProperties = isDragging
    ? { transform: `translateY(${dragOffset}px)`, transition: 'none' }
    : dragOffset === 0 ? {}
    : { transform: `translateY(${dragOffset}px)`, transition: 'transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)' }

  return (
    <>
      <div
        className={`sheet-backdrop${isOpen ? ' sheet-backdrop-open' : ''}`}
        style={backdropOpacity !== undefined ? { opacity: backdropOpacity * 1 } : undefined}
        onClick={onClose}
      />
      <div
        className={`bottom-sheet ${heightClass}${isOpen ? ' bottom-sheet-open' : ''}`}
        style={sheetStyle}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        {!hideHandle && (
          <div
            className="sheet-handle-row"
            onPointerDown={handleHandlePointerDown}
          >
            <div className="sheet-handle" />
          </div>
        )}
        {title && (
          <div className="sheet-header">
            <span className="sheet-title">{title}</span>
            <button className="sheet-close-btn" onClick={onClose}>×</button>
          </div>
        )}
        <div className="sheet-content">
          {shouldMount && children}
        </div>
      </div>
    </>
  )
}
