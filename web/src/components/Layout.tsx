import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard,
  Server,
  FolderOpen,
  FileText,
  ScrollText,
  Settings,
  Cpu,
  Menu,
  X,
  Bell,
} from 'lucide-react'
import { useStore } from '../store'
import { api, createWebSocket } from '../hooks/api'

const navItems = [
  { path: '/dashboard', icon: LayoutDashboard, label: '仪表盘' },
  { path: '/instances', icon: Server, label: '实例' },
  { path: '/models', icon: FolderOpen, label: '模型' },
  { path: '/templates', icon: FileText, label: '模板' },
  { path: '/logs', icon: ScrollText, label: '日志' },
  { path: '/settings', icon: Settings, label: '设置' },
]

interface LayoutProps {
  children: React.ReactNode
}

export default function Layout({ children }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const { setConfig, setInstances, setModels, setTemplates, setPrompts, setGpuStats, addLog, instances, updateInstance, gpuStats } = useStore()

  useEffect(() => {
    // 加载初始数据
    const loadData = async () => {
      try {
        const [config, insts, models, templates, prompts, gpu] = await Promise.all([
          api.getConfig(),
          api.getInstances(),
          api.scanModels(),
          api.getTemplates(),
          api.getPrompts(),
          api.getGPU(),
        ])
        setConfig(config)
        setInstances(insts)
        setModels(models?.models || [])
        setTemplates(templates?.templates || [])
        setPrompts(prompts?.prompts || [])
        if (gpu?.name) setGpuStats(gpu)
      } catch (e) {
        console.error('Failed to load data:', e)
      }
    }
    loadData()
  }, [])

  useEffect(() => {
    // WebSocket连接
    const ws = createWebSocket((data) => {
      switch (data.type) {
        case 'stats':
          setGpuStats(data.payload)
          break
        case 'instance_status':
          updateInstance(data.payload.id, { status: data.payload.status })
          break
        case 'log':
          addLog({ instance: data.payload.instance, content: data.payload.content })
          break
      }
    })

    return () => ws.close()
  }, [])

  const runningCount = instances.filter(i => i.status === 'running').length

  return (
    <div className="flex min-h-screen">
      {/* 侧边栏 */}
      <motion.aside
        initial={false}
        animate={{ width: sidebarOpen ? 240 : 80 }}
        className="glass border-r border-white/10 flex flex-col"
      >
        {/* Logo */}
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <AnimatePresence>
            {sidebarOpen && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-3"
              >
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                  <Cpu className="w-6 h-6 text-white" />
                </div>
                <span className="font-semibold text-lg">Llama Remote</span>
              </motion.div>
            )}
          </AnimatePresence>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
          >
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {/* 导航 */}
        <nav className="flex-1 p-3 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                  isActive
                    ? 'bg-primary/20 text-primary border border-primary/30'
                    : 'text-gray-400 hover:bg-white/5 hover:text-white'
                }`
              }
            >
              <item.icon size={20} />
              <AnimatePresence>
                {sidebarOpen && (
                  <motion.span
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: 'auto' }}
                    exit={{ opacity: 0, width: 0 }}
                  >
                    {item.label}
                  </motion.span>
                )}
              </AnimatePresence>
            </NavLink>
          ))}
        </nav>

        {/* 底部状态 */}
        {sidebarOpen && gpuStats && (
          <div className="p-4 border-t border-white/10">
            <div className="glass-card p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-400">GPU</span>
                <span className="text-sm font-medium">{gpuStats.name}</span>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">利用率</span>
                  <span>{gpuStats.utilization.toFixed(0)}%</span>
                </div>
                <div className="w-full bg-white/10 rounded-full h-1.5">
                  <div
                    className="bg-gradient-to-r from-primary to-accent h-1.5 rounded-full transition-all"
                    style={{ width: `${gpuStats.utilization}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">显存</span>
                  <span>{gpuStats.memory_used.toFixed(1)} / {gpuStats.memory_total.toFixed(0)} GB</span>
                </div>
                <div className="w-full bg-white/10 rounded-full h-1.5">
                  <div
                    className="bg-gradient-to-r from-success to-warning h-1.5 rounded-full transition-all"
                    style={{ width: `${(gpuStats.memory_used / gpuStats.memory_total) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </motion.aside>

      {/* 主内容区 */}
      <div className="flex-1 flex flex-col">
        {/* 顶部栏 */}
        <header className="h-16 glass border-b border-white/10 flex items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-semibold">Llama Remote</h1>
          </div>
          <div className="flex items-center gap-4">
            {/* 运行状态 */}
            <div className="flex items-center gap-2 px-4 py-2 glass rounded-xl">
              <span className={`status-dot ${runningCount > 0 ? 'status-running' : 'status-stopped'}`} />
              <span className="text-sm">{runningCount} 实例运行中</span>
            </div>
            <button className="p-2 rounded-lg hover:bg-white/10 transition-colors relative">
              <Bell size={20} />
              <span className="absolute top-1 right-1 w-2 h-2 bg-error rounded-full" />
            </button>
          </div>
        </header>

        {/* 内容 */}
        <main className="flex-1 p-6 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
