import { useEffect, useState } from 'react'
import { FolderOpen, RefreshCw, Search } from 'lucide-react'
import { useStore } from '../store'
import { api } from '../hooks/api'
import { useTranslation } from '../i18n/useTranslation'
import { useIsMobile } from '../hooks/useMediaQuery'
import { formatSize } from '../utils'

export default function Models() {
  const { models, setModels, config } = useStore()
  const { t } = useTranslation()
  const isMobile = useIsMobile()
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')

  const scanModels = async () => {
    setLoading(true)
    try {
      const result = await api.scanModels()
      setModels(result.models || [])
    } catch (e) {
      console.error('Failed to scan models:', e)
    }
    setLoading(false)
  }

  useEffect(() => {
    if (models.length === 0) {
      scanModels()
    }
  }, [])

  const filteredModels = models.filter(m =>
    m.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 style={{ fontSize: 14, fontWeight: 'bold' }}>{t('modelLibrary')}</h2>
          <p className="text-sm" style={{ color: 'var(--win-gray-dark)', marginTop: 4 }}>
            {t('directory')}: {config?.paths.models_dir || t('notSet')}
          </p>
        </div>
        <button onClick={scanModels} disabled={loading} className="btn">
          <RefreshCw size={12} style={{ marginRight: 4, animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          {t('rescan')}
        </button>
      </div>

      {/* Search */}
      <div style={{ position: 'relative' }}>
        <Search size={14} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--win-gray-dark)' }} />
        <input
          type="text"
          className="input"
          style={{ paddingLeft: 28, width: isMobile ? '100%' : 200 }}
          placeholder={t('searchModels')}
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {filteredModels.length === 0 ? (
        <div className="panel" style={{ padding: 32, textAlign: 'center' }}>
          <FolderOpen size={32} style={{ marginBottom: 8, opacity: 0.5 }} />
          <p>{config?.paths.models_dir ? t('noModelsFound') : t('configureModels')}</p>
        </div>
      ) : (
        <div className="panel" style={{ padding: 0, overflowX: 'auto' }}>
          <table style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: isMobile ? 10 : 11,
            minWidth: isMobile ? 500 : 'auto'
          }}>
            <thead>
              <tr style={{ background: 'var(--win-gray)', textAlign: 'left' }}>
                <th style={{ padding: '4px 8px', border: '1px solid var(--win-gray-dark)' }}>{t('modelName')}</th>
                <th style={{ padding: '4px 8px', border: '1px solid var(--win-gray-dark)' }}>{t('architecture')}</th>
                <th style={{ padding: '4px 8px', border: '1px solid var(--win-gray-dark)' }}>{t('quantization')}</th>
                <th style={{ padding: '4px 8px', border: '1px solid var(--win-gray-dark)' }}>{t('contextLength')}</th>
                <th style={{ padding: '4px 8px', border: '1px solid var(--win-gray-dark)' }}>{t('size')}</th>
                <th style={{ padding: '4px 8px', border: '1px solid var(--win-gray-dark)' }}>{t('mmproj')}</th>
              </tr>
            </thead>
            <tbody>
              {filteredModels.map((model) => (
                <tr key={model.path}>
                  <td style={{ padding: '4px 8px', border: '1px solid var(--win-gray-dark)' }}>
                    <div style={{ fontWeight: 'bold' }}>{model.model_name || model.name}</div>
                    <div style={{ fontSize: 9, color: 'var(--win-gray-dark)', fontFamily: 'monospace' }}>{model.path}</div>
                  </td>
                  <td style={{ padding: '4px 8px', border: '1px solid var(--win-gray-dark)' }}>
                    {model.architecture || '-'}
                  </td>
                  <td style={{ padding: '4px 8px', border: '1px solid var(--win-gray-dark)' }}>
                    {model.quantization || '-'}
                  </td>
                  <td style={{ padding: '4px 8px', border: '1px solid var(--win-gray-dark)' }}>
                    {model.context_length ? model.context_length.toLocaleString() : '-'}
                  </td>
                  <td style={{ padding: '4px 8px', border: '1px solid var(--win-gray-dark)' }}>{formatSize(model.size)}</td>
                  <td style={{ padding: '4px 8px', border: '1px solid var(--win-gray-dark)', textAlign: 'center' }}>
                    <span style={{
                      background: model.mmproj ? '#00aa00' : '#aa0000',
                      color: 'white',
                      padding: '1px 5px',
                      fontSize: 10,
                      fontFamily: 'Marlett, Wingdings, sans-serif',
                      fontWeight: 'bold'
                    }}>
                      {model.mmproj ? '✓' : '✗'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
