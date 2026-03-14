import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Trash2, FileText, Settings, X } from 'lucide-react'
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
    <div className="space-y-6">
      {/* 标题栏 */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">模板管理</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setActiveTab('params')}
          className={`px-4 py-2 rounded-xl transition-colors ${
            activeTab === 'params'
              ? 'bg-primary/20 text-primary border border-primary/30'
              : 'text-gray-400 hover:bg-white/5'
          }`}
        >
          <Settings size={18} className="inline mr-2" />
          参数模板
        </button>
        <button
          onClick={() => setActiveTab('prompts')}
          className={`px-4 py-2 rounded-xl transition-colors ${
            activeTab === 'prompts'
              ? 'bg-primary/20 text-primary border border-primary/30'
              : 'text-gray-400 hover:bg-white/5'
          }`}
        >
          <FileText size={18} className="inline mr-2" />
          提示词模板
        </button>
      </div>

      {/* 参数模板 */}
      {activeTab === 'params' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => {
                setTemplateForm({ name: '', params: { ngl: 999, context: 8192 } })
                setShowTemplateModal(true)
              }}
              className="btn-primary flex items-center gap-2"
            >
              <Plus size={18} />
              新建模板
            </button>
          </div>

          {templates.length === 0 ? (
            <div className="glass-card p-12 text-center">
              <Settings size={48} className="mx-auto mb-4 text-gray-600" />
              <p className="text-gray-400">暂无参数模板</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {templates.map((t, idx) => (
                <motion.div
                  key={t.name}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="glass-card p-4"
                >
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-medium">{t.name}</h3>
                    <button
                      onClick={() => handleDeleteTemplate(t.name)}
                      className="p-2 rounded-lg hover:bg-white/10 text-error"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <div className="space-y-1 text-sm text-gray-400">
                    <p>ngl: {t.params?.ngl}</p>
                    <p>context: {t.params?.context}</p>
                    <p>port: {t.params?.port}</p>
                    {t.params?.flash_attention && <p>flash_attention: true</p>}
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 提示词模板 */}
      {activeTab === 'prompts' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => {
                setPromptForm({ name: '', content: '' })
                setShowPromptModal(true)
              }}
              className="btn-primary flex items-center gap-2"
            >
              <Plus size={18} />
              新建模板
            </button>
          </div>

          {prompts.length === 0 ? (
            <div className="glass-card p-12 text-center">
              <FileText size={48} className="mx-auto mb-4 text-gray-600" />
              <p className="text-gray-400">暂无提示词模板</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {prompts.map((p, idx) => (
                <motion.div
                  key={p.name}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="glass-card p-4"
                >
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-medium">{p.name}</h3>
                    <button
                      onClick={() => handleDeletePrompt(p.name)}
                      className="p-2 rounded-lg hover:bg-white/10 text-error"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <p className="text-sm text-gray-400 font-mono bg-black/20 p-3 rounded-lg max-h-32 overflow-auto">
                    {p.content}
                  </p>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 参数模板弹窗 */}
      <AnimatePresence>
        {showTemplateModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setShowTemplateModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="glass-card w-full max-w-md p-6"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold">新建参数模板</h2>
                <button onClick={() => setShowTemplateModal(false)}><X size={20} /></button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">模板名称</label>
                  <input
                    type="text"
                    className="input"
                    value={templateForm.name || ''}
                    onChange={e => setTemplateForm({ ...templateForm, name: e.target.value })}
                    placeholder="长上下文模式"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">GPU层数</label>
                    <input
                      type="number"
                      className="input"
                      value={templateForm.params?.ngl || 999}
                      onChange={e => setTemplateForm({
                        ...templateForm,
                        params: { ...templateForm.params, ngl: parseInt(e.target.value) }
                      })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">上下文长度</label>
                    <input
                      type="number"
                      className="input"
                      value={templateForm.params?.context || 8192}
                      onChange={e => setTemplateForm({
                        ...templateForm,
                        params: { ...templateForm.params, context: parseInt(e.target.value) }
                      })}
                    />
                  </div>
                </div>
                <div className="flex gap-6">
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
              </div>
              <div className="flex justify-end gap-2 mt-6">
                <button onClick={() => setShowTemplateModal(false)} className="btn-secondary">取消</button>
                <button onClick={handleSaveTemplate} className="btn-primary">保存</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 提示词模板弹窗 */}
      <AnimatePresence>
        {showPromptModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setShowPromptModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="glass-card w-full max-w-lg p-6"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold">新建提示词模板</h2>
                <button onClick={() => setShowPromptModal(false)}><X size={20} /></button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">模板名称</label>
                  <input
                    type="text"
                    className="input"
                    value={promptForm.name || ''}
                    onChange={e => setPromptForm({ ...promptForm, name: e.target.value })}
                    placeholder="代码助手"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">提示词内容</label>
                  <textarea
                    className="input min-h-[200px] font-mono text-sm"
                    value={promptForm.content || ''}
                    onChange={e => setPromptForm({ ...promptForm, content: e.target.value })}
                    placeholder="你是一个专业的编程助手..."
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-6">
                <button onClick={() => setShowPromptModal(false)} className="btn-secondary">取消</button>
                <button onClick={handleSavePrompt} className="btn-primary">保存</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
