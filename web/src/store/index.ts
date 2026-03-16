import { create } from 'zustand'
import type { Instance, ModelInfo, GPUStats, Config, Template, PromptTemplate } from '../types'
import { getBrowserLanguage } from '../i18n/useTranslation'

// 获取保存的语言设置，如果没有则使用浏览器语言
function getInitialLanguage(): 'zh' | 'en' {
  const saved = localStorage.getItem('language')
  if (saved === 'zh' || saved === 'en') {
    return saved
  }
  return getBrowserLanguage()
}

interface AppState {
  // 配置
  config: Config | null
  setConfig: (config: Config) => void

  // 语言
  language: 'zh' | 'en'
  setLanguage: (lang: 'zh' | 'en') => void

  // 认证
  authenticated: boolean
  setAuthenticated: (authenticated: boolean) => void

  // 实例
  instances: Instance[]
  setInstances: (instances: Instance[]) => void
  addInstance: (instance: Instance) => void
  updateInstance: (id: string, updates: Partial<Instance>) => void
  updateInstanceStatus: (id: string, status: string) => void
  removeInstance: (id: string) => void

  // 模型
  models: ModelInfo[]
  setModels: (models: ModelInfo[]) => void

  // GPU
  gpuStats: GPUStats | null
  setGpuStats: (stats: GPUStats) => void

  // System
  systemStats: { cpu: number; mem_used: number; mem_total: number; mem_percent: number } | null
  setSystemStats: (stats: { cpu: number; mem_used: number; mem_total: number; mem_percent: number }) => void

  // 模板
  templates: Template[]
  setTemplates: (templates: Template[]) => void
  prompts: PromptTemplate[]
  setPrompts: (prompts: PromptTemplate[]) => void

  // 日志
  logs: { instance: string; content: string; timestamp: number }[]
  addLog: (log: { instance: string; content: string }) => void
  clearLogs: () => void

  // UI状态
  sidebarCollapsed: boolean
  toggleSidebar: () => void

  // 实例加载进度
  instanceProgress: Record<string, { progress: string; message: string }>
  setInstanceProgress: (id: string, progress: string, message: string) => void
}

export const useStore = create<AppState>((set) => ({
  // 配置
  config: null,
  setConfig: (config) => set({ config }),

  // 语言
  language: getInitialLanguage(),
  setLanguage: (language) => {
    localStorage.setItem('language', language)
    set({ language })
  },

  // 认证
  authenticated: false,
  setAuthenticated: (authenticated) => set({ authenticated }),

  // 实例
  instances: [],
  setInstances: (instances) => set({ instances }),
  addInstance: (instance) => set((state) => ({ instances: [...state.instances, instance] })),
  updateInstance: (id, updates) => set((state) => ({
    instances: state.instances.map((i) => i.id === id ? { ...i, ...updates } : i)
  })),
  updateInstanceStatus: (id, status) => set((state) => ({
    instances: state.instances.map((i) => i.id === id ? { ...i, status: status as Instance['status'] } : i)
  })),
  removeInstance: (id) => set((state) => ({
    instances: state.instances.filter((i) => i.id !== id)
  })),

  // 模型
  models: [],
  setModels: (models) => set({ models }),

  // GPU
  gpuStats: null,
  setGpuStats: (gpuStats) => set({ gpuStats }),

  // System
  systemStats: null,
  setSystemStats: (systemStats) => set({ systemStats }),

  // 模板
  templates: [],
  setTemplates: (templates) => set({ templates }),
  prompts: [],
  setPrompts: (prompts) => set({ prompts }),

  // 日志
  logs: [],
  addLog: (log) => set((state) => ({
    logs: [...state.logs.slice(-500), { ...log, timestamp: Date.now() }]
  })),
  clearLogs: () => set({ logs: [] }),

  // UI
  sidebarCollapsed: false,
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

  // 实例加载进度
  instanceProgress: {},
  setInstanceProgress: (id, progress, message) => set((state) => ({
    instanceProgress: { ...state.instanceProgress, [id]: { progress, message } }
  })),
}))
