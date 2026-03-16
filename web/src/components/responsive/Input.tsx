import { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'
import { useIsMobile } from '../../hooks/useMediaQuery'

interface BaseInputProps {
  label?: string
  error?: string
  className?: string
  containerStyle?: React.CSSProperties
}

/**
 * Responsive Input component
 * - Desktop: Standard width with label
 * - Mobile: Full-width, stacked layout
 */
export function Input({ label, error, className = '', containerStyle, ...props }: BaseInputProps & InputHTMLAttributes<HTMLInputElement>) {
  const isMobile = useIsMobile()

  return (
    <div style={{ marginBottom: isMobile ? 12 : 8, ...containerStyle }}>
      {label && (
        <label style={{
          display: 'block',
          marginBottom: 4,
          fontSize: isMobile ? 13 : 12,
          fontWeight: 'bold',
          color: 'var(--win-black)'
        }}>
          {label}
        </label>
      )}
      <input
        className={className}
        style={{
          width: '100%',
          padding: isMobile ? '10px 8px' : '4px 6px',
          fontSize: isMobile ? 15 : 12,
          border: '2px solid',
          borderColor: error ? '#dc2626' : 'var(--win-gray-dark) var(--win-white) var(--win-white) var(--win-gray-dark)',
          background: 'var(--win-white)',
          outline: 'none',
          boxSizing: 'border-box',
          fontFamily: 'inherit'
        }}
        {...props}
      />
      {error && (
        <span style={{ color: '#dc2626', fontSize: isMobile ? 12 : 11, marginTop: 2, display: 'block' }}>
          {error}
        </span>
      )}
    </div>
  )
}

/**
 * Responsive Select component
 */
export function Select({ label, error, className = '', containerStyle, children, ...props }: BaseInputProps & SelectHTMLAttributes<HTMLSelectElement>) {
  const isMobile = useIsMobile()

  return (
    <div style={{ marginBottom: isMobile ? 12 : 8, ...containerStyle }}>
      {label && (
        <label style={{
          display: 'block',
          marginBottom: 4,
          fontSize: isMobile ? 13 : 12,
          fontWeight: 'bold',
          color: 'var(--win-black)'
        }}>
          {label}
        </label>
      )}
      <select
        className={className}
        style={{
          width: '100%',
          padding: isMobile ? '10px 8px' : '4px 6px',
          fontSize: isMobile ? 15 : 12,
          border: '2px solid',
          borderColor: error ? '#dc2626' : 'var(--win-gray-dark) var(--win-white) var(--win-white) var(--win-gray-dark)',
          background: 'var(--win-white)',
          outline: 'none',
          boxSizing: 'border-box',
          fontFamily: 'inherit',
          cursor: 'pointer'
        }}
        {...props}
      >
        {children}
      </select>
      {error && (
        <span style={{ color: '#dc2626', fontSize: isMobile ? 12 : 11, marginTop: 2, display: 'block' }}>
          {error}
        </span>
      )}
    </div>
  )
}

/**
 * Responsive Textarea component
 */
export function Textarea({ label, error, className = '', containerStyle, ...props }: BaseInputProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const isMobile = useIsMobile()

  return (
    <div style={{ marginBottom: isMobile ? 12 : 8, ...containerStyle }}>
      {label && (
        <label style={{
          display: 'block',
          marginBottom: 4,
          fontSize: isMobile ? 13 : 12,
          fontWeight: 'bold',
          color: 'var(--win-black)'
        }}>
          {label}
        </label>
      )}
      <textarea
        className={className}
        style={{
          width: '100%',
          padding: isMobile ? '10px 8px' : '4px 6px',
          fontSize: isMobile ? 15 : 12,
          border: '2px solid',
          borderColor: error ? '#dc2626' : 'var(--win-gray-dark) var(--win-white) var(--win-white) var(--win-gray-dark)',
          background: 'var(--win-white)',
          outline: 'none',
          boxSizing: 'border-box',
          fontFamily: 'inherit',
          resize: 'vertical'
        }}
        {...props}
      />
      {error && (
        <span style={{ color: '#dc2626', fontSize: isMobile ? 12 : 11, marginTop: 2, display: 'block' }}>
          {error}
        </span>
      )}
    </div>
  )
}

/**
 * Responsive Checkbox component
 */
interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string
}

export function Checkbox({ label, className = '', style, ...props }: CheckboxProps) {
  const isMobile = useIsMobile()

  return (
    <label style={{
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      cursor: 'pointer',
      fontSize: isMobile ? 14 : 12,
      marginBottom: isMobile ? 8 : 4
    }}>
      <input
        type="checkbox"
        className={className}
        style={{
          width: isMobile ? 20 : 16,
          height: isMobile ? 20 : 16,
          cursor: 'pointer',
          ...style
        }}
        {...props}
      />
      {label}
    </label>
  )
}
