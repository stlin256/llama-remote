import { useEffect, useRef, useState } from 'react'
import { ScrollText, Search, Trash2, Terminal } from 'lucide-react'
import { useStore } from '../store'
import { api } from '../hooks/api'
import { useTranslation } from '../i18n/useTranslation'

export default function Logs() {
  const { logs, clearLogs, instances } = useStore()
  const { t, language } = useTranslation()
  const [filter, setFilter] = useState('')
  const [levelFilter, setLevelFilter] = useState<string>('all')
  const [serverLogs, setServerLogs] = useState<string[]>([])
  const [showServerLogs, setShowServerLogs] = useState(false)
  const [selectedInstance, setSelectedInstance] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  const loadServerLogs = async (instanceId?: string) => {
    try {
      const id = instanceId || selectedInstance
      if (!id) return
      const data = await api.getInstanceLogs(id)
      setServerLogs(data.logs || [])
      setShowServerLogs(true)
    } catch (e) {
      console.error('Failed to load logs:', e)
    }
  }

  // Auto-load logs when instance is selected
  useEffect(() => {
    if (selectedInstance) {
      loadServerLogs(selectedInstance)
      // 定时刷新日志
      const interval = setInterval(() => {
        loadServerLogs(selectedInstance)
      }, 2000)
      return () => clearInterval(interval)
    }
  }, [selectedInstance])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [logs])

  const filteredLogs = logs.filter(log => {
    const matchSearch = filter === '' || log.content.toLowerCase().includes(filter.toLowerCase())
    const matchLevel = levelFilter === 'all' || log.content.toLowerCase().includes(levelFilter)
    return matchSearch && matchLevel
  })

  const getLogLevel = (content: string): string => {
    const lower = content.toLowerCase()
    if (lower.includes('error') || lower.includes('err')) return 'error'
    if (lower.includes('warn')) return 'warning'
    if (lower.includes('debug')) return 'debug'
    return 'info'
  }

  return (
    <div className="flex flex-col gap-4" style={{ height: '100%' }}>
      <div className="flex items-center justify-between">
        <h2 style={{ fontSize: 14, fontWeight: 'bold' }}>日志</h2>
        <div className="flex gap-2 items-center">
          <select
            className="input"
            style={{ width: 180 }}
            value={selectedInstance}
            onChange={e => setSelectedInstance(e.target.value)}
          >
            <option value="">选择实例...</option>
            {instances.map(inst => (
              <option key={inst.id} value={inst.id}>{inst.name}</option>
            ))}
          </select>
          <button onClick={() => selectedInstance && loadServerLogs(selectedInstance)} className="btn" disabled={!selectedInstance}>
            <Terminal size={12} style={{ marginRight: 4 }} />
            查看日志
          </button>
          <button onClick={clearLogs} className="btn">
            <Trash2 size={12} style={{ marginRight: 4 }} />
            清空
          </button>
        </div>
      </div>

      {/* Search and filter */}
      <div className="flex gap-4">
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={14} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--win-gray-dark)' }} />
          <input
            type="text"
            className="input"
            style={{ paddingLeft: 28, width: '100%' }}
            placeholder={t('searchLogs')}
            value={filter}
            onChange={e => setFilter(e.target.value)}
          />
        </div>
        <select
          className="input"
          style={{ width: 120 }}
          value={levelFilter}
          onChange={e => setLevelFilter(e.target.value)}
        >
          <option value="all">全部级别</option>
          <option value="error">Error</option>
          <option value="warn">Warning</option>
          <option value="info">Info</option>
          <option value="debug">Debug</option>
        </select>
      </div>

      {/* Log content */}
      {showServerLogs ? (
        <div className="panel" style={{ flex: 1, overflow: 'auto', padding: 8 }}>
          <div className="flex items-center justify-between mb-2">
            <span style={{ fontWeight: 'bold' }}>{instances.find(i => i.id === selectedInstance)?.name || (language === 'zh' ? '实例' : 'Instance')} {language === 'zh' ? '日志' : 'Logs'}</span>
            <button onClick={() => setShowServerLogs(false)} className="btn" style={{ padding: '2px 8px' }}>关闭</button>
          </div>
          <pre style={{ fontSize: 10, fontFamily: 'monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
            {serverLogs.join('\n')}
          </pre>
        </div>
      ) : (
        <div className="panel" style={{ flex: 1, overflow: 'hidden', padding: 0 }}>
          <div
            ref={scrollRef}
            style={{ height: '100%', overflow: 'auto', padding: 8, fontFamily: 'monospace', fontSize: 10 }}
          >
            {filteredLogs.length === 0 ? (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--win-gray-dark)' }}>
                <div className="flex items-center">
                  <ScrollText size={32} style={{ opacity: 0.5 }} />
                  <span style={{ marginLeft: 8 }}>暂无日志</span>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                {filteredLogs.map((log, idx) => {
                  const level = getLogLevel(log.content)
                  return (
                    <div
                      key={idx}
                      style={{
                        padding: '2px 4px',
                        background: level === 'error' ? '#ffcccc' : level === 'warning' ? '#ffffcc' : 'transparent',
                        color: level === 'error' ? '#aa0000' : level === 'warning' ? '#aa8800' : 'inherit',
                      }}
                    >
                      <span style={{ color: 'var(--win-gray-dark)', marginRight: 8 }}>
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </span>
                      <span style={{ color: 'var(--win-gray-dark)', marginRight: 8 }}>[{log.instance}]</span>
                      <span>{log.content}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
