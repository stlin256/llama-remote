import { useState, useEffect } from 'react'
import { Save, HardDrive, Network, Lock, Globe } from 'lucide-react'
import { useStore } from '../store'
import { api } from '../hooks/api'
import { useTranslation } from '../i18n/useTranslation'

export default function Settings() {
  const { config, setConfig, setAuthenticated, language, setLanguage } = useStore()
  const { t } = useTranslation()
  const [formData, setFormData] = useState({
    host: '0.0.0.0',
    port: 8000,
    llama_bin: '',
    models_dir: '',
    auth_enable: false,
    auth_password: '',
  })
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (config) {
      setFormData({
        host: config.server.host,
        port: config.server.port,
        llama_bin: config.paths.llama_bin,
        models_dir: config.paths.models_dir,
        auth_enable: config.auth?.enable || false,
        auth_password: '',
      })
    }
  }, [config])

  const handleSave = async () => {
    setSaving(true)
    setMessage('')
    try {
      const updateData: any = {
        server: { host: formData.host, port: formData.port },
        paths: { llama_bin: formData.llama_bin, models_dir: formData.models_dir },
        auth: { enable: formData.auth_enable },
      }
      // Only send password if it's not empty
      if (formData.auth_password) {
        updateData.auth.password = formData.auth_password
      }
      await api.updateConfig(updateData)
      setConfig({
        server: { host: formData.host, port: formData.port },
        paths: { llama_bin: formData.llama_bin, models_dir: formData.models_dir, log_dir: config?.paths.log_dir || '' },
        auth: { enable: formData.auth_enable },
      })
      setMessage(t('settingsSaved'))
    } catch (e) {
      setMessage(`${t('failed')}: ${e}`)
    }
    setSaving(false)
  }

  const handleLogout = async () => {
    try {
      await api.logout()
      setAuthenticated(false)
    } catch (e) {
      console.error('Logout failed:', e)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <h2 style={{ fontSize: 14, fontWeight: 'bold' }}>{t('settingsTitle')}</h2>

      {/* Language Settings */}
      <div className="panel">
        <h3 style={{ fontWeight: 'bold', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Globe size={14} />
          {t('language')}
        </h3>
        <div className="flex gap-4">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="language"
              checked={language === 'zh'}
              onChange={() => setLanguage('zh')}
            />
            <span className="text-sm">{t('chinese')}</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="language"
              checked={language === 'en'}
              onChange={() => setLanguage('en')}
            />
            <span className="text-sm">{t('english')}</span>
          </label>
        </div>
      </div>

      <div className="panel">
        <h3 style={{ fontWeight: 'bold', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Network size={14} />
          {t('serverHost')}
        </h3>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
          <div>
            <label className="text-sm" style={{ display: 'block', marginBottom: 4 }}>{t('serverHost')}</label>
            <input
              type="text"
              className="input"
              style={{ width: '100%' }}
              value={formData.host}
              onChange={e => setFormData({ ...formData, host: e.target.value })}
            />
          </div>
          <div>
            <label className="text-sm" style={{ display: 'block', marginBottom: 4 }}>{t('serverPort')}</label>
            <input
              type="number"
              className="input"
              style={{ width: '100%' }}
              value={formData.port}
              onChange={e => setFormData({ ...formData, port: parseInt(e.target.value) })}
            />
          </div>
        </div>
      </div>

      <div className="panel">
        <h3 style={{ fontWeight: 'bold', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          <HardDrive size={14} />
          {t('modelsDirectory')}
        </h3>
        <div className="flex flex-col gap-4">
          <div>
            <label className="text-sm" style={{ display: 'block', marginBottom: 4 }}>{t('llamaServerPath')}</label>
            <input
              type="text"
              className="input"
              style={{ width: '100%', fontFamily: 'monospace', fontSize: 10 }}
              value={formData.llama_bin}
              onChange={e => setFormData({ ...formData, llama_bin: e.target.value })}
              placeholder="/home/user/llama.cpp/build/bin/llama-server"
            />
          </div>
          <div>
            <label className="text-sm" style={{ display: 'block', marginBottom: 4 }}>{t('modelsDirectory')}</label>
            <input
              type="text"
              className="input"
              style={{ width: '100%', fontFamily: 'monospace', fontSize: 10 }}
              value={formData.models_dir}
              onChange={e => setFormData({ ...formData, models_dir: e.target.value })}
              placeholder="/home/user/models"
            />
          </div>
        </div>
      </div>

      <div className="panel">
        <h3 style={{ fontWeight: 'bold', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Lock size={14} />
          {t('password')}
        </h3>
        <div className="flex flex-col gap-4">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={formData.auth_enable}
              onChange={e => setFormData({ ...formData, auth_enable: e.target.checked })}
            />
            <span className="text-sm">{t('enablePassword')}</span>
          </label>
          <div>
            <label className="text-sm" style={{ display: 'block', marginBottom: 4 }}>{t('password')} {formData.auth_enable ? '(leave empty to keep)' : ''}</label>
            <input
              type="password"
              className="input"
              style={{ width: '100%' }}
              value={formData.auth_password}
              onChange={e => setFormData({ ...formData, auth_password: e.target.value })}
              placeholder={formData.auth_enable ? 'New password' : 'Set password after enabling'}
              disabled={!formData.auth_enable}
            />
          </div>
          {formData.auth_enable && (
            <button onClick={handleLogout} className="btn" style={{ alignSelf: 'flex-start' }}>
              {t('logout')}
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-4">
        <button onClick={handleSave} disabled={saving} className="btn btn-primary">
          <Save size={12} style={{ marginRight: 4 }} />
          {saving ? t('loading') : t('saveSettings')}
        </button>
        {message && (
          <span style={{ color: message.includes('失败') ? '#aa0000' : '#00aa00' }}>
            {message}
          </span>
        )}
      </div>
    </div>
  )
}
