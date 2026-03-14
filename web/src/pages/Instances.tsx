import { useState } from 'react'
import { Plus, Play, Square, Trash2, Edit2, Server } from 'lucide-react'
import { useStore } from '../store'
import { api } from '../hooks/api'
import type { Instance } from '../types'

export default function Instances() {
  const { instances, models, config, addInstance, updateInstance, removeInstance } = useStore()
  const [showModal, setShowModal] = useState(false)
  const [editingInstance, setEditingInstance] = useState<Instance | null>(null)
  const [formData, setFormData] = useState<Partial<Instance>>({
    name: '',
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
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 style={{ fontSize: 14, fontWeight: 'bold' }}>实例管理</h2>
        <button onClick={openCreateModal} className="btn">
          <Plus size={12} style={{ marginRight: 4 }} />
          新建实例
        </button>
      </div>

      {instances.length === 0 ? (
        <div className="panel" style={{ padding: 32, textAlign: 'center' }}>
          <Server size={32} style={{ marginBottom: 8, opacity: 0.5 }} />
          <p>暂无实例</p>
          <button onClick={openCreateModal} className="btn" style={{ marginTop: 8 }}>
            创建第一个实例
          </button>
        </div>
      ) : (
        <div className="panel" style={{ padding: 0 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr style={{ background: 'var(--win-gray)', textAlign: 'left' }}>
                <th style={{ padding: '4px 8px', border: '1px solid var(--win-gray-dark)' }}>名称</th>
                <th style={{ padding: '4px 8px', border: '1px solid var(--win-gray-dark)' }}>模型</th>
                <th style={{ padding: '4px 8px', border: '1px solid var(--win-gray-dark)' }}>端口</th>
                <th style={{ padding: '4px 8px', border: '1px solid var(--win-gray-dark)' }}>GPU层</th>
                <th style={{ padding: '4px 8px', border: '1px solid var(--win-gray-dark)' }}>Ctx</th>
                <th style={{ padding: '4px 8px', border: '1px solid var(--win-gray-dark)' }}>状态</th>
                <th style={{ padding: '4px 8px', border: '1px solid var(--win-gray-dark)', width: 120 }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {instances.map((instance) => (
                <tr key={instance.id}>
                  <td style={{ padding: '4px 8px', border: '1px solid var(--win-gray-dark)' }}>{instance.name}</td>
                  <td style={{ padding: '4px 8px', border: '1px solid var(--win-gray-dark)' }}>
                    {instance.model?.split('/').pop() || '未设置'}
                  </td>
                  <td style={{ padding: '4px 8px', border: '1px solid var(--win-gray-dark)' }}>{instance.port || instance.params?.port || 'N/A'}</td>
                  <td style={{ padding: '4px 8px', border: '1px solid var(--win-gray-dark)' }}>{instance.params?.ngl ?? 'N/A'}</td>
                  <td style={{ padding: '4px 8px', border: '1px solid var(--win-gray-dark)' }}>{instance.params?.context ?? 'N/A'}</td>
                  <td style={{ padding: '4px 8px', border: '1px solid var(--win-gray-dark)' }}>
                    <span className={`status-dot status-${instance.status}`} style={{ marginRight: 4 }} />
                    {instance.status}
                  </td>
                  <td style={{ padding: '4px 8px', border: '1px solid var(--win-gray-dark)' }}>
                    <div className="flex gap-1">
                      {instance.status === 'running' || instance.status === 'starting' ? (
                        <button onClick={() => handleStop(instance.id)} className="btn" style={{ padding: '2px 6px', minWidth: 'auto' }}>
                          <Square size={10} />
                        </button>
                      ) : (
                        <button onClick={() => handleStart(instance.id)} className="btn" style={{ padding: '2px 6px', minWidth: 'auto' }}>
                          <Play size={10} />
                        </button>
                      )}
                      <button onClick={() => openEditModal(instance)} className="btn" style={{ padding: '2px 6px', minWidth: 'auto' }}>
                        <Edit2 size={10} />
                      </button>
                      <button onClick={() => handleDelete(instance.id)} className="btn" style={{ padding: '2px 6px', minWidth: 'auto' }}>
                        <Trash2 size={10} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }} onClick={() => setShowModal(false)}>
          <div className="window" style={{ width: 500, maxHeight: '80vh' }} onClick={e => e.stopPropagation()}>
            <div className="title-bar">
              <span>{editingInstance ? '编辑实例' : '新建实例'}</span>
              <div className="title-bar-buttons">
                <div className="title-bar-btn" onClick={() => setShowModal(false)}>X</div>
              </div>
            </div>
            <div className="window-body">
              <div className="flex flex-col gap-4">
                <div>
                  <label className="text-sm" style={{ display: 'block', marginBottom: 4 }}>实例名称</label>
                  <input
                    type="text"
                    className="input"
                    style={{ width: '100%' }}
                    value={formData.name || ''}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-sm" style={{ display: 'block', marginBottom: 4 }}>llama-server路径</label>
                  <div className="input" style={{ background: 'var(--win-gray)', color: 'var(--win-gray-dark)', fontFamily: 'monospace', fontSize: 10 }}>
                    从设置中读取: {config?.paths.llama_bin || '未配置'}
                  </div>
                </div>
                <div>
                  <label className="text-sm" style={{ display: 'block', marginBottom: 4 }}>模型文件</label>
                  <select
                    className="input"
                    style={{ width: '100%' }}
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
                      <option key={m.path} value={m.path}>{m.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm" style={{ display: 'block', marginBottom: 4 }}>MMProj (可选)</label>
                  <select
                    className="input"
                    style={{ width: '100%' }}
                    value={formData.mmproj || ''}
                    onChange={e => setFormData({ ...formData, mmproj: e.target.value })}
                  >
                    <option value="">无</option>
                  </select>
                </div>
                <div className="panel" style={{ marginTop: 8 }}>
                  <h4 style={{ fontWeight: 'bold', marginBottom: 8 }}>启动参数</h4>
                  <div className="grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                    <div>
                      <label className="text-sm" style={{ display: 'block', marginBottom: 2 }}>GPU层</label>
                      <input
                        type="number"
                        className="input"
                        style={{ width: '100%' }}
                        value={formData.params?.ngl || 999}
                        onChange={e => setFormData({
                          ...formData,
                          params: { ...formData.params, ngl: parseInt(e.target.value) }
                        })}
                      />
                    </div>
                    <div>
                      <label className="text-sm" style={{ display: 'block', marginBottom: 2 }}>上下文</label>
                      <input
                        type="number"
                        className="input"
                        style={{ width: '100%' }}
                        value={formData.params?.context || 8192}
                        onChange={e => setFormData({
                          ...formData,
                          params: { ...formData.params, context: parseInt(e.target.value) }
                        })}
                      />
                    </div>
                    <div>
                      <label className="text-sm" style={{ display: 'block', marginBottom: 2 }}>端口</label>
                      <input
                        type="number"
                        className="input"
                        style={{ width: '100%' }}
                        value={formData.params?.port || 5000}
                        onChange={e => setFormData({
                          ...formData,
                          params: { ...formData.params, port: parseInt(e.target.value) }
                        })}
                      />
                    </div>
                    <div>
                      <label className="text-sm" style={{ display: 'block', marginBottom: 2 }}>线程</label>
                      <input
                        type="number"
                        className="input"
                        style={{ width: '100%' }}
                        value={formData.params?.threads || ''}
                        onChange={e => setFormData({
                          ...formData,
                          params: { ...formData.params, threads: parseInt(e.target.value) }
                        })}
                      />
                    </div>
                  </div>
                  <div className="flex gap-4" style={{ marginTop: 8 }}>
                    <label className="flex items-center gap-1">
                      <input
                        type="checkbox"
                        checked={formData.params?.flash_attention || false}
                        onChange={e => setFormData({
                          ...formData,
                          params: { ...formData.params, flash_attention: e.target.checked }
                        })}
                      />
                      <span className="text-sm">Flash Attention</span>
                    </label>
                    <label className="flex items-center gap-1">
                      <input
                        type="checkbox"
                        checked={formData.params?.mlock || false}
                        onChange={e => setFormData({
                          ...formData,
                          params: { ...formData.params, mlock: e.target.checked }
                        })}
                      />
                      <span className="text-sm">MLock</span>
                    </label>
                  </div>
                </div>
              </div>
              <div className="flex gap-2 justify-end" style={{ marginTop: 16 }}>
                <button onClick={() => setShowModal(false)} className="btn">取消</button>
                <button onClick={handleSubmit} className="btn btn-primary">保存</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
