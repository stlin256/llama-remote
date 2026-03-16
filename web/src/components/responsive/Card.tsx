import { ReactNode } from 'react'
import { useIsMobile } from '../../hooks/useMediaQuery'

interface CardProps {
  children: ReactNode
  title?: string
  className?: string
  style?: React.CSSProperties
  actions?: ReactNode
}

/**
 * Responsive Card component
 * - Desktop: Standard card with title
 * - Mobile: Full-width card with no extra margins
 */
export default function Card({ children, title, className = '', style, actions }: CardProps) {
  const isMobile = useIsMobile()

  if (isMobile) {
    return (
      <div
        className={className}
        style={{
          background: 'var(--win-white)',
          border: '2px solid',
          borderColor: 'var(--win-gray-dark) var(--win-white) var(--win-white) var(--win-gray-dark)',
          marginBottom: 12,
          ...style
        }}
      >
        {title && (
          <div style={{
            background: 'var(--win-blue)',
            color: 'white',
            padding: '8px 12px',
            fontWeight: 'bold',
            fontSize: 14,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <span>{title}</span>
            {actions && <div>{actions}</div>}
          </div>
        )}
        <div style={{ padding: 12 }}>
          {children}
        </div>
      </div>
    )
  }

  return (
    <div
      className={className}
      style={{
        background: 'var(--win-white)',
        border: '2px solid',
        borderColor: 'var(--win-gray-dark) var(--win-white) var(--win-white) var(--win-gray-dark)',
        boxShadow: '1px 1px 0 var(--win-black)',
        ...style
      }}
    >
      {title && (
        <div style={{
          background: 'linear-gradient(to right, var(--win-blue), #4a6fd1)',
          color: 'white',
          padding: '6px 12px',
          fontWeight: 'bold',
          fontSize: 13,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span>{title}</span>
          {actions && <div>{actions}</div>}
        </div>
      )}
      <div style={{ padding: 12 }}>
        {children}
      </div>
    </div>
  )
}
