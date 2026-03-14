import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Instances from './pages/Instances'
import Models from './pages/Models'
import Templates from './pages/Templates'
import Logs from './pages/Logs'
import Settings from './pages/Settings'

function App() {
  return (
    <>
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

export default App
