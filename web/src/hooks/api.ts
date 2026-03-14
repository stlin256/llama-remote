const API_BASE = ''

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  })
  if (!response.ok) {
    const error = await response.text()
    throw new Error(error || `HTTP ${response.status}`)
  }
  return response.json()
}

export const api = {
  // 认证
  checkAuth: () => request<{ authenticated: boolean }>('/api/check'),
  login: (password: string) => request<{ status: string }>('/api/login', {
    method: 'POST',
    body: JSON.stringify({ password }),
  }),
  logout: () => request<{ status: string }>('/api/logout', {
    method: 'POST',
  }),

  // 配置
  getConfig: () => request<any>('/api/config'),
  updateConfig: (config: any) => request('/api/config', {
    method: 'PUT',
    body: JSON.stringify(config),
  }),

  // 实例
  getInstances: () => request<any[]>('/api/instances'),
  createInstance: (instance: any) => request<any>('/api/instances', {
    method: 'POST',
    body: JSON.stringify(instance),
  }),
  getInstance: (id: string) => request<any>(`/api/instances/${id}`),
  updateInstance: (id: string, instance: any) => request<any>(`/api/instances/${id}`, {
    method: 'PUT',
    body: JSON.stringify(instance),
  }),
  deleteInstance: (id: string) => request<any>(`/api/instances/${id}`, {
    method: 'DELETE',
  }),
  startInstance: (id: string) => request<any>(`/api/instances/${id}/start`, {
    method: 'POST',
  }),
  stopInstance: (id: string) => request<any>(`/api/instances/${id}/stop`, {
    method: 'POST',
  }),

  // 模型
  scanModels: () => request<any>('/api/models'),

  // 模板
  getTemplates: () => request<any>('/api/templates'),
  saveTemplate: (template: any) => request('/api/templates', {
    method: 'POST',
    body: JSON.stringify(template),
  }),
  deleteTemplate: (name: string) => request(`/api/templates?name=${encodeURIComponent(name)}`, {
    method: 'DELETE',
  }),

  // 提示词
  getPrompts: () => request<any>('/api/prompts'),
  savePrompt: (prompt: any) => request('/api/prompts', {
    method: 'POST',
    body: JSON.stringify(prompt),
  }),
  deletePrompt: (name: string) => request(`/api/prompts?name=${encodeURIComponent(name)}`, {
    method: 'DELETE',
  }),

  // GPU
  getGPU: () => request<any>('/api/gpu'),

  // System
  getSystem: () => request<any>('/api/system'),
}

// WebSocket连接
export function createWebSocket(onMessage: (data: any) => void): WebSocket {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const ws = new WebSocket(`${protocol}//${window.location.host}/ws`)

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data)
      onMessage(data)
    } catch (e) {
      console.error('Failed to parse WebSocket message:', e)
    }
  }

  ws.onerror = (error) => {
    console.error('WebSocket error:', error)
  }

  return ws
}
