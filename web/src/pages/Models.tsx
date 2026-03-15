import { useEffect, useState } from 'react'
import { FolderOpen, RefreshCw, Search } from 'lucide-react'
import { useStore } from '../store'
import { api } from '../hooks/api'

export default function Models() {
  const { models, setModels, config } = useStore()
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

  const formatSize = (bytes: number) => {
    const units = ['B', 'KB', 'MB', 'GB', 'TB']
    let size = bytes
    let unitIndex = 0
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024
      unitIndex++
    }
    return `${size.toFixed(1)} ${units[unitIndex]}`
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 style={{ fontSize: 14, fontWeight: 'bold' }}>模型库</h2>
          <p className="text-sm" style={{ color: 'var(--win-gray-dark)', marginTop: 4 }}>
            目录: {config?.paths.models_dir || '未设置'}
          </p>
        </div>
        <button onClick={scanModels} disabled={loading} className="btn">
          <RefreshCw size={12} style={{ marginRight: 4, animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          重新扫描
        </button>
      </div>

      {/* Search */}
      <div style={{ position: 'relative' }}>
        <Search size={14} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--win-gray-dark)' }} />
        <input
          type="text"
          className="input"
          style={{ paddingLeft: 28, width: 200 }}
          placeholder="搜索模型..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {filteredModels.length === 0 ? (
        <div className="panel" style={{ padding: 32, textAlign: 'center' }}>
          <FolderOpen size={32} style={{ marginBottom: 8, opacity: 0.5 }} />
          <p>{config?.paths.models_dir ? '未找到模型文件' : '请先在设置中配置模型目录'}</p>
        </div>
      ) : (
        <div className="panel" style={{ padding: 0 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr style={{ background: 'var(--win-gray)', textAlign: 'left' }}>
                <th style={{ padding: '4px 8px', border: '1px solid var(--win-gray-dark)' }}>模型名称</th>
                <th style={{ padding: '4px 8px', border: '1px solid var(--win-gray-dark)' }}>大小</th>
                <th style={{ padding: '4px 8px', border: '1px solid var(--win-gray-dark)' }}>修改时间</th>
                <th style={{ padding: '4px 8px', border: '1px solid var(--win-gray-dark)' }}>MMProj</th>
              </tr>
            </thead>
            <tbody>
              {filteredModels.map((model) => (
                <tr key={model.path}>
                  <td style={{ padding: '4px 8px', border: '1px solid var(--win-gray-dark)' }}>
                    <div style={{ fontWeight: 'bold' }}>{model.name}</div>
                    <div style={{ fontSize: 9, color: 'var(--win-gray-dark)', fontFamily: 'monospace' }}>{model.path}</div>
                  </td>
                  <td style={{ padding: '4px 8px', border: '1px solid var(--win-gray-dark)' }}>{formatSize(model.size)}</td>
                  <td style={{ padding: '4px 8px', border: '1px solid var(--win-gray-dark)' }}>
                    {new Date(model.modified_time * 1000).toLocaleDateString()}
                  </td>
                  <td style={{ padding: '4px 8px', border: '1px solid var(--win-gray-dark)' }}>
                    {model.mmproj ? (
                      <div className="flex gap-1" style={{ flexWrap: 'wrap' }}>
                        {model.mmproj.split(',').map((mp: string) => (
                          <span key={mp} style={{ background: 'var(--win-teal)', color: 'white', padding: '1px 4px', fontSize: 9 }}>
                            {mp.split('/').pop()}
                          </span>
                        ))}
                      </div>
                    ) : '-'}
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
