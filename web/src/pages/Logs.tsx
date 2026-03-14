import { useEffect, useRef, useState } from 'react'
import { ScrollText, Search, Trash2 } from 'lucide-react'
import { useStore } from '../store'

export default function Logs() {
  const { logs, clearLogs } = useStore()
  const [filter, setFilter] = useState('')
  const [levelFilter, setLevelFilter] = useState<string>('all')
  const scrollRef = useRef<HTMLDivElement>(null)

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
        <button onClick={clearLogs} className="btn">
          <Trash2 size={12} style={{ marginRight: 4 }} />
          清空
        </button>
      </div>

      {/* Search and filter */}
      <div className="flex gap-4">
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={14} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--win-gray-dark)' }} />
          <input
            type="text"
            className="input"
            style={{ paddingLeft: 28, width: '100%' }}
            placeholder="搜索日志..."
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
      <div className="panel" style={{ flex: 1, overflow: 'hidden', padding: 0 }}>
        <div
          ref={scrollRef}
          style={{ height: '100%', overflow: 'auto', padding: 8, fontFamily: 'monospace', fontSize: 10 }}
        >
          {filteredLogs.length === 0 ? (
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--win-gray-dark)' }}>
              <div className="text-center">
                <ScrollText size={32} style={{ opacity: 0.5, marginBottom: 8 }} />
                <p>暂无日志</p>
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
    </div>
  )
}
