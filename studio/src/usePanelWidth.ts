import { useRef, useState } from 'react'

const STORAGE_KEY = 'boxmath-panel-width'
const DEFAULT_WIDTH = 400
const MIN_WIDTH = 240
const MAX_WIDTH = 720

function readStoredWidth(): number {
  const saved = Number(localStorage.getItem(STORAGE_KEY))
  return saved > 0 ? saved : DEFAULT_WIDTH
}

// Drag-to-resize for the sidebar, persisted across reloads. Width also
// lives in a ref, kept in sync on every pointermove — the value saved on
// release needs to be the latest one, not whatever startDrag's own
// closure captured back at pointerdown.
export function usePanelWidth() {
  const [width, setWidth] = useState(readStoredWidth)
  const [dragging, setDragging] = useState(false)
  const widthRef = useRef(width)

  const startDrag = (e: React.PointerEvent) => {
    e.preventDefault()
    const startX = e.clientX
    const startWidth = widthRef.current
    setDragging(true)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    const onMove = (ev: PointerEvent) => {
      const next = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth + (ev.clientX - startX)))
      widthRef.current = next
      setWidth(next)
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      setDragging(false)
      localStorage.setItem(STORAGE_KEY, String(widthRef.current))
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  return { width, dragging, startDrag }
}
