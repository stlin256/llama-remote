import { useEffect, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useStore } from '../store'
import { api, createWebSocket } from '../hooks/api'
import { confirm } from '../components/ConfirmDialog'
import { error } from '../components/MessageDialog'

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
  const navigate = useNavigate()
  const { setConfig, setInstances, setModels, setTemplates, setPrompts, setGpuStats, setSystemStats, setAuthenticated, instances, updateInstanceStatus } = useStore()

  const handleLogout = async () => {
    if (await confirm('确定要退出登录吗？')) {
      await api.logout()
      setAuthenticated(false)
      navigate('/')
    }
  }

  const handleStopAll = async () => {
    if (await confirm('确定要停止所有运行中的实例吗？')) {
      await api.stopAllInstances()
      // 刷新实例列表
      const data = await api.getInstances()
      setInstances(data as any[])
    }
  }

  useEffect(() => {
    const loadData = async () => {
      try {
        const [config, insts, models, templates, prompts, gpu, system] = await Promise.all([
          api.getConfig(),
          api.getInstances(),
          api.scanModels(),
          api.getTemplates(),
          api.getPrompts(),
          api.getGPU(),
          api.getSystem(),
        ])
        setConfig(config)
        setInstances(insts)
        setModels(models?.models || [])
        setTemplates(templates?.templates || [])
        setPrompts(prompts?.prompts || [])
        if (gpu?.name) setGpuStats(gpu)
        if (system) setSystemStats(system)
      } catch (e) {
        console.error('Failed to load data:', e)
      }
    }
    loadData()
  }, [])

  useEffect(() => {
    // WebSocket 监听实时状态更新
    const ws = createWebSocket((data) => {
      if (data.type === 'stats') {
        setGpuStats(data.payload)
      } else if (data.type === 'system') {
        setSystemStats(data.payload)
      } else if (data.type === 'instance_status') {
        // 更新实例状态
        const { id, status } = data.payload
        updateInstanceStatus(id, status)
      } else if (data.type === 'instance_error') {
        // 显示实例错误
        const { id, message: errMsg } = data.payload
        const instance = instances.find(i => i.id === id)
        const name = instance?.name || id
        error(`实例 "${name}" 错误: ${errMsg}`)
      }
    })

    // 定期刷新实例列表作为备份
    const interval = setInterval(async () => {
      try {
        const data = await api.getInstances()
        setInstances(data as any[])
      } catch (e) {
        // ignore
      }
    }, 5000)

    return () => {
      ws.close()
      clearInterval(interval)
    }
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
        top: 8,
        writingMode: 'vertical-rl',
        textOrientation: 'mixed',
        background: 'var(--win-blue)',
        color: 'white',
        padding: '8px 6px',
        fontSize: 20,
        fontWeight: 'bold',
        fontStyle: 'italic',
        letterSpacing: 3,
        border: '2px solid',
        borderColor: 'var(--win-white) var(--win-black) var(--win-black) var(--win-white)',
        zIndex: 10,
        whiteSpace: 'nowrap',
      }}>
        LLAMA-REMOTE
      </div>

      {/* Main window */}
      <div
        className="window"
        style={{ top: 8, left: 60, right: 8, bottom: 8, minWidth: 750, minHeight: 500 }}
      >
        {/* Title bar */}
        <div className="title-bar">
          <span>Llama Remote - 控制面板</span>
          <div className="title-bar-buttons">
            <div className="title-bar-btn" onClick={handleStopAll} title="停止所有实例" style={{ fontSize: 10, padding: '2px 4px' }}>■</div>
            <div className="title-bar-btn" onClick={handleLogout} title="退出登录">X</div>
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
        display: 'flex',
        gap: 16,
        fontSize: 11,
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
      }}>
        <span>就绪</span>
        <span>{runningCount} 实例运行中</span>
        <span style={{ marginLeft: 'auto' }}>
          {time.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
    </div>
  )
}
