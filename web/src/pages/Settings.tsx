import { useState, useEffect } from 'react'
import { Save, HardDrive, Network } from 'lucide-react'
import { useStore } from '../store'
import { api } from '../hooks/api'

export default function Settings() {
  const { config, setConfig } = useStore()
  const [formData, setFormData] = useState({
    host: '0.0.0.0',
    port: 8000,
    llama_bin: '',
    models_dir: '',
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
      })
    }
  }, [config])

  const handleSave = async () => {
    setSaving(true)
    setMessage('')
    try {
      await api.updateConfig({
        server: { host: formData.host, port: formData.port },
        paths: { llama_bin: formData.llama_bin, models_dir: formData.models_dir },
      })
      setConfig({
        server: { host: formData.host, port: formData.port },
        paths: { llama_bin: formData.llama_bin, models_dir: formData.models_dir, log_dir: config?.paths.log_dir || '' },
      })
      setMessage('保存成功')
    } catch (e) {
      setMessage(`保存失败: ${e}`)
    }
    setSaving(false)
  }

  return (
    <div className="flex flex-col gap-4">
      <h2 style={{ fontSize: 14, fontWeight: 'bold' }}>设置</h2>

      <div className="panel">
        <h3 style={{ fontWeight: 'bold', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Network size={14} />
          服务配置
        </h3>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
          <div>
            <label className="text-sm" style={{ display: 'block', marginBottom: 4 }}>监听地址</label>
            <input
              type="text"
              className="input"
              style={{ width: '100%' }}
              value={formData.host}
              onChange={e => setFormData({ ...formData, host: e.target.value })}
            />
          </div>
          <div>
            <label className="text-sm" style={{ display: 'block', marginBottom: 4 }}>监听端口</label>
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
          路径配置
        </h3>
        <div className="flex flex-col gap-4">
          <div>
            <label className="text-sm" style={{ display: 'block', marginBottom: 4 }}>llama.cpp 二进制路径</label>
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
            <label className="text-sm" style={{ display: 'block', marginBottom: 4 }}>模型目录</label>
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

      <div className="flex items-center gap-4">
        <button onClick={handleSave} disabled={saving} className="btn btn-primary">
          <Save size={12} style={{ marginRight: 4 }} />
          {saving ? '保存中...' : '保存设置'}
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
