import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import {
  Server,
  Cpu,
} from 'lucide-react'
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
      {/* Main window - left sidebar style */}
      <div
        className="window"
        style={{ top: 20, left: 20, right: 20, bottom: 40, minWidth: 700, minHeight: 450 }}
      >
        <div className="title-bar">
          <span>Llama Remote - 控制面板</span>
          <div className="title-bar-buttons">
            <div className="title-bar-btn">_</div>
            <div className="title-bar-btn">X</div>
          </div>
        </div>
        <div className="window-body" style={{ display: 'flex', padding: 0 }}>
          {/* Left sidebar - WIN98 banner style */}
          <div style={{
            width: 160,
            background: 'var(--win-gray)',
            borderRight: '2px solid var(--win-gray-dark)',
            padding: 8,
            display: 'flex',
            flexDirection: 'column',
            gap: 4
          }}>
            {/* Logo banner */}
            <div style={{
              background: 'var(--win-blue)',
              color: 'white',
              padding: 8,
              marginBottom: 8,
              display: 'flex',
              alignItems: 'center',
              gap: 8
            }}>
              <Cpu size={24} />
              <div>
                <div style={{ fontWeight: 'bold', fontSize: 12 }}>Llama</div>
                <div style={{ fontWeight: 'bold', fontSize: 12 }}>Remote</div>
              </div>
            </div>

            {/* Navigation items - vertical */}
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}
                style={{
                  display: 'block',
                  padding: '6px 8px',
                  textDecoration: 'none',
                  fontSize: 11,
                  cursor: 'pointer',
                }}
              >
                {item.label}
              </NavLink>
            ))}
          </div>

          {/* Right content area */}
          <div style={{ flex: 1, padding: 8, overflow: 'auto' }}>
            <div style={{
              background: 'var(--win-white)',
              border: '2px solid var(--win-gray-dark)',
              borderRightColor: 'var(--win-black)',
              borderBottomColor: 'var(--win-black)',
              padding: 8,
              minHeight: '100%',
              overflow: 'auto'
            }}>
              {children}
            </div>
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
