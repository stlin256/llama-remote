import { useState } from 'react'
import { Plus, Play, Square, Trash2, Edit2, Server, AlertCircle } from 'lucide-react'
import { useStore } from '../store'
import { api } from '../hooks/api'
import type { Instance, ModelInfo } from '../types'
import Modal from '../components/Modal'
import { confirm } from '../components/ConfirmDialog'
import { error as showError } from '../components/MessageDialog'
import { useTranslation } from '../i18n/useTranslation'
import { useIsMobile } from '../hooks/useMediaQuery'
import { formatSize, DEFAULT_PROMPT_TEMPLATE, DEFAULT_GPU_LAYERS, DEFAULT_CONTEXT, DEFAULT_PORT } from '../utils'

const DEFAULT_PARAMS = {
  ngl: DEFAULT_GPU_LAYERS,
  context: DEFAULT_CONTEXT,
  host: '0.0.0.0',
  port: DEFAULT_PORT,
  flash_attention: true,
}

export default function Instances() {
  const { instances, models, prompts, addInstance, updateInstance, removeInstance, instanceProgress, instanceErrors } = useStore()
  const { t } = useTranslation()
  const isMobile = useIsMobile()
  const [showModal, setShowModal] = useState(false)
  const [editingInstance, setEditingInstance] = useState<Instance | null>(null)
  const [selectedModel, setSelectedModel] = useState<ModelInfo | null>(null)
  const [showErrorDialog, setShowErrorDialog] = useState(false)
  const [currentError, setCurrentError] = useState('')
  const [formData, setFormData] = useState<Partial<Instance>>({
    name: '',
    model: '',
    mmproj: '',
    params: { ...DEFAULT_PARAMS },
    prompt_template: '',
  })

  const getStatusText = (status: string) => {
    switch (status) {
      case 'running': return t('running')
      case 'starting': return t('loading')
      case 'stopped': return t('stopped')
      case 'error': return t('crashed')
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

    // Default ngl and context from model
    const defaultNgl = model?.block_count ?? 999
    const defaultContext = model?.context_length ?? 8192

    setFormData({
      ...formData,
      model: modelPath,
      mmproj: newMmproj,
      name: newName,
      params: {
        ...formData.params,
        ngl: defaultNgl,
        context: defaultContext,
      },
    })
  }

  const validateAndSubmit = async () => {
    // Validate instance name
    if (!formData.name || formData.name.trim() === '') {
      await showError(t('instanceNameRequired'))
      return
    }

    // Validate model
    if (!formData.model) {
      await showError(t('pleaseSelectModel'))
      return
    }

    // Validate and sanitize params
    const params = formData.params || {}
    // Use model's max values as defaults if params are empty
    const defaultNgl = selectedModel?.block_count ?? 999
    const defaultContext = selectedModel?.context_length ?? 8192

    const sanitizedParams = {
      ngl: params.ngl === undefined ? defaultNgl : Math.max(0, Math.floor(Number(params.ngl) || defaultNgl)),
      context: params.context === undefined ? defaultContext : Math.max(1, Math.min(2147483647, Math.floor(Number(params.context) || defaultContext))),
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
          if (await confirm(t('instanceRunningRestart'))) {
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
        if (await confirm(t('instanceCreatedStart'))) {
          await api.startInstance(created.id)
          updateInstance(created.id, { status: 'starting' })
        }
        return
      }
      setShowModal(false)
    } catch (e) {
      await showError(`${t('operationFailed')}: ${e}`)
    }
  }

  const handleDelete = async (id: string) => {
    if (!await confirm(t('confirmDeleteInstance'))) return
    try {
      await api.deleteInstance(id)
      removeInstance(id)
    } catch (e) {
      await showError(`${t('deleteFailed')}: ${e}`)
    }
  }

  const handleStart = async (id: string) => {
    try {
      updateInstance(id, { status: 'starting' })
      await api.startInstance(id)
      updateInstance(id, { status: 'running' })
    } catch (e) {
      updateInstance(id, { status: 'error' })
      await showError(`${t('startFailed')}: ${e}`)
    }
  }

  const handleStop = async (id: string) => {
    try {
      await api.stopInstance(id)
      updateInstance(id, { status: 'stopped' })
    } catch (e) {
      await showError(`${t('stopFailed')}: ${e}`)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 style={{ fontSize: 14, fontWeight: 'bold' }}>{t('instanceManagement')}</h2>
        <button onClick={openCreateModal} className="btn">
          <Plus size={12} style={{ marginRight: 4 }} />
          {t('createInstance')}
        </button>
      </div>

      {instances.length === 0 ? (
        <div className="panel" style={{ padding: 32, textAlign: 'center' }}>
          <div className="flex items-center justify-center" style={{ marginBottom: 8 }}>
            <Server size={32} style={{ opacity: 0.5 }} />
            <span style={{ marginLeft: 8 }}>{t('noInstancesYet')}</span>
          </div>
          <button onClick={openCreateModal} className="btn" style={{ marginTop: 8 }}>
            {t('createFirstInstance')}
          </button>
        </div>
      ) : (
        <div className="panel" style={{ padding: 0, overflowX: 'auto' }}>
          <table style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: isMobile ? 10 : 11,
            minWidth: isMobile ? 600 : 'auto'
          }}>
            <thead>
              <tr style={{ background: 'var(--win-gray)', textAlign: 'left' }}>
                <th style={{ padding: '4px 8px', border: '1px solid var(--win-gray-dark)' }}>{t('name')}</th>
                <th style={{ padding: '4px 8px', border: '1px solid var(--win-gray-dark)' }}>{t('model')}</th>
                <th style={{ padding: '4px 8px', border: '1px solid var(--win-gray-dark)' }}>{t('port')}</th>
                <th style={{ padding: '4px 8px', border: '1px solid var(--win-gray-dark)' }}>GPU</th>
                <th style={{ padding: '4px 8px', border: '1px solid var(--win-gray-dark)' }}>Ctx</th>
                <th style={{ padding: '4px 8px', border: '1px solid var(--win-gray-dark)' }}>MM</th>
                <th style={{ padding: '4px 8px', border: '1px solid var(--win-gray-dark)' }}>{t('status')}</th>
                <th style={{ padding: '4px 8px', border: '1px solid var(--win-gray-dark)', width: isMobile ? 100 : 120 }}>{t('actions')}</th>
              </tr>
            </thead>
            <tbody>
              {instances.map((instance) => (
                <tr key={instance.id}>
                  <td style={{ padding: '4px 8px', border: '1px solid var(--win-gray-dark)' }}>{instance.name}</td>
                  <td style={{ padding: '4px 8px', border: '1px solid var(--win-gray-dark)' }}>
                    {instance.model?.split('/').pop() || t('notSet')}
                  </td>
                  <td style={{ padding: '4px 8px', border: '1px solid var(--win-gray-dark)' }}>{instance.port || instance.params?.port || 'N/A'}</td>
                  <td style={{ padding: '4px 8px', border: '1px solid var(--win-gray-dark)' }}>{instance.params?.ngl ?? 'N/A'}</td>
                  <td style={{ padding: '4px 8px', border: '1px solid var(--win-gray-dark)' }}>{instance.params?.context ? Math.round(instance.params.context / 1024) + 'k' : 'N/A'}</td>
                  <td style={{ padding: '4px 8px', border: '1px solid var(--win-gray-dark)' }}>
                    {instance.mmproj ? (
                      <span style={{ background: 'var(--win-teal)', color: 'white', padding: '1px 4px', fontSize: 9 }}>
                        {instance.mmproj.split('/').pop()?.slice(0, 8)}
                      </span>
                    ) : '-'}
                  </td>
                  <td style={{ padding: '4px 8px', border: '1px solid var(--win-gray-dark)' }}>
                    <span className={`status-dot status-${instance.status}`} style={{ marginRight: 4 }} />
                    {getStatusText(instance.status)}
                    {instance.status === 'error' && instanceErrors[instance.id] && (
                      <button
                        onClick={() => { setCurrentError(instanceErrors[instance.id]); setShowErrorDialog(true) }}
                        className="btn"
                        style={{ marginLeft: 8, padding: '1px 4px', minWidth: 'auto', background: '#aa0000', color: 'white' }}
                        title={t('viewError') || 'View Error'}
                      >
                        <AlertCircle size={10} />
                      </button>
                    )}
                    {(instance.status === 'starting' || instance.status === 'loading') && instanceProgress[instance.id] && (
                      <span style={{ marginLeft: 8, fontSize: 10, color: 'var(--win-gray-dark)' }}>
                        {instanceProgress[instance.id].message}
                      </span>
                    )}
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
      <Modal title={editingInstance ? t('editInstance') : t('createInstance')} show={showModal} onClose={() => setShowModal(false)} width={isMobile ? Math.min(window.innerWidth - 32, 400) : 500}>
        <div className="flex flex-col gap-4">
          <div>
            <label className="text-sm" style={{ display: 'block', marginBottom: 4 }}>{t('instanceName')} *</label>
            <input
              type="text"
              className="input"
              style={{ width: '100%' }}
              value={formData.name || ''}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              placeholder={t('required')}
            />
          </div>

          <div>
            <label className="text-sm" style={{ display: 'block', marginBottom: 4 }}>{t('modelFile')} *</label>
            <select
              className="input"
              style={{ width: '100%' }}
              value={formData.model || ''}
              onChange={e => handleModelChange(e.target.value)}
            >
              <option value="">{t('selectModel')}</option>
              {models.map(m => (
                <option key={m.path} value={m.path}>{m.name} ({formatSize(m.size)})</option>
              ))}
            </select>
          </div>

          {/* Model Info - Win98 Style */}
          {selectedModel && (
            <div style={{
              border: '2px solid',
              borderColor: '#fff #808080 #808080 #fff',
              background: '#c0c0c0',
              padding: 8,
              marginTop: 8
            }}>
              {/* Title bar */}
              <div style={{
                background: 'linear-gradient(90deg, #000080, #1084d0)',
                color: 'white',
                padding: '2px 4px',
                fontSize: 11,
                fontWeight: 'bold',
                marginBottom: 8,
                fontFamily: 'Tahoma, sans-serif'
              }}>
                {selectedModel.model_name || selectedModel.name}
              </div>

              {/* Specs grid */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: 4,
                fontSize: 11,
                fontFamily: 'Tahoma, sans-serif'
              }}>
                {selectedModel.architecture && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ color: '#000080', fontWeight: 'bold' }}>{t('arch')}:</span>
                    <span>{selectedModel.architecture}</span>
                  </div>
                )}
                {selectedModel.quantization && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ color: '#000080', fontWeight: 'bold' }}>{t('quant')}:</span>
                    <span style={{
                      background: '#000080',
                      color: 'white',
                      padding: '0 4px'
                    }}>{selectedModel.quantization}</span>
                  </div>
                )}
                {selectedModel.context_length && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ color: '#000080', fontWeight: 'bold' }}>Context:</span>
                    <span>{selectedModel.context_length.toLocaleString()}</span>
                  </div>
                )}
                {selectedModel.embedding_length && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ color: '#000080', fontWeight: 'bold' }}>{t('embed')}:</span>
                    <span>{selectedModel.embedding_length}</span>
                  </div>
                )}
                {selectedModel.block_count && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ color: '#000080', fontWeight: 'bold' }}>{t('blocks')}:</span>
                    <span>{selectedModel.block_count}</span>
                  </div>
                )}
                {selectedModel.attention_heads && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ color: '#000080', fontWeight: 'bold' }}>{t('heads')}:</span>
                    <span>{selectedModel.attention_heads}</span>
                  </div>
                )}
                {selectedModel.vocabulary_size && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ color: '#000080', fontWeight: 'bold' }}>{t('vocab')}:</span>
                    <span>{selectedModel.vocabulary_size.toLocaleString()}</span>
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ color: '#000080', fontWeight: 'bold' }}>Size:</span>
                  <span>{formatSize(selectedModel.size)}</span>
                </div>
              </div>

              {/* Path */}
              <div style={{
                marginTop: 8,
                padding: 4,
                background: '#fff',
                border: '1px solid',
                borderColor: '#808080 #fff #fff #808080',
                fontSize: 10,
                fontFamily: 'monospace',
                color: '#000'
              }}>
                {selectedModel.path}
              </div>

              {/* MMproj indicator */}
              <div style={{
                marginTop: 8,
                padding: 4,
                background: '#c0c0c0',
                border: '2px solid',
                borderColor: '#fff #808080 #808080 #fff',
                fontSize: 10,
                fontFamily: 'Tahoma, sans-serif',
                display: 'flex',
                alignItems: 'center',
                gap: 4
              }}>
                <span style={{
                  background: selectedModel.mmproj ? '#00aa00' : '#aa0000',
                  color: 'white',
                  padding: '0 3px',
                  fontSize: 9,
                  fontFamily: 'Marlett, Wingdings, sans-serif'
                }}>
                  {selectedModel.mmproj ? '✓' : '✗'}
                </span>
                <span>MMProj</span>
              </div>
            </div>
          )}

          <div>
            <label className="text-sm" style={{ display: 'block', marginBottom: 4 }}>{t('mmprojOptional')}</label>
            <select
              className="input"
              style={{ width: '100%' }}
              value={formData.mmproj || ''}
              onChange={e => setFormData({ ...formData, mmproj: e.target.value })}
            >
              <option value="">{t('noMmproj')}</option>
              {models.flatMap(m => {
                // 显示所有模型，如果有mmproj则显示
                return [
                  <option key={m.name + '-none'} value="">{t('noMmproj')} - {m.name}</option>,
                  ...(m.mmproj ? m.mmproj.split(',').map((mp: string) => (
                    <option key={mp} value={mp}>{m.name} - {mp.split('/').pop()}</option>
                  )) : [])
                ]
              })}
            </select>
          </div>

          <div>
            <label className="text-sm" style={{ display: 'block', marginBottom: 4 }}>{t('promptTemplateOptional')}</label>
            <select
              className="input"
              style={{ width: '100%' }}
              value={formData.prompt_template || ''}
              onChange={e => setFormData({ ...formData, prompt_template: e.target.value })}
            >
              <option value="">{t('noPromptTemplate')}</option>
              <option value={DEFAULT_PROMPT_TEMPLATE}>{t('defaultPromptTemplate')}</option>
              {prompts.map((p) => (
                <option key={p.name} value={p.content}>{p.name}</option>
              ))}
            </select>
            {formData.prompt_template && (
              <div className="panel" style={{ marginTop: 8, padding: 8, maxHeight: 120, overflow: 'auto', fontSize: 10 }}>
                <div style={{ fontWeight: 'bold', marginBottom: 4 }}>{t('templatePreview')}:</div>
                <pre style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{formData.prompt_template.slice(0, 500)}{formData.prompt_template.length > 500 ? '...' : ''}</pre>
              </div>
            )}
          </div>

          <div className="panel" style={{ marginTop: 8 }}>
            <h4 style={{ fontWeight: 'bold', marginBottom: 8 }}>{t('startupParams')}</h4>
            <div className="grid" style={{
              gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
              gap: isMobile ? 6 : 8
            }}>
              <div>
                <label className="text-sm" style={{ display: 'block', marginBottom: 2 }}>{t('gpuLayers')}</label>
                <input
                  type="number"
                  className="input"
                  style={{
                    width: '100%',
                    background: formData.params?.ngl === undefined ? '#e0e0e0' : '#fff',
                    color: formData.params?.ngl === undefined ? '#808080' : '#000'
                  }}
                  value={formData.params?.ngl ?? ''}
                  placeholder={selectedModel?.block_count?.toString() || '999'}
                  onChange={e => setFormData({
                    ...formData,
                    params: { ...formData.params, ngl: e.target.value === '' ? undefined : parseInt(e.target.value) }
                  })}
                />
              </div>
              <div>
                <label className="text-sm" style={{ display: 'block', marginBottom: 2 }}>{t('context')}</label>
                <input
                  type="number"
                  className="input"
                  style={{
                    width: '100%',
                    background: formData.params?.context === undefined ? '#e0e0e0' : '#fff',
                    color: formData.params?.context === undefined ? '#808080' : '#000'
                  }}
                  value={formData.params?.context ?? ''}
                  placeholder={selectedModel?.context_length?.toString() || '8192'}
                  onChange={e => setFormData({
                    ...formData,
                    params: { ...formData.params, context: e.target.value === '' ? undefined : parseInt(e.target.value) }
                  })}
                />
              </div>
              <div>
                <label className="text-sm" style={{ display: 'block', marginBottom: 2 }}>{t('port')}</label>
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
                <label className="text-sm" style={{ display: 'block', marginBottom: 2 }}>{t('threads')}</label>
                <input
                  type="number"
                  className="input"
                  style={{ width: '100%' }}
                  value={formData.params?.threads ?? ''}
                  onChange={e => setFormData({
                    ...formData,
                    params: { ...formData.params, threads: parseInt(e.target.value) || undefined }
                  })}
                  placeholder={t('auto')}
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
          <button onClick={() => setShowModal(false)} className="btn">{t('cancel')}</button>
          <button onClick={validateAndSubmit} className="btn btn-primary">{t('save')}</button>
        </div>
      </Modal>

      {/* Error Details Dialog */}
      <Modal title={t('errorDetails') || 'Error Details'} show={showErrorDialog} onClose={() => setShowErrorDialog(false)} width={600}>
        <div style={{ fontSize: 11, fontFamily: 'monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-all', maxHeight: 300, overflow: 'auto' }}>
          {currentError}
        </div>
        <div className="flex gap-2 justify-end mt-4">
          <button onClick={() => setShowErrorDialog(false)} className="btn">{t('close')}</button>
        </div>
      </Modal>
    </div>
  )
}
