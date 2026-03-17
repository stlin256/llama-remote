import { useState } from 'react'
import { Plus, Trash2, FileText, Lock } from 'lucide-react'
import { useStore } from '../store'
import { api } from '../hooks/api'
import type { PromptTemplate } from '../types'
import Modal from '../components/Modal'
import { confirm } from '../components/ConfirmDialog'
import { success, error } from '../components/MessageDialog'
import { useTranslation } from '../i18n/useTranslation'
import { useIsMobile } from '../hooks/useMediaQuery'
import { DEFAULT_PROMPT_TEMPLATE } from '../utils'

export default function Templates() {
  const { prompts, setPrompts } = useStore()
  const { t } = useTranslation()
  const isMobile = useIsMobile()
  const [showPromptModal, setShowPromptModal] = useState(false)
  const [promptForm, setPromptForm] = useState<Partial<PromptTemplate>>({
    name: '',
    content: '',
  })

  // 确保prompts是数组
  const promptList = Array.isArray(prompts) ? prompts : []

  const handleSavePrompt = async () => {
    if (!promptForm.name || !promptForm.content) {
      await error(t('fillTemplateNameContent'))
      return
    }
    try {
      await api.savePrompt(promptForm)
      // 重新获取列表
      const result = await api.getPrompts()
      let newPrompts = []
      if (result && typeof result === 'object') {
        newPrompts = (result as any).prompts || (result as any).data || []
      }
      if (!Array.isArray(newPrompts)) {
        newPrompts = []
      }
      setPrompts(newPrompts)
      setShowPromptModal(false)
      setPromptForm({ name: '', content: '' })
      await success(t('promptSaved'))
    } catch (e) {
      await error(`${t('saveFailed')}: ${e}`)
    }
  }

  const handleDeletePrompt = async (name: string) => {
    if (!await confirm(t('confirmDeletePrompt').replace('{name}', name))) return
    try {
      await api.deletePrompt(name)
      const result = await api.getPrompts()
      const newPrompts = (result as any)?.prompts
      if (Array.isArray(newPrompts)) {
        setPrompts(newPrompts)
      } else {
        setPrompts([])
      }
      await success(t('promptDeleted'))
    } catch (e) {
      await error(`${t('deleteFailed')}: ${e}`)
    }
  }

  const handleClearAll = async () => {
    if (!await confirm(t('confirmClearAll'))) return
    try {
      await api.clearPrompts()
      setPrompts([])
      await success(t('promptsCleared'))
    } catch (e) {
      await error(`${t('clearFailed')}: ${e}`)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 style={{ fontSize: 14, fontWeight: 'bold' }}>{t('templateManagement')}</h2>
        <div className="flex gap-2">
          {promptList.length > 0 && (
            <button onClick={handleClearAll} className="btn" style={{ background: '#c0c0c0' }}>
              {t('clearAll')}
            </button>
          )}
          <button
            onClick={() => {
              setPromptForm({ name: '', content: '' })
              setShowPromptModal(true)
            }}
            className="btn"
          >
            <Plus size={12} style={{ marginRight: 4 }} />
            {t('createTemplate')}
          </button>
        </div>
      </div>

      {/* Prompt Templates */}
      <div className="flex flex-col gap-4">

        {/* Default Prompt Template - Read Only */}
        <div className="panel" style={{ padding: 8 }}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Lock size={12} style={{ color: 'var(--win-gray-dark)' }} />
              <span style={{ fontWeight: 'bold' }}>{t('defaultPromptName')}</span>
            </div>
            <span style={{ fontSize: 10, color: 'var(--win-gray-dark)' }}>{t('builtInTemplate')}</span>
          </div>
          <div
            className="panel"
            style={{
              marginTop: 8,
              padding: 8,
              maxHeight: 120,
              overflow: 'auto',
              fontSize: 10,
              fontFamily: 'monospace',
            }}
          >
            <div style={{ fontWeight: 'bold', marginBottom: 4 }}>{t('templatePreview')}:</div>
            <pre style={{ whiteSpace: 'pre-wrap', margin: 0 }}>
              {DEFAULT_PROMPT_TEMPLATE.slice(0, 500)}{DEFAULT_PROMPT_TEMPLATE.length > 500 ? '...' : ''}
            </pre>
          </div>
        </div>

        {/* User-defined Prompt Templates */}
        {promptList.length === 0 ? (
          <div className="panel" style={{ padding: 32, textAlign: 'center' }}>
            <div className="flex items-center justify-center" style={{ marginBottom: 8 }}>
              <FileText size={32} style={{ opacity: 0.5 }} />
              <span style={{ marginLeft: 8 }}>{t('noCustomTemplates')}</span>
            </div>
          </div>
        ) : (
          <div className="grid" style={{
            gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)',
            gap: isMobile ? 6 : 8
          }}>
            {promptList.map((p) => (
              <div key={p.name} className="panel" style={{ padding: isMobile ? 6 : 8 }}>
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
                  className="panel"
                  style={{
                    marginTop: 8,
                    padding: 8,
                    maxHeight: 120,
                    overflow: 'auto',
                    fontSize: 10,
                    fontFamily: 'monospace',
                  }}
                >
                  <div style={{ fontWeight: 'bold', marginBottom: 4 }}>{t('templatePreview')}:</div>
                  <pre style={{ whiteSpace: 'pre-wrap', margin: 0 }}>
                    {p.content.slice(0, 500)}{p.content.length > 500 ? '...' : ''}
                  </pre>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Prompt Modal */}
      <Modal title={t('createTemplate')} show={showPromptModal} onClose={() => setShowPromptModal(false)} width={isMobile ? Math.min(window.innerWidth - 32, 400) : 500}>
        <div className="flex flex-col gap-4">
          <div>
            <label className="text-sm" style={{ display: 'block', marginBottom: 4 }}>{t('templateName')}</label>
            <input
              type="text"
              className="input"
              style={{ width: '100%' }}
              value={promptForm.name || ''}
              onChange={e => setPromptForm({ ...promptForm, name: e.target.value })}
              placeholder={t('templatePlaceholder')}
            />
          </div>
          <div>
            <label className="text-sm" style={{ display: 'block', marginBottom: 4 }}>{t('templateContent')}</label>
            <textarea
              className="input"
              style={{ width: '100%', minHeight: 150, fontFamily: 'monospace', fontSize: 10 }}
              value={promptForm.content || ''}
              onChange={e => setPromptForm({ ...promptForm, content: e.target.value })}
              placeholder={t('promptContentPlaceholder')}
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={() => setShowPromptModal(false)} className="btn">{t('cancel')}</button>
          <button onClick={handleSavePrompt} className="btn btn-primary">{t('save')}</button>
        </div>
      </Modal>
    </div>
  )
}
