import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Server,
  FolderOpen,
  FileText,
  ScrollText,
  Settings,
  Cpu,
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

export default function Layout({ children }: { children: React.ReactNode }) {
  const [time, setTime] = useState(new Date())
  const { setConfig, setInstances, setModels, setTemplates, setPrompts, setGpuStats, instances } = useStore()

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
      }
    })
    return () => ws.close()
  }, [])

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const runningCount = instances.filter(i => i.status === 'running').length

  return (
    <div className="desktop">
      {/* Desktop icons */}
      <div style={{ position: 'absolute', top: 16, left: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className="flex flex-col items-center"
            style={{ width: 64, cursor: 'pointer', color: 'white', textDecoration: 'none' }}
          >
            <item.icon size={32} style={{ filter: 'drop-shadow(1px 1px 0 #000)' }} />
            <span style={{ fontSize: 11, textAlign: 'center', textShadow: '1px 1px 0 #000', marginTop: 4 }}>
              {item.label}
            </span>
          </NavLink>
        ))}
      </div>

      {/* Main window */}
      <div
        className="window"
        style={{ top: 40, left: 100, right: 20, bottom: 40, minWidth: 600, minHeight: 400 }}
      >
        <div className="title-bar">
          <span>Llama Remote</span>
          <div className="title-bar-buttons">
            <div className="title-bar-btn">_</div>
            <div className="title-bar-btn">X</div>
          </div>
        </div>
        <div className="window-body">
          {/* Tab bar */}
          <div className="tabs" style={{ marginBottom: 8 }}>
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) => `tab ${isActive ? 'active' : ''}`}
              >
                {item.label}
              </NavLink>
            ))}
          </div>
          {/* Content */}
          <div style={{ background: 'var(--win-white)', border: '2px solid inset', padding: 8, minHeight: 300 }}>
            {children}
          </div>
        </div>
      </div>

      {/* Status bar */}
      <div style={{ background: 'var(--win-gray)', border: '2px solid', borderColor: 'var(--win-gray-dark) var(--win-white) var(--win-white) var(--win-gray-dark)', padding: '2px 8px', marginBottom: 4, display: 'flex', gap: 16, fontSize: 11 }}>
        <span>就绪</span>
        <span>{runningCount} 实例运行中</span>
      </div>

      {/* Taskbar */}
      <div className="taskbar">
        <div className="start-button">
          <div style={{ width: 16, height: 16, background: 'var(--win-blue)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Cpu size={12} color="white" />
          </div>
          Start
        </div>
        <div className="taskbar-items">
          <div className="taskbar-item active">
            <Server size={12} style={{ marginRight: 4 }} />
            Llama Remote
          </div>
        </div>
        <div className="clock">
          {time.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </div>
  )
}
