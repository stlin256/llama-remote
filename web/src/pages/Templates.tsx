import { useState } from 'react'
import { Plus, Trash2, FileText, Lock } from 'lucide-react'
import { useStore } from '../store'
import { api } from '../hooks/api'
import type { PromptTemplate } from '../types'
import Modal from '../components/Modal'
import { confirm } from '../components/ConfirmDialog'
import { success, error } from '../components/MessageDialog'

const DEFAULT_PROMPT_TEMPLATE: PromptTemplate = {
  name: '默认提示词 (强推理模型)',
  content: `You are a very strong reasoner and planner. Use these critical instructions to structure your plans, thoughts, and responses.

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
}

export default function Templates() {
  const { prompts, setPrompts } = useStore()
  const [showPromptModal, setShowPromptModal] = useState(false)
  const [promptForm, setPromptForm] = useState<Partial<PromptTemplate>>({
    name: '',
    content: '',
  })

  // 确保prompts是数组
  const promptList = Array.isArray(prompts) ? prompts : []

  const handleSavePrompt = async () => {
    if (!promptForm.name || !promptForm.content) {
      await error('请填写模板名称和内容')
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
      await success('保存成功!')
    } catch (e) {
      await error(`保存失败: ${e}`)
    }
  }

  const handleDeletePrompt = async (name: string) => {
    if (!await confirm(`删除提示词模板 "${name}"?`)) return
    try {
      await api.deletePrompt(name)
      const result = await api.getPrompts()
      const newPrompts = (result as any)?.prompts
      if (Array.isArray(newPrompts)) {
        setPrompts(newPrompts)
      } else {
        setPrompts([])
      }
      await success('删除成功!')
    } catch (e) {
      await error(`删除失败: ${e}`)
    }
  }

  const handleClearAll = async () => {
    if (!await confirm('确定要删除所有自定义提示词吗?')) return
    try {
      await api.clearPrompts()
      setPrompts([])
      await success('已清除所有自定义提示词!')
    } catch (e) {
      await error(`清除失败: ${e}`)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 style={{ fontSize: 14, fontWeight: 'bold' }}>模板管理</h2>
        <div className="flex gap-2">
          {promptList.length > 0 && (
            <button onClick={handleClearAll} className="btn" style={{ background: '#c0c0c0' }}>
              清空所有
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
            新建模板
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
              <span style={{ fontWeight: 'bold' }}>{DEFAULT_PROMPT_TEMPLATE.name}</span>
            </div>
            <span style={{ fontSize: 10, color: 'var(--win-gray-dark)' }}>内置模板，不可删除</span>
          </div>
          <div
            style={{
              fontSize: 10,
              fontFamily: 'monospace',
              background: 'var(--win-gray)',
              padding: 8,
              maxHeight: 80,
              overflow: 'auto',
              whiteSpace: 'pre-wrap',
              border: '1px solid var(--win-gray-dark)',
            }}
          >
            {DEFAULT_PROMPT_TEMPLATE.content}
          </div>
        </div>

        {/* User-defined Prompt Templates */}
        {promptList.length === 0 ? (
          <div className="panel" style={{ padding: 32, textAlign: 'center' }}>
            <div className="flex items-center justify-center" style={{ marginBottom: 8 }}>
              <FileText size={32} style={{ opacity: 0.5 }} />
              <span style={{ marginLeft: 8 }}>暂无自定义提示词模板</span>
            </div>
          </div>
        ) : (
          <div className="grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
            {promptList.map((p) => (
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

      {/* Prompt Modal */}
      <Modal title="新建提示词模板" show={showPromptModal} onClose={() => setShowPromptModal(false)} width={500}>
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
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={() => setShowPromptModal(false)} className="btn">取消</button>
          <button onClick={handleSavePrompt} className="btn btn-primary">保存</button>
        </div>
      </Modal>
    </div>
  )
}
