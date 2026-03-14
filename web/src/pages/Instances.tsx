import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Play, Square, Trash2, Edit2, Server, Settings, X, Check } from 'lucide-react'
import { useStore } from '../store'
import { api } from '../hooks/api'
import type { Instance } from '../types'

export default function Instances() {
  const { instances, models, config, addInstance, updateInstance, removeInstance } = useStore()
  const [showModal, setShowModal] = useState(false)
  const [editingInstance, setEditingInstance] = useState<Instance | null>(null)
  const [formData, setFormData] = useState<Partial<Instance>>({
    name: '',
    llama_bin: '',
    model: '',
    mmproj: '',
    params: {
      ngl: 999,
      context: 8192,
      host: '0.0.0.0',
      port: 5000,
      flash_attention: true,
    },
    prompt_template: '',
  })

  const openCreateModal = () => {
    setEditingInstance(null)
    setFormData({
      name: '',
      llama_bin: config?.paths.llama_bin || '',
      model: '',
      mmproj: '',
      params: {
        ngl: 999,
        context: 8192,
        host: '0.0.0.0',
        port: 5000,
        flash_attention: true,
      },
      prompt_template: '',
    })
    setShowModal(true)
  }

  const openEditModal = (instance: Instance) => {
    setEditingInstance(instance)
    setFormData({ ...instance })
    setShowModal(true)
  }

  const handleSubmit = async () => {
    try {
      if (editingInstance) {
        await api.updateInstance(editingInstance.id, formData)
        updateInstance(editingInstance.id, formData)
      } else {
        const created = await api.createInstance(formData)
        addInstance(created)
      }
      setShowModal(false)
    } catch (e) {
      alert(`操作失败: ${e}`)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这个实例吗?')) return
    try {
      await api.deleteInstance(id)
      removeInstance(id)
    } catch (e) {
      alert(`删除失败: ${e}`)
    }
  }

  const handleStart = async (id: string) => {
    try {
      updateInstance(id, { status: 'starting' })
      await api.startInstance(id)
      updateInstance(id, { status: 'running' })
    } catch (e) {
      updateInstance(id, { status: 'error' })
      alert(`启动失败: ${e}`)
    }
  }

  const handleStop = async (id: string) => {
    try {
      await api.stopInstance(id)
      updateInstance(id, { status: 'stopped' })
    } catch (e) {
      alert(`停止失败: ${e}`)
    }
  }

  return (
    <div className="space-y-6">
      {/* 标题栏 */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">实例管理</h1>
        <button onClick={openCreateModal} className="btn-primary flex items-center gap-2">
          <Plus size={20} />
          新建实例
        </button>
      </div>

      {/* 实例列表 */}
      {instances.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <Server size={48} className="mx-auto mb-4 text-gray-600" />
          <p className="text-gray-400 mb-4">暂无实例</p>
          <button onClick={openCreateModal} className="btn-primary">
            创建第一个实例
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {instances.map((instance, idx) => (
            <motion.div
              key={instance.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="glass-card p-5"
            >
              {/* 头部 */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <span className={`status-dot status-${instance.status}`} />
                  <span className="font-semibold">{instance.name}</span>
                </div>
                <div className="flex items-center gap-1">
                  {instance.status === 'running' || instance.status === 'starting' ? (
                    <button
                      onClick={() => handleStop(instance.id)}
                      className="p-2 rounded-lg hover:bg-white/10 text-error"
                    >
                      <Square size={18} />
                    </button>
                  ) : (
                    <button
                      onClick={() => handleStart(instance.id)}
                      className="p-2 rounded-lg hover:bg-white/10 text-success"
                    >
                      <Play size={18} />
                    </button>
                  )}
                  <button
                    onClick={() => openEditModal(instance)}
                    className="p-2 rounded-lg hover:bg-white/10"
                  >
                    <Edit2 size={18} />
                  </button>
                  <button
                    onClick={() => handleDelete(instance.id)}
                    className="p-2 rounded-lg hover:bg-white/10 text-error"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>

              {/* 信息 */}
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-gray-400">
                  <span className="text-gray-600">模型:</span>
                  <span className="truncate">{instance.model?.split('/').pop() || '未设置'}</span>
                </div>
                {instance.mmproj && (
                  <div className="flex items-center gap-2 text-gray-400">
                    <span className="text-gray-600">MMProj:</span>
                    <span className="truncate">{instance.mmproj.split('/').pop()}</span>
                  </div>
                )}
                <div className="flex items-center gap-4 mt-3 pt-3 border-t border-white/10">
                  <span className="text-gray-500">端口: {instance.port || instance.params?.port || 'N/A'}</span>
                  <span className="text-gray-500">GPU层: {instance.params?.ngl ?? 'N/A'}</span>
                  <span className="text-gray-500">Ctx: {instance.params?.context ?? 'N/A'}</span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* 创建/编辑弹窗 */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setShowModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="glass-card w-full max-w-2xl max-h-[90vh] overflow-auto p-6"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold">
                  {editingInstance ? '编辑实例' : '新建实例'}
                </h2>
                <button onClick={() => setShowModal(false)} className="p-2 hover:bg-white/10 rounded-lg">
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-4">
                {/* 基本信息 */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">实例名称</label>
                    <input
                      type="text"
                      className="input"
                      value={formData.name || ''}
                      onChange={e => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Qwen开发环境"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">llama-server路径</label>
                    <input
                      type="text"
                      className="input font-mono text-sm"
                      value={formData.llama_bin || ''}
                      onChange={e => setFormData({ ...formData, llama_bin: e.target.value })}
                      placeholder={config?.paths.llama_bin || '/path/to/llama-server'}
                    />
                  </div>
                </div>

                {/* 模型选择 */}
                <div>
                  <label className="block text-sm text-gray-400 mb-2">模型文件</label>
                  <select
                    className="input"
                    value={formData.model || ''}
                    onChange={e => {
                      const model = models.find(m => m.path === e.target.value)
                      setFormData({
                        ...formData,
                        model: e.target.value,
                        mmproj: model?.mmproj || '',
                      })
                    }}
                  >
                    <option value="">选择模型...</option>
                    {models.map(m => (
                      <option key={m.path} value={m.path}>
                        {m.name} ({formatSize(m.size)})
                      </option>
                    ))}
                  </select>
                </div>

                {/* MMProj */}
                <div>
                  <label className="block text-sm text-gray-400 mb-2">MMProj文件 (可选)</label>
                  <select
                    className="input"
                    value={formData.mmproj || ''}
                    onChange={e => setFormData({ ...formData, mmproj: e.target.value })}
                  >
                    <option value="">无</option>
                    {models.filter(m => m.mmproj || m.path.includes('mmproj')).map(m => (
                      <option key={m.path} value={m.path}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 参数配置 */}
                <div className="border-t border-white/10 pt-4 mt-4">
                  <h3 className="font-medium mb-4 flex items-center gap-2">
                    <Settings size={18} />
                    启动参数
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">GPU层数 (ngl)</label>
                      <input
                        type="number"
                        className="input"
                        value={formData.params?.ngl || 999}
                        onChange={e => setFormData({
                          ...formData,
                          params: { ...formData.params, ngl: parseInt(e.target.value) }
                        })}
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">上下文长度</label>
                      <input
                        type="number"
                        className="input"
                        value={formData.params?.context || 8192}
                        onChange={e => setFormData({
                          ...formData,
                          params: { ...formData.params, context: parseInt(e.target.value) }
                        })}
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">端口</label>
                      <input
                        type="number"
                        className="input"
                        value={formData.params?.port || 5000}
                        onChange={e => setFormData({
                          ...formData,
                          params: { ...formData.params, port: parseInt(e.target.value) }
                        })}
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">线程数</label>
                      <input
                        type="number"
                        className="input"
                        value={formData.params?.threads || ''}
                        onChange={e => setFormData({
                          ...formData,
                          params: { ...formData.params, threads: parseInt(e.target.value) }
                        })}
                        placeholder="自动"
                      />
                    </div>
                  </div>

                  {/* 开关选项 */}
                  <div className="flex gap-6 mt-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.params?.flash_attention || false}
                        onChange={e => setFormData({
                          ...formData,
                          params: { ...formData.params, flash_attention: e.target.checked }
                        })}
                        className="w-4 h-4 rounded accent-primary"
                      />
                      <span className="text-sm">Flash Attention (-fa)</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.params?.mlock || false}
                        onChange={e => setFormData({
                          ...formData,
                          params: { ...formData.params, mlock: e.target.checked }
                        })}
                        className="w-4 h-4 rounded accent-primary"
                      />
                      <span className="text-sm">MLock (-mlock)</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.params?.['no-mmap'] || false}
                        onChange={e => setFormData({
                          ...formData,
                          params: { ...formData.params, 'no-mmap': e.target.checked }
                        })}
                        className="w-4 h-4 rounded accent-primary"
                      />
                      <span className="text-sm">No-MMAP</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* 提交按钮 */}
              <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-white/10">
                <button onClick={() => setShowModal(false)} className="btn-secondary">
                  取消
                </button>
                <button onClick={handleSubmit} className="btn-primary flex items-center gap-2">
                  <Check size={18} />
                  {editingInstance ? '保存' : '创建'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
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
