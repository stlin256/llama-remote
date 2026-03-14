import { useEffect, useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Instances from './pages/Instances'
import Models from './pages/Models'
import Templates from './pages/Templates'
import Logs from './pages/Logs'
import Settings from './pages/Settings'
import Login from './pages/Login'
import { useStore } from './store'
import { api } from './hooks/api'
import { useConfirm } from './components/ConfirmDialog'
import { useMessage } from './components/MessageDialog'

function AppContent() {
  const { setConfig, authenticated, setAuthenticated } = useStore()
  const [loading, setLoading] = useState(true)
  const { ConfirmDialog } = useConfirm()
  const { MessageDialog } = useMessage()

  useEffect(() => {
    const checkAuth = async () => {
      try {
        // 先获取配置，检查是否启用了认证
        const cfg = await api.getConfig()
        setConfig(cfg)

        if (cfg.auth?.enable) {
          // 如果启用了认证，检查登录状态
          const result = await api.checkAuth()
          setAuthenticated(result.authenticated)
        } else {
          // 未启用认证，直接通过
          setAuthenticated(true)
        }
      } catch (e) {
        console.error('Failed to check auth:', e)
        setAuthenticated(false)
      } finally {
        setLoading(false)
      }
    }
    checkAuth()
  }, [])

  if (loading) {
    return (
      <div className="desktop" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div className="window" style={{ width: 200, padding: 20, textAlign: 'center' }}>
          加载中...
        </div>
      </div>
    )
  }

  // 如果未认证，显示登录页面
  if (!authenticated) {
    return <Login />
  }

  return (
    <>
      <ConfirmDialog />
      <MessageDialog />
      <div className="bg-glow" />
      <Layout>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/instances" element={<Instances />} />
        <Route path="/models" element={<Models />} />
        <Route path="/templates" element={<Templates />} />
        <Route path="/logs" element={<Logs />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </Layout>
    </>
  )
}

function App() {
  return <AppContent />
}

export default App
