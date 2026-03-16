import { ButtonHTMLAttributes, ReactNode } from 'react'
import { useIsMobile } from '../../hooks/useMediaQuery'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'success'
  size?: 'small' | 'medium' | 'large'
  children: ReactNode
  icon?: ReactNode
}

/**
 * Responsive Button component
 * - Desktop: Standard Windows 95 style buttons
 * - Mobile: Larger touch targets (min 44px height)
 */
export default function Button({
  variant = 'secondary',
  size = 'medium',
  children,
  icon,
  className = '',
  style,
  disabled,
  ...props
}: ButtonProps) {
  const isMobile = useIsMobile()

  const getVariantStyles = () => {
    const base = {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      cursor: disabled ? 'not-allowed' : 'pointer',
      fontWeight: 'bold',
      border: '2px solid',
    }

    switch (variant) {
      case 'primary':
        return {
          ...base,
          background: 'var(--win-gray)',
          borderColor: 'var(--win-white) var(--win-black) var(--win-black) var(--win-white)',
          color: disabled ? 'var(--win-gray-dark)' : 'var(--win-black)'
        }
      case 'danger':
        return {
          ...base,
          background: '#dc2626',
          borderColor: '#fca5a5 #991b1b #991b1b #fca5a5',
          color: 'white'
        }
      case 'success':
        return {
          ...base,
          background: '#16a34a',
          borderColor: '#86efac #15803d #15803d #86efac',
          color: 'white'
        }
      default:
        return {
          ...base,
          background: 'var(--win-gray)',
          borderColor: 'var(--win-white) var(--win-black) var(--win-black) var(--win-white)',
          color: disabled ? 'var(--win-gray-dark)' : 'var(--win-black)'
        }
    }
  }

  const getSizeStyles = () => {
    const mobileSize = isMobile ? 1.2 : 1

    switch (size) {
      case 'small':
        return {
          padding: `${4 * mobileSize}px ${8 * mobileSize}px`,
          fontSize: 11 * mobileSize
        }
      case 'large':
        return {
          padding: `${10 * mobileSize}px ${20 * mobileSize}px`,
          fontSize: 14 * mobileSize
        }
      default:
        return {
          padding: `${6 * mobileSize}px ${12 * mobileSize}px`,
          fontSize: 12 * mobileSize
        }
    }
  }

  return (
    <button
      className={className}
      style={{
        ...getVariantStyles(),
        ...getSizeStyles(),
        opacity: disabled ? 0.5 : 1,
        ...style
      }}
      disabled={disabled}
      {...props}
    >
      {icon && <span style={{ display: 'flex', alignItems: 'center' }}>{icon}</span>}
      {children}
    </button>
  )
}
