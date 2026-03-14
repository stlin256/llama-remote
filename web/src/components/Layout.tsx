import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { Server, Cpu } from 'lucide-react'
import { useStore } from '../store'
import { api, createWebSocket } from '../hooks/api'

const navItems = [
  { path: '/dashboard', label: '仪表盘' },
  { path: '/instances', label: '实例' },
  { path: '/models', label: '模型' },
  { path: '/templates', label: '模板' },
  { path: '/logs', label: '日志' },
  { path: '/settings', label: '设置' },
]

export default function Layout({ children }: { children: React.ReactNode }) {
  const [time, setTime] = useState(new Date())
  const { setConfig, setInstances, setModels, setTemplates, setPrompts, setGpuStats, instances } = useStore()

  useEffect(() => {
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
    const ws = createWebSocket((data) => {
      if (data.type === 'stats') {
        setGpuStats(data.payload)
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
      {/* Left side banner - vertical LLAMA-REMOTE */}
      <div style={{
        position: 'absolute',
        left: 8,
        top: '50%',
        transform: 'translateY(-50%)',
        writingMode: 'vertical-rl',
        textOrientation: 'mixed',
        background: 'var(--win-blue)',
        color: 'white',
        padding: '12px 4px',
        fontSize: 18,
        fontWeight: 'bold',
        fontStyle: 'italic',
        letterSpacing: 2,
        border: '2px solid',
        borderColor: 'var(--win-white) var(--win-black) var(--win-black) var(--win-white)',
        zIndex: 10,
      }}>
        LLAMA-REMOTE
      </div>

      {/* Main window */}
      <div
        className="window"
        style={{ top: 20, left: 60, right: 20, bottom: 40, minWidth: 700, minHeight: 450 }}
      >
        {/* Title bar */}
        <div className="title-bar">
          <span>Llama Remote - 控制面板</span>
          <div className="title-bar-buttons">
            <div className="title-bar-btn">_</div>
            <div className="title-bar-btn">X</div>
          </div>
        </div>

        {/* Tab bar */}
        <div style={{
          background: 'var(--win-gray)',
          padding: '4px 4px 0 4px',
          display: 'flex',
          gap: 2
        }}>
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => isActive ? 'tab active' : 'tab'}
            >
              {item.label}
            </NavLink>
          ))}
        </div>

        {/* Content */}
        <div className="window-body">
          <div style={{
            background: 'var(--win-white)',
            border: '2px solid var(--win-gray-dark)',
            borderRightColor: 'var(--win-black)',
            borderBottomColor: 'var(--win-black)',
            padding: 8,
            minHeight: 350,
            height: 'calc(100% - 40px)',
            overflow: 'auto'
          }}>
            {children}
          </div>
        </div>
      </div>

      {/* Status bar */}
      <div style={{
        background: 'var(--win-gray)',
        border: '2px solid',
        borderColor: 'var(--win-gray-dark) var(--win-white) var(--win-white) var(--win-gray-dark)',
        padding: '2px 8px',
        marginBottom: 4,
        display: 'flex',
        gap: 16,
        fontSize: 11
      }}>
        <span>就绪</span>
        <span>{runningCount} 实例运行中</span>
      </div>

      {/* Taskbar */}
      <div className="taskbar">
        <div className="start-button">
          <div style={{
            width: 16,
            height: 16,
            background: 'var(--win-blue)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 10,
            marginRight: 4
          }}>
            <Cpu size={10} color="white" />
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
