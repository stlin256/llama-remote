interface ModalProps {
  title: string
  show: boolean
  onClose: () => void
  children: React.ReactNode
  width?: number
}

export default function Modal({ title, show, onClose, children, width = 400 }: ModalProps) {
  if (!show) return null

  return (
    <div className="modal-overlay">
      <div
        className="modal-window"
        style={{ width }}
      >
        <div className="title-bar">
          <span>{title}</span>
          <div className="title-bar-buttons">
            <div className="title-bar-btn" onClick={onClose}>X</div>
          </div>
        </div>
        <div className="window-body">
          {children}
        </div>
      </div>
    </div>
  )
}
