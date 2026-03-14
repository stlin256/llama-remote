import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { ScrollText, Search, Trash2 } from 'lucide-react'
import { useStore } from '../store'

export default function Logs() {
  const { logs, clearLogs } = useStore()
  const [filter, setFilter] = useState('')
  const [levelFilter, setLevelFilter] = useState<string>('all')
  const scrollRef = useRef<HTMLDivElement>(null)

  // 自动滚动到底部
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
    <div className="space-y-6 h-full flex flex-col">
      {/* 标题栏 */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">日志</h1>
        <button
          onClick={clearLogs}
          className="btn-secondary flex items-center gap-2"
        >
          <Trash2 size={18} />
          清空
        </button>
      </div>

      {/* 搜索和过滤 */}
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
          <input
            type="text"
            className="input pl-10"
            placeholder="搜索日志..."
            value={filter}
            onChange={e => setFilter(e.target.value)}
          />
        </div>
        <select
          className="input w-40"
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

      {/* 日志内容 */}
      <div className="flex-1 glass-card overflow-hidden">
        <div
          ref={scrollRef}
          className="h-full overflow-auto p-4 font-mono text-sm"
        >
          {filteredLogs.length === 0 ? (
            <div className="h-full flex items-center justify-center text-gray-500">
              <div className="text-center">
                <ScrollText size={48} className="mx-auto mb-4 opacity-50" />
                <p>暂无日志</p>
              </div>
            </div>
          ) : (
            <div className="space-y-1">
              {filteredLogs.map((log, idx) => {
                const level = getLogLevel(log.content)
                return (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className={`flex gap-3 py-1 px-2 rounded ${
                      level === 'error' ? 'bg-error/10 text-error' :
                      level === 'warning' ? 'bg-warning/10 text-warning' :
                      'text-gray-300'
                    }`}
                  >
                    <span className="text-gray-600 shrink-0">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                    <span className="text-gray-500 shrink-0">[{log.instance}]</span>
                    <span className="break-all">{log.content}</span>
                  </motion.div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
