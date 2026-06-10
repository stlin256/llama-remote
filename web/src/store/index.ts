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

function shouldKeepProgress(status: Instance['status']): boolean {
  return status === 'starting' || status === 'loading'
}

function nextInstanceErrors(instances: Instance[], errors: Record<string, string>): Record<string, string> {
  const instanceById = new Map(instances.map((instance) => [instance.id, instance]))
  return Object.fromEntries(
    Object.entries(errors).filter(([id]) => instanceById.get(id)?.status === 'error')
  )
}

function nextInstanceProgress(instances: Instance[], progress: Record<string, { progress: string; message: string }>): Record<string, { progress: string; message: string }> {
  const instanceById = new Map(instances.map((instance) => [instance.id, instance]))
  return Object.fromEntries(
    Object.entries(progress).filter(([id]) => {
      const instance = instanceById.get(id)
      return instance ? shouldKeepProgress(instance.status) : false
    })
  )
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

  // 实例错误信息
  instanceErrors: Record<string, string>
  setInstanceError: (id: string, error: string) => void
  clearInstanceError: (id: string) => void

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
  clearInstanceProgress: (id: string) => void
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
  setInstances: (instances) => set((state) => ({
    instances,
    instanceErrors: nextInstanceErrors(instances, state.instanceErrors),
    instanceProgress: nextInstanceProgress(instances, state.instanceProgress),
  })),
  addInstance: (instance) => set((state) => ({ instances: [...state.instances, instance] })),
  updateInstance: (id, updates) => set((state) => {
    const instances = state.instances.map((i) => i.id === id ? { ...i, ...updates } : i)
    if (!updates.status) {
      return { instances }
    }
    const status = updates.status
    return {
      instances,
      instanceErrors: status === 'error'
        ? state.instanceErrors
        : Object.fromEntries(Object.entries(state.instanceErrors).filter(([key]) => key !== id)),
      instanceProgress: shouldKeepProgress(status)
        ? state.instanceProgress
        : Object.fromEntries(Object.entries(state.instanceProgress).filter(([key]) => key !== id)),
    }
  }),
  updateInstanceStatus: (id, status) => set((state) => ({
    instances: state.instances.map((i) => i.id === id ? { ...i, status: status as Instance['status'] } : i),
    instanceErrors: status === 'error'
      ? state.instanceErrors
      : Object.fromEntries(Object.entries(state.instanceErrors).filter(([key]) => key !== id)),
    instanceProgress: shouldKeepProgress(status as Instance['status'])
      ? state.instanceProgress
      : Object.fromEntries(Object.entries(state.instanceProgress).filter(([key]) => key !== id)),
  })),
  removeInstance: (id) => set((state) => ({
    instances: state.instances.filter((i) => i.id !== id),
    instanceErrors: Object.fromEntries(Object.entries(state.instanceErrors).filter(([key]) => key !== id)),
    instanceProgress: Object.fromEntries(Object.entries(state.instanceProgress).filter(([key]) => key !== id)),
  })),

  // 实例错误信息
  instanceErrors: {},
  setInstanceError: (id, error) => set((state) => ({
    instanceErrors: { ...state.instanceErrors, [id]: error }
  })),
  clearInstanceError: (id) => set((state) => ({
    instanceErrors: Object.fromEntries(Object.entries(state.instanceErrors).filter(([key]) => key !== id))
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
  clearInstanceProgress: (id) => set((state) => ({
    instanceProgress: Object.fromEntries(Object.entries(state.instanceProgress).filter(([key]) => key !== id))
  })),
}))
