import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Save, Network, HardDrive } from 'lucide-react'
import { useStore } from '../store'
import { api } from '../hooks/api'

export default function Settings() {
  const { config, setConfig } = useStore()
  const [formData, setFormData] = useState({
    host: '0.0.0.0',
    port: 8080,
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
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold">设置</h1>

      {/* 服务配置 */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card p-6"
      >
        <h2 className="text-lg font-medium mb-4 flex items-center gap-2">
          <Network className="text-primary" />
          服务配置
        </h2>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-2">监听地址</label>
              <input
                type="text"
                className="input"
                value={formData.host}
                onChange={e => setFormData({ ...formData, host: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-2">监听端口</label>
              <input
                type="number"
                className="input"
                value={formData.port}
                onChange={e => setFormData({ ...formData, port: parseInt(e.target.value) })}
              />
            </div>
          </div>
        </div>
      </motion.div>

      {/* 路径配置 */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="glass-card p-6"
      >
        <h2 className="text-lg font-medium mb-4 flex items-center gap-2">
          <HardDrive className="text-accent" />
          路径配置
        </h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-2">llama.cpp 二进制路径</label>
            <input
              type="text"
              className="input font-mono text-sm"
              value={formData.llama_bin}
              onChange={e => setFormData({ ...formData, llama_bin: e.target.value })}
              placeholder="/home/user/llama.cpp/build/bin/llama-server"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-2">模型目录</label>
            <input
              type="text"
              className="input font-mono text-sm"
              value={formData.models_dir}
              onChange={e => setFormData({ ...formData, models_dir: e.target.value })}
              placeholder="/home/user/models"
            />
          </div>
        </div>
      </motion.div>

      {/* 保存按钮 */}
      <div className="flex items-center gap-4">
        <button
          onClick={handleSave}
          disabled={saving}
          className="btn-primary flex items-center gap-2"
        >
          <Save size={18} />
          {saving ? '保存中...' : '保存设置'}
        </button>
        {message && (
          <span className={message.includes('失败') ? 'text-error' : 'text-success'}>
            {message}
          </span>
        )}
      </div>
    </div>
  )
}
