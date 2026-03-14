import { useState } from 'react'
import { Plus, Play, Square, Trash2, Edit2, Server } from 'lucide-react'
import { useStore } from '../store'
import { api } from '../hooks/api'
import type { Instance, ModelInfo } from '../types'
import Modal from '../components/Modal'
import { confirm } from '../components/ConfirmDialog'
import { error } from '../components/MessageDialog'

const DEFAULT_PARAMS = {
  ngl: 999,
  context: 8192,
  host: '0.0.0.0',
  port: 5000,
  flash_attention: true,
}

const DEFAULT_PROMPT_TEMPLATE = `You are a very strong reasoner and planner. Use these critical instructions to structure your plans, thoughts, and responses.

Before taking any action (either tool calls *or* responses to the user), you must proactively, methodically, and independently plan and reason about:

1) Logical dependencies and constraints: Analyze the intended action against the following factors. Resolve conflicts in order of importance:
1.1) Policy-based rules, mandatory prerequisites, and constraints.
1.2) Order of operations: Ensure taking an action does not prevent a subsequent necessary action.
1.2.1) The user may request actions in a random order, but you may need to reorder operations to maximize successful completion of the task.
1.3) Other prerequisites (information and/or actions needed).
1.4) Explicit user constraints or preferences.

2) Risk assessment: What are the consequences of taking the action? Will the new state cause any future issues?
2.1) For exploratory tasks (like searches), missing *optional* parameters is a LOW risk. **Prefer calling the tool with the available information over asking the user, unless** your \`Rule 1\` (Logical Dependencies) reasoning determines that optional information is required for a later step in your plan.

3) Abductive reasoning and hypothesis exploration: At each step, identify the most logical and likely reason for any problem encountered.
3.1) Look beyond immediate or obvious causes. The most likely reason may not be the simplest and may require deeper inference.
3.2) Hypotheses may require additional research. Each hypothesis may take multiple steps to test.
3.3) Prioritize hypotheses based on likelihood, but do not discard less likely ones prematurely. A low-probability event may still be the root cause.

4) Outcome evaluation and adaptability: Does the previous observation require any changes to your plan?
4.1) If your initial hypotheses are disproved, actively generate new ones based on the gathered information.

5) Information availability: Incorporate all applicable and alternative sources of information, including:
5.1) Using available tools and their capabilities
5.2) All policies, rules, checklists, and constraints
5.3) Previous observations and conversation history
5.4) Information only available by asking the user

6) Precision and Grounding: Ensure your reasoning is extremely precise and relevant to each exact ongoing situation.
6.1) Verify your claims by quoting the exact applicable information (including policies) when referring to them.

7) Completeness: Ensure that all requirements, constraints, options, and preferences are exhaustively incorporated into your plan.
7.1) Resolve conflicts using the order of importance in #1.
7.2) Avoid premature conclusions: There may be multiple relevant options for a given situation.
7.2.1) To check for whether an option is relevant, reason about all information sources from #5.
7.2.2) You may need to consult the user to even know whether something is applicable. Do not assume it is not applicable without checking.
7.3) Review applicable sources of information from #5 to confirm which are relevant to the current state.

8) Persistence and patience: Do not give up unless all the reasoning above is exhausted.
8.1) Don't be dissuaded by time taken or user frustration.
8.2) This persistence must be intelligent: On *transient* errors (e.g. please try again), you *must* retry **unless an explicit retry limit (e.g., max x tries) has been reached**. If such a limit is hit, you *must* stop. On *other* errors, you must change your strategy or arguments, not repeat the same failed call.

Reasoning: high`

export default function Instances() {
  const { instances, models, addInstance, updateInstance, removeInstance } = useStore()
  const [showModal, setShowModal] = useState(false)
  const [editingInstance, setEditingInstance] = useState<Instance | null>(null)
  const [selectedModel, setSelectedModel] = useState<ModelInfo | null>(null)
  const [formData, setFormData] = useState<Partial<Instance>>({
    name: '',
    model: '',
    mmproj: '',
    params: { ...DEFAULT_PARAMS },
    prompt_template: '',
  })

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

  const getStatusText = (status: string) => {
    switch (status) {
      case 'running': return '运行中'
      case 'starting': return '加载中'
      case 'stopped': return '已停止'
      case 'error': return '崩溃'
      default: return status
    }
  }

  const openCreateModal = () => {
    setEditingInstance(null)
    setSelectedModel(null)
    setFormData({
      name: '',
      model: '',
      mmproj: '',
      params: { ...DEFAULT_PARAMS },
      prompt_template: '',
    })
    setShowModal(true)
  }

  const openEditModal = (instance: Instance) => {
    setEditingInstance(instance)
    const model = models.find(m => m.path === instance.model) || null
    setSelectedModel(model)
    setFormData({ ...instance })
    setShowModal(true)
  }

  const handleModelChange = (modelPath: string) => {
    const model = models.find(m => m.path === modelPath) || null
    setSelectedModel(model)

    // Auto-fill name if empty
    const newName = formData.name || (model ? model.name.replace('.gguf', '') : '')
    const newMmproj = model?.mmproj || ''

    setFormData({
      ...formData,
      model: modelPath,
      mmproj: newMmproj,
      name: newName,
    })
  }

  const validateAndSubmit = async () => {
    // Validate instance name
    if (!formData.name || formData.name.trim() === '') {
      await error('实例名称不能为空')
      return
    }

    // Validate model
    if (!formData.model) {
      await error('请选择模型')
      return
    }

    // Validate and sanitize params
    const params = formData.params || {}
    const sanitizedParams = {
      ngl: Math.max(0, Math.floor(Number(params.ngl) || 999)),
      context: Math.max(1, Math.min(2147483647, Math.floor(Number(params.context) || 8192))),
      host: params.host || '0.0.0.0',
      port: Math.max(1, Math.min(65535, Math.floor(Number(params.port) || 5000))),
      threads: params.threads ? Math.max(1, Math.floor(Number(params.threads))) : undefined,
      flash_attention: Boolean(params.flash_attention),
      mlock: Boolean(params.mlock),
      'no-mmap': Boolean(params['no-mmap']),
      batch_size: params.batch_size ? Math.max(1, Math.floor(Number(params.batch_size))) : undefined,
    }

    const finalData = { ...formData, params: sanitizedParams }

    try {
      if (editingInstance) {
        await api.updateInstance(editingInstance.id, finalData)
        updateInstance(editingInstance.id, finalData)
        // If instance was running, ask to restart
        if (editingInstance.status === 'running') {
          if (await confirm('实例正在运行，修改已保存。是否重新启动以应用更改？')) {
            await api.stopInstance(editingInstance.id)
            await api.startInstance(editingInstance.id)
            updateInstance(editingInstance.id, { status: 'starting' })
          }
        }
      } else {
        const created = await api.createInstance(finalData)
        addInstance(created)
        setShowModal(false)
        // Ask to start the new instance
        if (await confirm('实例创建成功，是否立即启动？')) {
          await api.startInstance(created.id)
          updateInstance(created.id, { status: 'starting' })
        }
        return
      }
      setShowModal(false)
    } catch (e) {
      await error(`操作失败: ${e}`)
    }
  }

  const handleDelete = async (id: string) => {
    if (!await confirm('确定要删除这个实例吗?')) return
    try {
      await api.deleteInstance(id)
      removeInstance(id)
    } catch (e) {
      await error(`删除失败: ${e}`)
    }
  }

  const handleStart = async (id: string) => {
    try {
      updateInstance(id, { status: 'starting' })
      await api.startInstance(id)
      updateInstance(id, { status: 'running' })
    } catch (e) {
      updateInstance(id, { status: 'error' })
      await error(`启动失败: ${e}`)
    }
  }

  const handleStop = async (id: string) => {
    try {
      await api.stopInstance(id)
      updateInstance(id, { status: 'stopped' })
    } catch (e) {
      await error(`停止失败: ${e}`)
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
          <div className="flex items-center justify-center" style={{ marginBottom: 8 }}>
            <Server size={32} style={{ opacity: 0.5 }} />
            <span style={{ marginLeft: 8 }}>暂无实例</span>
          </div>
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
                    {getStatusText(instance.status)}
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
      <Modal title={editingInstance ? '编辑实例' : '新建实例'} show={showModal} onClose={() => setShowModal(false)} width={500}>
        <div className="flex flex-col gap-4">
          <div>
            <label className="text-sm" style={{ display: 'block', marginBottom: 4 }}>实例名称 *</label>
            <input
              type="text"
              className="input"
              style={{ width: '100%' }}
              value={formData.name || ''}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              placeholder="必填"
            />
          </div>

          <div>
            <label className="text-sm" style={{ display: 'block', marginBottom: 4 }}>模型文件 *</label>
            <select
              className="input"
              style={{ width: '100%' }}
              value={formData.model || ''}
              onChange={e => handleModelChange(e.target.value)}
            >
              <option value="">选择模型...</option>
              {models.map(m => (
                <option key={m.path} value={m.path}>{m.name} ({formatSize(m.size)})</option>
              ))}
            </select>
          </div>

          {/* Model Info */}
          {selectedModel && (
            <div className="panel" style={{ padding: 8 }}>
              <div style={{ fontWeight: 'bold', marginBottom: 4 }}>模型信息</div>
              <div className="grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)', gap: 4, fontSize: 10 }}>
                <div>大小: {formatSize(selectedModel.size)}</div>
                <div>路径: {selectedModel.path}</div>
                {selectedModel.mmproj && <div>MMProj: 已配置</div>}
              </div>
            </div>
          )}

          <div>
            <label className="text-sm" style={{ display: 'block', marginBottom: 4 }}>MMProj (可选)</label>
            <select
              className="input"
              style={{ width: '100%' }}
              value={formData.mmproj || ''}
              onChange={e => setFormData({ ...formData, mmproj: e.target.value })}
            >
              <option value="">无</option>
              {models.filter(m => m.mmproj || m.path.includes('mmproj')).map(m => (
                <option key={m.path} value={m.path}>{m.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm" style={{ display: 'block', marginBottom: 4 }}>提示词模板 (可选)</label>
            <select
              className="input"
              style={{ width: '100%' }}
              value={formData.prompt_template || ''}
              onChange={e => setFormData({ ...formData, prompt_template: e.target.value })}
            >
              <option value="">无</option>
              <option value={DEFAULT_PROMPT_TEMPLATE}>默认提示词 (强推理模型)</option>
            </select>
            {formData.prompt_template && (
              <div className="panel" style={{ marginTop: 8, padding: 8, maxHeight: 120, overflow: 'auto', fontSize: 10 }}>
                <div style={{ fontWeight: 'bold', marginBottom: 4 }}>模板预览:</div>
                <pre style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{formData.prompt_template.slice(0, 500)}{formData.prompt_template.length > 500 ? '...' : ''}</pre>
              </div>
            )}
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
                  value={formData.params?.ngl ?? 999}
                  onChange={e => setFormData({
                    ...formData,
                    params: { ...formData.params, ngl: parseInt(e.target.value) || 999 }
                  })}
                />
              </div>
              <div>
                <label className="text-sm" style={{ display: 'block', marginBottom: 2 }}>上下文</label>
                <input
                  type="number"
                  className="input"
                  style={{ width: '100%' }}
                  value={formData.params?.context ?? 8192}
                  onChange={e => setFormData({
                    ...formData,
                    params: { ...formData.params, context: parseInt(e.target.value) || 8192 }
                  })}
                />
              </div>
              <div>
                <label className="text-sm" style={{ display: 'block', marginBottom: 2 }}>端口</label>
                <input
                  type="number"
                  className="input"
                  style={{ width: '100%' }}
                  value={formData.params?.port ?? 5000}
                  onChange={e => setFormData({
                    ...formData,
                    params: { ...formData.params, port: parseInt(e.target.value) || 5000 }
                  })}
                />
              </div>
              <div>
                <label className="text-sm" style={{ display: 'block', marginBottom: 2 }}>线程</label>
                <input
                  type="number"
                  className="input"
                  style={{ width: '100%' }}
                  value={formData.params?.threads ?? ''}
                  onChange={e => setFormData({
                    ...formData,
                    params: { ...formData.params, threads: parseInt(e.target.value) || undefined }
                  })}
                  placeholder="自动"
                />
              </div>
            </div>
            <div className="flex gap-4" style={{ marginTop: 8 }}>
              <label className="flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={formData.params?.flash_attention ?? true}
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
                  checked={formData.params?.mlock ?? false}
                  onChange={e => setFormData({
                    ...formData,
                    params: { ...formData.params, mlock: e.target.checked }
                  })}
                />
                <span className="text-sm">MLock</span>
              </label>
              <label className="flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={formData.params?.['no-mmap'] ?? false}
                  onChange={e => setFormData({
                    ...formData,
                    params: { ...formData.params, 'no-mmap': e.target.checked }
                  })}
                />
                <span className="text-sm">No-MMAP</span>
              </label>
            </div>
          </div>
        </div>
        <div className="flex gap-2 justify-end mt-4">
          <button onClick={() => setShowModal(false)} className="btn">取消</button>
          <button onClick={validateAndSubmit} className="btn btn-primary">保存</button>
        </div>
      </Modal>
    </div>
  )
}
