import { ReactNode, useState, useEffect, useRef } from 'react'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useStore } from '../store'
import { api, createWebSocket } from '../hooks/api'
import { confirm } from '../components/ConfirmDialog'
import { error as showError } from '../components/MessageDialog'
import { useTranslation } from '../i18n/useTranslation'
import { useIsMobile } from '../hooks/useMediaQuery'
import { Home, Server, BookOpen, FileText, Settings, LogOut, Square, MessageCircle } from 'lucide-react'
import { INSTANCE_REFRESH_INTERVAL } from '../utils'

interface ResponsiveLayoutProps {
  children: ReactNode
}

export default function ResponsiveLayout({ children }: ResponsiveLayoutProps) {
  const isMobile = useIsMobile()
  const desktopRibbonWidth = 68
  const [menuOpen, setMenuOpen] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const { setConfig, setInstances, setModels, setTemplates, setPrompts, setGpuStats, setSystemStats, setAuthenticated, instances, updateInstanceStatus, setInstanceProgress, addLog, setInstanceError, language } = useStore()
  const { t } = useTranslation()

  // Define navItems before using it
  const navItems = [
    { path: '/dashboard', label: t('dashboard'), icon: Home },
    { path: '/chat', label: t('chat'), icon: MessageCircle },
    { path: '/instances', label: t('instances'), icon: Server },
    { path: '/models', label: t('models'), icon: BookOpen },
    { path: '/templates', label: t('templates'), icon: FileText },
    { path: '/logs', label: t('logs'), icon: FileText },
    { path: '/settings', label: t('settings'), icon: Settings },
  ]

  // Get current page title from navItems
  const currentNavItem = navItems.find(item => item.path === location.pathname)
  const currentPageTitle = currentNavItem?.label || t('dashboard')

  // Use ref to avoid stale closure in WebSocket callback
  const instancesRef = useRef(instances)
  instancesRef.current = instances
  const tRef = useRef(t)
  tRef.current = t

  const handleLogout = async () => {
    if (await confirm(t('confirmLogout'))) {
      await api.logout()
      setAuthenticated(false)
      navigate('/')
    }
  }

  const handleStopAll = async () => {
    if (await confirm(t('confirmStopAll'))) {
      await api.stopAllInstances()
      const data = await api.getInstances()
      setInstances(data as any[])
    }
  }

  // 加载数据
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

  // WebSocket 监听实时状态更新
  useEffect(() => {
    const ws = createWebSocket((data) => {
      if (data.type === 'stats') {
        setGpuStats(data.payload)
      } else if (data.type === 'system') {
        setSystemStats(data.payload)
      } else if (data.type === 'instance_status') {
        const { id, status } = data.payload
        updateInstanceStatus(id, status)
      } else if (data.type === 'instance_error') {
        const { id, message: errMsg } = data.payload
        setInstanceError(id, errMsg)
        const instance = instancesRef.current.find(i => i.id === id)
        const name = instance?.name || id
        showError(tRef.current('instanceError').replace('{name}', name).replace('{error}', errMsg))
      } else if (data.type === 'instance_progress') {
        const { id, progress, message } = data.payload
        setInstanceProgress(id, progress, message)
      } else if (data.type === 'log') {
        const { instance: logInstance, content } = data.payload
        if (logInstance) {
          addLog({ instance: logInstance, content })
        }
      }
    })

    // 定期刷新实例列表
    const interval = setInterval(async () => {
      try {
        const data = await api.getInstances()
        setInstances(data as any[])
      } catch (e) {
        // ignore
      }
    }, INSTANCE_REFRESH_INTERVAL)

    return () => {
      ws.close()
      clearInterval(interval)
    }
  }, [])

  // Desktop layout
  if (!isMobile) {
    return (
      <div className="desktop">
        {/* Left side banner - vertical LLAMA-REMOTE */}
        <div style={{
          position: 'absolute',
          left: 8,
          top: 8,
          bottom: 8,
          width: desktopRibbonWidth,
          writingMode: 'vertical-rl',
          textOrientation: 'mixed',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          background: 'var(--win-blue)',
          color: 'white',
          padding: '12px 6px',
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
          style={{ top: 8, left: 8 + desktopRibbonWidth + 12, right: 8, bottom: 8, minWidth: 750, minHeight: 500 }}
        >
          {/* Title bar */}
          <div className="title-bar">
            <span>Llama Remote - {currentPageTitle}</span>
            <div className="title-bar-buttons">
              <div className="title-bar-btn" onClick={handleStopAll} title={t('stopAll')} style={{ fontSize: 10, padding: '2px 4px' }}>■</div>
              <div className="title-bar-btn" onClick={handleLogout} title={t('logout')}>X</div>
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
          <span>{t('ready')}</span>
          <span>{instances.filter(i => i.status === 'running').length} {t('running')}</span>
          <span style={{ marginLeft: 'auto' }}>
            {new Date().toLocaleTimeString(language === 'zh' ? 'zh-CN' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      </div>
    )
  }

  // Mobile layout - Windows 95 style
  return (
    <div className="mobile-layout" style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      background: 'var(--win-gray)',
      overflow: 'hidden'
    }}>
      {/* Mobile header - Win95 title bar style */}
      <header style={{
        background: 'var(--win-blue)',
        color: 'white',
        padding: '8px 12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        border: '2px solid',
        borderColor: 'var(--win-white) var(--win-black) var(--win-black) var(--win-white)',
        zIndex: 100
      }}>
        <div style={{ fontWeight: 'bold', fontSize: 15, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ background: 'var(--win-gray)', color: 'black', padding: '2px 4px', border: '1px solid' }}>_</span>
          Llama Remote
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            onClick={handleStopAll}
            title={t('stopAll')}
            style={{
              background: 'var(--win-gray)',
              border: '2px solid',
              borderColor: 'var(--win-white) var(--win-black) var(--win-black) var(--win-white)',
              color: 'black',
              padding: '2px 8px',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 'bold'
            }}
          >
            ■
          </button>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            style={{
              background: 'var(--win-gray)',
              border: '2px solid',
              borderColor: 'var(--win-white) var(--win-black) var(--win-black) var(--win-white)',
              color: 'black',
              padding: '2px 8px',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 'bold'
            }}
          >
            {menuOpen ? 'X' : '▣'}
          </button>
        </div>
      </header>

      {/* Mobile menu overlay - Win95 window style */}
      {menuOpen && (
        <div style={{
          position: 'fixed',
          top: 44,
          left: 4,
          right: 4,
          bottom: 70,
          background: 'var(--win-gray)',
          border: '2px solid',
          borderColor: 'var(--win-black) var(--win-white) var(--win-white) var(--win-black)',
          zIndex: 99,
          overflow: 'auto'
        }}>
          {/* Win95 menu title bar */}
          <div style={{
            background: 'var(--win-blue)',
            color: 'white',
            padding: '4px 8px',
            fontWeight: 'bold',
            fontSize: 13,
            display: 'flex',
            justifyContent: 'space-between'
          }}>
            <span>Menu</span>
            <button
              onClick={() => setMenuOpen(false)}
              style={{
                background: 'var(--win-gray)',
                border: '1px solid',
                borderColor: 'var(--win-white) var(--win-black) var(--win-black) var(--win-white)',
                color: 'black',
                padding: '0 4px',
                cursor: 'pointer',
                fontSize: 10,
                fontWeight: 'bold',
                lineHeight: 1
              }}
            >
              X
            </button>
          </div>
          <nav style={{ padding: '4px 0' }}>
            {navItems.map((item) => {
              const Icon = item.icon
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={() => setMenuOpen(false)}
                  style={({ isActive }) => ({
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '8px 12px',
                    color: 'var(--win-black)',
                    background: isActive ? 'var(--win-blue)' : 'var(--win-gray)',
                    textDecoration: 'none',
                    fontSize: 14
                  })}
                >
                  <Icon size={20} />
                  {item.label}
                </NavLink>
              )
            })}
            <button
              onClick={() => {
                setMenuOpen(false)
                handleStopAll()
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '8px 12px',
                color: 'var(--win-black)',
                background: 'var(--win-gray)',
                border: 'none',
                width: '100%',
                textAlign: 'left',
                fontSize: 14,
                cursor: 'pointer'
              }}
            >
              <Square size={16} style={{ color: '#dc2626' }} />
              {t('stopAll')}
            </button>
            <button
              onClick={() => {
                setMenuOpen(false)
                handleLogout()
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '8px 12px',
                color: 'var(--win-black)',
                background: 'var(--win-gray)',
                border: 'none',
                width: '100%',
                textAlign: 'left',
                fontSize: 14,
                cursor: 'pointer'
              }}
            >
              <LogOut size={16} />
              {t('logout')}
            </button>
          </nav>
        </div>
      )}

      {/* Mobile content */}
      <main style={{
        flex: 1,
        overflow: 'auto',
        padding: 12,
        background: 'var(--win-white)'
      }}>
        {children}
      </main>

      {/* Mobile bottom navigation - Win95 style */}
      <nav style={{
        background: 'var(--win-gray)',
        borderTop: '2px solid',
        borderColor: 'var(--win-gray-dark) var(--win-white) var(--win-white) var(--win-gray-dark)',
        display: 'flex',
        justifyContent: 'space-around',
        padding: '4px 2px',
        zIndex: 100
      }}>
        {navItems.map((item) => {
          const Icon = item.icon
          return (
            <NavLink
              key={item.path}
              to={item.path}
              style={({ isActive }) => ({
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 1,
                padding: '2px 4px',
                background: isActive ? 'var(--win-white)' : 'var(--win-gray)',
                border: '2px solid',
                borderColor: isActive ? 'var(--win-white) var(--win-black) var(--win-black) var(--win-white)' : 'var(--win-gray) var(--win-gray) var(--win-gray) var(--win-gray)',
                color: isActive ? 'var(--win-blue)' : 'var(--win-black)',
                textDecoration: 'none',
                fontSize: 9,
                minWidth: 48
              })}
            >
              <Icon size={16} />
              <span style={{ maxWidth: 48, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {item.label}
              </span>
            </NavLink>
          )
        })}
      </nav>

      {/* Mobile status bar - Win95 style */}
      <div style={{
        background: 'var(--win-gray)',
        borderTop: '2px solid',
        borderColor: 'var(--win-gray-dark) var(--win-white) var(--win-white) var(--win-gray-dark)',
        padding: '4px 8px',
        display: 'flex',
        gap: 12,
        fontSize: 11,
        zIndex: 100
      }}>
        <span>{t('ready')}</span>
        <span>{instances.filter(i => i.status === 'running').length} {t('running')}</span>
        <span style={{ marginLeft: 'auto' }}>
          {new Date().toLocaleTimeString(language === 'zh' ? 'zh-CN' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
    </div>
  )
}
