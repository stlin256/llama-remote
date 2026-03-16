export interface Instance {
  id: string
  name: string
  llama_bin: string
  model: string
  mmproj: string
  params: InstanceParams
  prompt_template: string
  status: 'stopped' | 'starting' | 'running' | 'loading' | 'error'
  port?: number
}

export interface InstanceParams {
  ngl?: number
  context?: number
  host?: string
  port?: number
  threads?: number
  flash_attention?: boolean
  mlock?: boolean
  'no-mmap'?: boolean
  batch_size?: number
  [key: string]: any
}

export interface ModelInfo {
  name: string
  path: string
  size: number
  modified_time: number
  mmproj?: string
  model_name?: string
  architecture?: string
  quantization?: string
  vocabulary_size?: number
  context_length?: number
  embedding_length?: number
  block_count?: number
  attention_heads?: number
}

export interface Template {
  name: string
  params: InstanceParams
}

export interface PromptTemplate {
  name: string
  content: string
  variables?: {
    name: string
    default: string
  }[]
}

export interface GPUStats {
  index: number
  name: string
  utilization: number
  memory_used: number
  memory_total: number
  temperature: number
  fan_speed: number
  power: number
  perf_limit: string
  memory_load: string
}

export interface Config {
  server: {
    host: string
    port: number
  }
  paths: {
    llama_bin: string
    models_dir: string
    log_dir: string
  }
  auth?: {
    enable: boolean
  }
}

export interface LogMessage {
  instance: string
  content: string
  timestamp?: number
}
