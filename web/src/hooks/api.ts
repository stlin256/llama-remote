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
  const text = await response.text()
  if (!text) {
    return {} as T
  }
  return JSON.parse(text)
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
  stopAllInstances: () => request<any>('/api/instances/stop-all', {
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
  clearPrompts: () => request('/api/prompts/clear', {
    method: 'POST',
  }),

  // GPU
  getGPU: () => request<any>('/api/gpu'),

  // System
  getSystem: () => request<any>('/api/system'),

  // Server logs (debug)
  getServerLogs: (lines: number = 100) => request<any>(`/api/server/log?lines=${lines}`),

  // Instance logs
  getInstanceLogs: (instanceId?: string) => request<any>(`/api/logs?instance=${instanceId || ''}`),

  // Chat - send message to running instance
  sendChatMessage: async function*(instanceId: string, messages: { role: string; content: string }[], params?: any): AsyncGenerator<{ content: string; done: boolean; tokens?: number; promptTokens?: number }> {
    const response = await fetch(`/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages,
        stream: true,
        instance_id: instanceId,
        params,
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(error || `HTTP ${response.status}`)
    }

    const reader = response.body?.getReader()
    if (!reader) throw new Error('No response body')

    const decoder = new TextDecoder()
    let buffer = ''
    let totalTokens = 0
    let promptTokens = 0

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || !trimmed.startsWith('data: ')) continue

        const data = trimmed.slice(6)
        if (data === '[DONE]') {
          yield { content: '', done: true, tokens: totalTokens, promptTokens }
          return
        }

        try {
          const parsed = JSON.parse(data)
          const content = parsed.choices?.[0]?.delta?.content || ''
          const tokens = parsed.usage?.completion_tokens
          const pTokens = parsed.usage?.prompt_tokens
          if (tokens) totalTokens = tokens
          if (pTokens) promptTokens = pTokens
          // Always yield token count when available (at end of stream)
          if (content) {
            yield { content, done: false, tokens: tokens || undefined, promptTokens: pTokens || undefined }
          } else if (tokens || pTokens) {
            // Yield empty content with token count when stream ends
            yield { content: '', done: false, tokens: tokens || undefined, promptTokens: pTokens || undefined }
          }
        } catch {
          // Skip invalid JSON
        }
      }
    }
  },

  // Completion - send raw prompt to running instance
  sendCompletion: async function*(instanceId: string, prompt: string, params?: any): AsyncGenerator<{ content: string; done: boolean; tokens?: number; promptTokens?: number }> {
    const response = await fetch(`/api/completion`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt,
        stream: true,
        instance_id: instanceId,
        params,
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(error || `HTTP ${response.status}`)
    }

    const reader = response.body?.getReader()
    if (!reader) throw new Error('No response body')

    const decoder = new TextDecoder()
    let buffer = ''
    let totalTokens = 0
    let promptTokens = 0

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || !trimmed.startsWith('data: ')) continue

        const data = trimmed.slice(6)
        if (data === '[DONE]') {
          yield { content: '', done: true, tokens: totalTokens, promptTokens }
          return
        }

        try {
          const parsed = JSON.parse(data)
          // For completions, the text is in choices[0].text
          const content = parsed.choices?.[0]?.text || ''
          const tokens = parsed.usage?.completion_tokens
          const pTokens = parsed.usage?.prompt_tokens
          if (tokens) totalTokens = tokens
          if (pTokens) promptTokens = pTokens
          
          if (content) {
            yield { content, done: false, tokens: tokens || undefined, promptTokens: pTokens || undefined }
          } else if (tokens || pTokens) {
            yield { content: '', done: false, tokens: tokens || undefined, promptTokens: pTokens || undefined }
          }
        } catch {
          // Skip invalid JSON
        }
      }
    }
  },
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
