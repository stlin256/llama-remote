import { useState, useEffect } from 'react'

type MessageType = 'success' | 'error' | 'info'

interface MessageDialogProps {
  show: boolean
  title: string
  message: string
  type: MessageType
  onClose: () => void
}

function MessageDialog({ show, title, message, type, onClose }: MessageDialogProps) {
  if (!show) return null

  const iconBg = type === 'success' ? '#00aa00' : type === 'error' ? '#aa0000' : 'var(--win-blue)'
  const icon = type === 'success' ? '✓' : type === 'error' ? '✗' : 'i'

  return (
    <div className="modal-overlay">
      <div className="modal-window" style={{ width: 350 }}>
        <div className="title-bar">
          <span>{title}</span>
          <div className="title-bar-buttons">
            <div className="title-bar-btn" onClick={onClose}>X</div>
          </div>
        </div>
        <div className="window-body">
          <div className="flex items-center gap-3" style={{ marginBottom: 16 }}>
            <div style={{
              width: 32,
              height: 32,
              background: iconBg,
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 20,
              fontWeight: 'bold',
              border: '2px solid var(--win-black)',
            }}>{icon}</div>
            <span style={{ flex: 1, wordBreak: 'break-word' }}>{message}</span>
          </div>
          <div className="flex justify-end">
            <button onClick={onClose} className="btn btn-primary" style={{ minWidth: 60 }}>确定</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// Global message state
let messageResolve: (() => void) | null = null

export function message(msg: string, type: MessageType = 'info', title: string = '提示'): Promise<void> {
  return new Promise((resolve) => {
    messageResolve = resolve
    window.dispatchEvent(new CustomEvent('showMessage', {
      detail: { message: msg, type, title }
    }))
  })
}

export function success(msg: string, title: string = '成功') {
  return message(msg, 'success', title)
}

export function error(msg: string, title: string = '错误') {
  return message(msg, 'error', title)
}

export function info(msg: string, title: string = '提示') {
  return message(msg, 'info', title)
}

// Hook to use message dialog
export function useMessage() {
  const [show, setShow] = useState(false)
  const [data, setData] = useState({ title: '提示', message: '', type: 'info' as MessageType })

  useEffect(() => {
    const handler = (e: CustomEvent) => {
      setData(e.detail)
      setShow(true)
    }
    window.addEventListener('showMessage', handler as EventListener)
    return () => window.removeEventListener('showMessage', handler as EventListener)
  }, [])

  const handleClose = () => {
    setShow(false)
    if (messageResolve) {
      messageResolve()
      messageResolve = null
    }
  }

  return { MessageDialog: () => (
    <MessageDialog
      show={show}
      title={data.title}
      message={data.message}
      type={data.type}
      onClose={handleClose}
    />
  )}
}
