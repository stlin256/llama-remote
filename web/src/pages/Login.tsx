import { useState } from 'react'
import { useStore } from '../store'
import { api } from '../hooks/api'
import { useTranslation } from '../i18n/useTranslation'

export default function Login() {
  const desktopRibbonWidth = 68
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { setAuthenticated } = useStore()
  const { t } = useTranslation()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await api.login(password)
      setAuthenticated(true)
    } catch (err) {
      setError(t('passwordError'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="desktop">
      {/* Vertical banner */}
      <div style={{
        position: 'absolute',
        left: 8,
        top: 8,
        bottom: 8,
        width: desktopRibbonWidth,
        writingMode: 'vertical-rl',
        textOrientation: 'mixed',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        background: 'var(--win-blue)',
        color: 'white',
        padding: '12px 6px',
        fontSize: 20,
        fontWeight: 'bold',
        fontStyle: 'italic',
        letterSpacing: 3,
        border: '2px solid',
        borderColor: 'var(--win-white) var(--win-black) var(--win-black) var(--win-white)',
        zIndex: 10,
        whiteSpace: 'nowrap',
      }}>
        LLAMA-REMOTE
      </div>

      {/* Login window */}
      <div className="window" style={{
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 320,
      }}>
        <div className="title-bar">
          <span>{t('login')}</span>
          <div className="title-bar-buttons">
            <div className="title-bar-btn">X</div>
          </div>
        </div>
        <div className="window-body">
          <form onSubmit={handleLogin}>
            <div className="panel" style={{ marginBottom: 12 }}>
              <div style={{ marginBottom: 12 }}>
                <div style={{ marginBottom: 4 }}>
                  <img
                    src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='48' height='48' viewBox='0 0 24 24' fill='none' stroke='%23000080' stroke-width='2'%3E%3Crect x='3' y='11' width='18' height='11' rx='2' ry='2'/%3E%3Cpath d='M7 11V7a5 5 0 0 1 10 0v4'/%3E%3C/svg%3E"
                    alt="lock"
                    style={{ width: 48, height: 48, display: 'block', margin: '0 auto 8px' }}
                  />
                </div>
                <div style={{ textAlign: 'center', fontSize: 11, color: '#666' }}>
                  Llama Remote - {t('passwordRequired')}
                </div>
              </div>

              <div>
                <label className="text-sm" style={{ display: 'block', marginBottom: 4 }}>{t('password')}:</label>
                <input
                  type="password"
                  className="input"
                  style={{ width: '100%' }}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t('enterPassword')}
                  autoFocus
                  disabled={loading}
                />
              </div>

              {error && (
                <div style={{ color: '#aa0000', fontSize: 11, marginTop: 8 }}>
                  {error}
                </div>
              )}
            </div>

            <div className="flex gap-2 justify-end">
              <button
                type="submit"
                className="btn btn-primary"
                disabled={loading || !password}
              >
                {loading ? t('loggingIn') : t('login')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
