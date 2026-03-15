import { useState, useEffect } from 'react'

interface ConfirmDialogProps {
  show: boolean
  title: string
  message: string
  onConfirm: () => void
  onCancel: () => void
}

function ConfirmDialog({ show, title, message, onConfirm, onCancel }: ConfirmDialogProps) {
  if (!show) return null

  return (
    <div className="modal-overlay">
      <div className="modal-window" style={{ width: 350 }}>
        <div className="title-bar">
          <span>{title}</span>
          <div className="title-bar-buttons">
            <div className="title-bar-btn" onClick={onCancel}>X</div>
          </div>
        </div>
        <div className="window-body">
          <div className="flex items-center gap-3" style={{ marginBottom: 16 }}>
            <div style={{
              width: 32,
              height: 32,
              background: 'var(--win-blue)',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 20,
              fontWeight: 'bold',
              border: '2px solid var(--win-black)',
            }}>?</div>
            <span style={{ flex: 1 }}>{message}</span>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={onCancel} className="btn" style={{ minWidth: 60 }}>否</button>
            <button onClick={onConfirm} className="btn btn-primary" style={{ minWidth: 60 }}>是</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// Get language from localStorage
function getLang(): string {
  return localStorage.getItem('language') || 'zh'
}

// Global confirm state
let confirmResolve: ((value: boolean) => void) | null = null

export function confirm(message: string, title?: string): Promise<boolean> {
  const lang = getLang()
  const defaultTitle = lang === 'zh' ? '确认' : 'Confirm'
  return new Promise((resolve) => {
    confirmResolve = resolve
    window.dispatchEvent(new CustomEvent('showConfirm', {
      detail: { message, title: title || defaultTitle }
    }))
  })
}

// Hook to use confirm dialog
export function useConfirm() {
  const [show, setShow] = useState(false)
  const [data, setData] = useState({ title: '确认', message: '' })

  useEffect(() => {
    const handler = (e: CustomEvent) => {
      setData(e.detail)
      setShow(true)
    }
    window.addEventListener('showConfirm', handler as EventListener)
    return () => window.removeEventListener('showConfirm', handler as EventListener)
  }, [])

  const handleConfirm = () => {
    setShow(false)
    if (confirmResolve) {
      confirmResolve(true)
      confirmResolve = null
    }
  }

  const handleCancel = () => {
    setShow(false)
    if (confirmResolve) {
      confirmResolve(false)
      confirmResolve = null
    }
  }

  return { ConfirmDialog: () => (
    <ConfirmDialog
      show={show}
      title={data.title}
      message={data.message}
      onConfirm={handleConfirm}
      onCancel={handleCancel}
    />
  )}
}
