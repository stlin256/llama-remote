import { Server, Cpu, Activity, Zap } from 'lucide-react'
import { useStore } from '../store'

export default function Dashboard() {
  const { instances, gpuStats } = useStore()

  const runningInstances = instances.filter(i => i.status === 'running')

  return (
    <div className="flex flex-col gap-4">
      <h2 style={{ fontSize: 14, fontWeight: 'bold', marginBottom: 8 }}>系统概览</h2>

      {/* Stats */}
      <div className="grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <div className="panel" style={{ padding: 8 }}>
          <div className="flex items-center gap-2 mb-2">
            <Server size={16} />
            <span className="text-sm">总实例</span>
          </div>
          <div style={{ fontSize: 24, fontWeight: 'bold' }}>{instances.length}</div>
        </div>
        <div className="panel" style={{ padding: 8 }}>
          <div className="flex items-center gap-2 mb-2">
            <Activity size={16} />
            <span className="text-sm">运行中</span>
          </div>
          <div style={{ fontSize: 24, fontWeight: 'bold', color: '#00aa00' }}>{runningInstances.length}</div>
        </div>
        <div className="panel" style={{ padding: 8 }}>
          <div className="flex items-center gap-2 mb-2">
            <Cpu size={16} />
            <span className="text-sm">GPU利用率</span>
          </div>
          <div style={{ fontSize: 24, fontWeight: 'bold' }}>{gpuStats ? `${gpuStats.utilization.toFixed(0)}%` : 'N/A'}</div>
        </div>
        <div className="panel" style={{ padding: 8 }}>
          <div className="flex items-center gap-2 mb-2">
            <Zap size={16} />
            <span className="text-sm">显存使用</span>
          </div>
          <div style={{ fontSize: 24, fontWeight: 'bold' }}>{gpuStats ? `${gpuStats.memory_used.toFixed(1)}GB` : 'N/A'}</div>
        </div>
      </div>

      {/* GPU Details */}
      {gpuStats && (
        <div className="panel" style={{ marginTop: 8 }}>
          <h3 style={{ fontWeight: 'bold', marginBottom: 8 }}>GPU 监控</h3>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(6, 1fr)', gap: 8, fontSize: 11 }}>
            <div>GPU: {gpuStats.name}</div>
            <div>利用率: {gpuStats.utilization.toFixed(0)}%</div>
            <div>显存: {gpuStats.memory_used.toFixed(1)} / {gpuStats.memory_total.toFixed(0)} GB</div>
            <div>温度: {gpuStats.temperature}°C</div>
            <div>功率: {gpuStats.power.toFixed(0)}W</div>
            <div>限制: {gpuStats.perf_limit || 'None'}</div>
          </div>
        </div>
      )}

      {/* Instances */}
      <div className="panel" style={{ marginTop: 8 }}>
        <h3 style={{ fontWeight: 'bold', marginBottom: 8 }}>实例状态</h3>
        {instances.length === 0 ? (
          <div style={{ padding: 16, textAlign: 'center', color: 'var(--win-gray-dark)' }}>
            暂无实例
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr style={{ background: 'var(--win-gray)', textAlign: 'left' }}>
                <th style={{ padding: '4px 8px', border: '1px solid var(--win-gray-dark)' }}>名称</th>
                <th style={{ padding: '4px 8px', border: '1px solid var(--win-gray-dark)' }}>模型</th>
                <th style={{ padding: '4px 8px', border: '1px solid var(--win-gray-dark)' }}>端口</th>
                <th style={{ padding: '4px 8px', border: '1px solid var(--win-gray-dark)' }}>状态</th>
              </tr>
            </thead>
            <tbody>
              {instances.map((instance) => (
                <tr key={instance.id}>
                  <td style={{ padding: '4px 8px', border: '1px solid var(--win-gray-dark)' }}>{instance.name}</td>
                  <td style={{ padding: '4px 8px', border: '1px solid var(--win-gray-dark)' }}>{instance.model?.split('/').pop() || '未设置'}</td>
                  <td style={{ padding: '4px 8px', border: '1px solid var(--win-gray-dark)' }}>{instance.port || instance.params?.port || 'N/A'}</td>
                  <td style={{ padding: '4px 8px', border: '1px solid var(--win-gray-dark)' }}>
                    <span className={`status-dot status-${instance.status}`} style={{ marginRight: 4 }} />
                    {instance.status}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
