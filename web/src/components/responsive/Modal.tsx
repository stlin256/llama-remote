import { ReactNode, useEffect } from 'react'
import { useIsMobile } from '../../hooks/useMediaQuery'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  children: ReactNode
  width?: string
  footer?: ReactNode
}

/**
 * Responsive Modal component
 * - Desktop: Centered modal with overlay
 * - Mobile: Bottom sheet style modal
 */
export default function Modal({ isOpen, onClose, title, children, width = '500px', footer }: ModalProps) {
  const isMobile = useIsMobile()

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      document.body.style.overflow = 'hidden'
    }

    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = ''
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  if (isMobile) {
    return (
      <>
        {/* Overlay */}
        <div
          onClick={onClose}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            zIndex: 1000
          }}
        />
        {/* Bottom sheet */}
        <div style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          background: 'var(--win-gray)',
          borderTop: '2px solid var(--win-gray-dark)',
          borderTopLeftRadius: '8px',
          borderTopRightRadius: '8px',
          maxHeight: '90vh',
          overflow: 'auto',
          zIndex: 1001,
          animation: 'slideUp 0.2s ease-out'
        }}>
          {/* Handle bar */}
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            padding: '8px 0'
          }}>
            <div style={{
              width: 40,
              height: 4,
              background: 'var(--win-gray-dark)',
              borderRadius: 2
            }} />
          </div>

          {/* Header */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '12px 16px',
            borderBottom: '2px solid var(--win-gray-dark)'
          }}>
            <span style={{ fontWeight: 'bold', fontSize: 16 }}>{title}</span>
            <button
              onClick={onClose}
              style={{
                background: 'var(--win-gray)',
                border: '2px solid',
                borderColor: 'var(--win-white) var(--win-black) var(--win-black) var(--win-white)',
                width: 28,
                height: 28,
                cursor: 'pointer',
                fontSize: 14,
                fontWeight: 'bold'
              }}
            >
              X
            </button>
          </div>

          {/* Content */}
          <div style={{ padding: 16 }}>
            {children}
          </div>

          {/* Footer */}
          {footer && (
            <div style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 8,
              padding: '12px 16px',
              borderTop: '2px solid var(--win-gray-dark)',
              background: 'var(--win-gray)'
            }}>
              {footer}
            </div>
          )}
        </div>
        <style>{`
          @keyframes slideUp {
            from { transform: translateY(100%); }
            to { transform: translateY(0); }
          }
        `}</style>
      </>
    )
  }

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          zIndex: 1000
        }}
      />
      {/* Centered modal */}
      <div style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '90%',
        maxWidth: width,
        maxHeight: '90vh',
        background: 'var(--win-gray)',
        border: '2px solid',
        borderColor: 'var(--win-white) var(--win-black) var(--win-black) var(--win-white)',
        zIndex: 1001,
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '4px 8px',
          background: 'var(--win-blue)',
          color: 'white'
        }}>
          <span style={{ fontWeight: 'bold', fontSize: 13 }}>{title}</span>
          <button
            onClick={onClose}
            style={{
              background: 'var(--win-gray)',
              border: '2px solid',
              borderColor: 'var(--win-white) var(--win-black) var(--win-black) var(--win-white)',
              width: 20,
              height: 20,
              cursor: 'pointer',
              fontSize: 11,
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            X
          </button>
        </div>

        {/* Content */}
        <div style={{
          padding: 16,
          overflow: 'auto',
          flex: 1
        }}>
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 8,
            padding: '8px 16px',
            borderTop: '2px solid var(--win-gray-dark)',
            background: 'var(--win-gray)'
          }}>
            {footer}
          </div>
        )}
      </div>
    </>
  )
}
