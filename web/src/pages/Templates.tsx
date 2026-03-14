import { useState } from 'react'
import { Plus, Trash2, FileText, Settings } from 'lucide-react'
import { useStore } from '../store'
import { api } from '../hooks/api'
import type { Template, PromptTemplate } from '../types'

export default function Templates() {
  const { templates, prompts, setTemplates, setPrompts } = useStore()
  const [activeTab, setActiveTab] = useState<'params' | 'prompts'>('params')
  const [showTemplateModal, setShowTemplateModal] = useState(false)
  const [showPromptModal, setShowPromptModal] = useState(false)
  const [templateForm, setTemplateForm] = useState<Partial<Template>>({
    name: '',
    params: { ngl: 999, context: 8192 },
  })
  const [promptForm, setPromptForm] = useState<Partial<PromptTemplate>>({
    name: '',
    content: '',
  })

  const handleSaveTemplate = async () => {
    try {
      await api.saveTemplate(templateForm)
      const result = await api.getTemplates()
      setTemplates(result.templates || [])
      setShowTemplateModal(false)
    } catch (e) {
      alert(`保存失败: ${e}`)
    }
  }

  const handleDeleteTemplate = async (name: string) => {
    if (!confirm(`删除模板 "${name}"?`)) return
    try {
      await api.deleteTemplate(name)
      const result = await api.getTemplates()
      setTemplates(result.templates || [])
    } catch (e) {
      alert(`删除失败: ${e}`)
    }
  }

  const handleSavePrompt = async () => {
    try {
      await api.savePrompt(promptForm)
      const result = await api.getPrompts()
      setPrompts(result.prompts || [])
      setShowPromptModal(false)
    } catch (e) {
      alert(`保存失败: ${e}`)
    }
  }

  const handleDeletePrompt = async (name: string) => {
    if (!confirm(`删除提示词模板 "${name}"?`)) return
    try {
      await api.deletePrompt(name)
      const result = await api.getPrompts()
      setPrompts(result.prompts || [])
    } catch (e) {
      alert(`删除失败: ${e}`)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <h2 style={{ fontSize: 14, fontWeight: 'bold' }}>模板管理</h2>

      {/* Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setActiveTab('params')}
          className={`btn ${activeTab === 'params' ? 'btn-primary' : ''}`}
          style={{ whiteSpace: 'nowrap' }}
        >
          <Settings size={12} style={{ marginRight: 4 }} />
          参数模板
        </button>
        <button
          onClick={() => setActiveTab('prompts')}
          className={`btn ${activeTab === 'prompts' ? 'btn-primary' : ''}`}
          style={{ whiteSpace: 'nowrap' }}
        >
          <FileText size={12} style={{ marginRight: 4 }} />
          提示词模板
        </button>
      </div>

      {/* Parameter Templates */}
      {activeTab === 'params' && (
        <div className="flex flex-col gap-4">
          <div className="flex justify-end">
            <button
              onClick={() => {
                setTemplateForm({ name: '', params: { ngl: 999, context: 8192 } })
                setShowTemplateModal(true)
              }}
              className="btn"
            >
              <Plus size={12} style={{ marginRight: 4 }} />
              新建模板
            </button>
          </div>

          {templates.length === 0 ? (
            <div className="panel" style={{ padding: 32, textAlign: 'center' }}>
              <Settings size={32} style={{ opacity: 0.5, marginBottom: 8 }} />
              <p>暂无参数模板</p>
            </div>
          ) : (
            <div className="grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {templates.map((t) => (
                <div key={t.name} className="panel" style={{ padding: 8 }}>
                  <div className="flex items-center justify-between mb-2">
                    <span style={{ fontWeight: 'bold' }}>{t.name}</span>
                    <button
                      onClick={() => handleDeleteTemplate(t.name)}
                      className="btn"
                      style={{ padding: '2px 4px', minWidth: 'auto' }}
                    >
                      <Trash2 size={10} />
                    </button>
                  </div>
                  <div className="text-sm" style={{ fontSize: 10, color: 'var(--win-gray-dark)' }}>
                    <div>ngl: {t.params?.ngl}</div>
                    <div>context: {t.params?.context}</div>
                    <div>port: {t.params?.port}</div>
                    {t.params?.flash_attention && <div>flash_attention: true</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Prompt Templates */}
      {activeTab === 'prompts' && (
        <div className="flex flex-col gap-4">
          <div className="flex justify-end">
            <button
              onClick={() => {
                setPromptForm({ name: '', content: '' })
                setShowPromptModal(true)
              }}
              className="btn"
            >
              <Plus size={12} style={{ marginRight: 4 }} />
              新建模板
            </button>
          </div>

          {prompts.length === 0 ? (
            <div className="panel" style={{ padding: 32, textAlign: 'center' }}>
              <FileText size={32} style={{ opacity: 0.5, marginBottom: 8 }} />
              <p>暂无提示词模板</p>
            </div>
          ) : (
            <div className="grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
              {prompts.map((p) => (
                <div key={p.name} className="panel" style={{ padding: 8 }}>
                  <div className="flex items-center justify-between mb-2">
                    <span style={{ fontWeight: 'bold' }}>{p.name}</span>
                    <button
                      onClick={() => handleDeletePrompt(p.name)}
                      className="btn"
                      style={{ padding: '2px 4px', minWidth: 'auto' }}
                    >
                      <Trash2 size={10} />
                    </button>
                  </div>
                  <div
                    style={{
                      fontSize: 10,
                      fontFamily: 'monospace',
                      background: 'var(--win-gray)',
                      padding: 8,
                      maxHeight: 100,
                      overflow: 'auto',
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    {p.content}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Template Modal */}
      {showTemplateModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }} onClick={() => setShowTemplateModal(false)}>
          <div className="window" style={{ width: 400 }} onClick={e => e.stopPropagation()}>
            <div className="title-bar">
              <span>新建参数模板</span>
              <div className="title-bar-buttons">
                <div className="title-bar-btn" onClick={() => setShowTemplateModal(false)}>X</div>
              </div>
            </div>
            <div className="window-body">
              <div className="flex flex-col gap-4">
                <div>
                  <label className="text-sm" style={{ display: 'block', marginBottom: 4 }}>模板名称</label>
                  <input
                    type="text"
                    className="input"
                    style={{ width: '100%' }}
                    value={templateForm.name || ''}
                    onChange={e => setTemplateForm({ ...templateForm, name: e.target.value })}
                    placeholder="长上下文模式"
                  />
                </div>
                <div className="grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                  <div>
                    <label className="text-sm" style={{ display: 'block', marginBottom: 2 }}>GPU层数</label>
                    <input
                      type="number"
                      className="input"
                      style={{ width: '100%' }}
                      value={templateForm.params?.ngl || 999}
                      onChange={e => setTemplateForm({
                        ...templateForm,
                        params: { ...templateForm.params, ngl: parseInt(e.target.value) }
                      })}
                    />
                  </div>
                  <div>
                    <label className="text-sm" style={{ display: 'block', marginBottom: 2 }}>上下文长度</label>
                    <input
                      type="number"
                      className="input"
                      style={{ width: '100%' }}
                      value={templateForm.params?.context || 8192}
                      onChange={e => setTemplateForm({
                        ...templateForm,
                        params: { ...templateForm.params, context: parseInt(e.target.value) }
                      })}
                    />
                  </div>
                </div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={templateForm.params?.flash_attention || false}
                    onChange={e => setTemplateForm({
                      ...templateForm,
                      params: { ...templateForm.params, flash_attention: e.target.checked }
                    })}
                  />
                  <span className="text-sm">Flash Attention</span>
                </label>
              </div>
              <div className="flex justify-end gap-2" style={{ marginTop: 16 }}>
                <button onClick={() => setShowTemplateModal(false)} className="btn">取消</button>
                <button onClick={handleSaveTemplate} className="btn btn-primary">保存</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Prompt Modal */}
      {showPromptModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }} onClick={() => setShowPromptModal(false)}>
          <div className="window" style={{ width: 500 }} onClick={e => e.stopPropagation()}>
            <div className="title-bar">
              <span>新建提示词模板</span>
              <div className="title-bar-buttons">
                <div className="title-bar-btn" onClick={() => setShowPromptModal(false)}>X</div>
              </div>
            </div>
            <div className="window-body">
              <div className="flex flex-col gap-4">
                <div>
                  <label className="text-sm" style={{ display: 'block', marginBottom: 4 }}>模板名称</label>
                  <input
                    type="text"
                    className="input"
                    style={{ width: '100%' }}
                    value={promptForm.name || ''}
                    onChange={e => setPromptForm({ ...promptForm, name: e.target.value })}
                    placeholder="代码助手"
                  />
                </div>
                <div>
                  <label className="text-sm" style={{ display: 'block', marginBottom: 4 }}>提示词内容</label>
                  <textarea
                    className="input"
                    style={{ width: '100%', minHeight: 150, fontFamily: 'monospace', fontSize: 10 }}
                    value={promptForm.content || ''}
                    onChange={e => setPromptForm({ ...promptForm, content: e.target.value })}
                    placeholder="你是一个专业的编程助手..."
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2" style={{ marginTop: 16 }}>
                <button onClick={() => setShowPromptModal(false)} className="btn">取消</button>
                <button onClick={handleSavePrompt} className="btn btn-primary">保存</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
