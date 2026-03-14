import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { FolderOpen, RefreshCw, Search, HardDrive, Clock } from 'lucide-react'
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

  const container = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.05 } }
  }

  const item = {
    hidden: { opacity: 0, y: 10 },
    show: { opacity: 1, y: 0 }
  }

  return (
    <div className="space-y-6">
      {/* 标题栏 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">模型库</h1>
          <p className="text-gray-500 text-sm mt-1">
            扫描目录: {config?.paths.models_dir || '未设置'}
          </p>
        </div>
        <button
          onClick={scanModels}
          disabled={loading}
          className="btn-primary flex items-center gap-2"
        >
          <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          重新扫描
        </button>
      </div>

      {/* 搜索 */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={20} />
        <input
          type="text"
          className="input pl-12"
          placeholder="搜索模型..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* 模型列表 */}
      {filteredModels.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <FolderOpen size={48} className="mx-auto mb-4 text-gray-600" />
          <p className="text-gray-400">
            {config?.paths.models_dir ? '未找到模型文件' : '请先在设置中配置模型目录'}
          </p>
        </div>
      ) : (
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
        >
          {filteredModels.map((model) => (
            <motion.div
              key={model.path}
              variants={item}
              className="glass-card p-4 hover:border-primary/30"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium truncate" title={model.name}>
                    {model.name}
                  </h3>
                </div>
                {model.mmproj && (
                  <span className="px-2 py-0.5 bg-accent/20 text-accent text-xs rounded">
                    MMProj
                  </span>
                )}
              </div>

              <div className="space-y-2 text-sm text-gray-400">
                <div className="flex items-center gap-2">
                  <HardDrive size={14} />
                  <span>{formatSize(model.size)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock size={14} />
                  <span>{new Date(model.modified_time * 1000).toLocaleDateString()}</span>
                </div>
                <p className="text-xs text-gray-600 font-mono truncate" title={model.path}>
                  {model.path}
                </p>
              </div>

              {model.mmproj && (
                <div className="mt-3 pt-3 border-t border-white/10">
                  <p className="text-xs text-gray-500">MMProj:</p>
                  <p className="text-xs text-gray-600 font-mono truncate">
                    {model.mmproj}
                  </p>
                </div>
              )}
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  )
}

function formatSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let size = bytes
  let unitIndex = 0
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex++
  }
  return `${size.toFixed(1)} ${units[unitIndex]}`
}
