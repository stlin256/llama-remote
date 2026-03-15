import { Server, Cpu, Activity, Zap, HardDrive } from 'lucide-react'
import { useStore } from '../store'
import { useTranslation } from '../i18n/useTranslation'

export default function Dashboard() {
  const { instances, gpuStats, systemStats } = useStore()
  const { t, language } = useTranslation()

  const runningInstances = instances.filter(i => i.status === 'running')

  // Remove "GPU" prefix from name
  const gpuName = gpuStats?.name?.replace(/^GPU\s*/i, '') || ''

  return (
    <div className="flex flex-col gap-4">
      <h2 style={{ fontSize: 14, fontWeight: 'bold', marginBottom: 8 }}>{t('systemOverview')}</h2>

      {/* Stats */}
      <div className="grid" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
        <div className="panel" style={{ padding: 8 }}>
          <div className="flex items-center gap-2 mb-2">
            <Server size={16} />
            <span className="text-sm">{t('instances')}</span>
          </div>
          <div style={{ fontSize: 24, fontWeight: 'bold' }}>{instances.length}</div>
        </div>
        <div className="panel" style={{ padding: 8 }}>
          <div className="flex items-center gap-2 mb-2">
            <Activity size={16} />
            <span className="text-sm">{t('running')}</span>
          </div>
          <div style={{ fontSize: 24, fontWeight: 'bold', color: '#00aa00' }}>{runningInstances.length}</div>
        </div>
        <div className="panel" style={{ padding: 8 }}>
          <div className="flex items-center gap-2 mb-2">
            <Cpu size={16} />
            <span className="text-sm">{t('cpu')}</span>
          </div>
          <div style={{ fontSize: 24, fontWeight: 'bold' }}>{systemStats ? `${systemStats.cpu.toFixed(0)}%` : 'N/A'}</div>
        </div>
        <div className="panel" style={{ padding: 8 }}>
          <div className="flex items-center gap-2 mb-2">
            <HardDrive size={16} />
            <span className="text-sm">{t('memory')}</span>
          </div>
          <div style={{ fontSize: 24, fontWeight: 'bold' }}>{systemStats ? `${systemStats.mem_used.toFixed(0)}GB` : 'N/A'}</div>
        </div>
        <div className="panel" style={{ padding: 8 }}>
          <div className="flex items-center gap-2 mb-2">
            <Zap size={16} />
            <span className="text-sm">{t('vram')}</span>
          </div>
          <div style={{ fontSize: 24, fontWeight: 'bold' }}>{gpuStats ? `${gpuStats.memory_used.toFixed(1)}GB` : 'N/A'}</div>
        </div>
      </div>

      {/* System Details */}
      <div className="grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
        {/* CPU & Memory */}
        {systemStats && (
          <div className="panel">
            <h3 style={{ fontWeight: 'bold', marginBottom: 8 }}>{t('systemStatus')}</h3>
            <div className="grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, fontSize: 11 }}>
              <div>CPU: {systemStats.cpu.toFixed(0)}%</div>
              <div>内存: {systemStats.mem_used.toFixed(0)} / {systemStats.mem_total.toFixed(0)} GB</div>
              <div>内存使用率: {systemStats.mem_percent.toFixed(0)}%</div>
            </div>
          </div>
        )}

        {/* GPU Details */}
        {gpuStats && (
          <div className="panel">
            <h3 style={{ fontWeight: 'bold', marginBottom: 8 }}>{t('gpuStatus')}</h3>
            <div className="grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, fontSize: 11 }}>
              <div>{gpuName}</div>
              <div>利用率: {gpuStats.utilization.toFixed(0)}%</div>
              <div>{t('vram')}: {gpuStats.memory_used.toFixed(1)} / {gpuStats.memory_total.toFixed(0)} GB</div>
              <div>温度: {gpuStats.temperature}°C</div>
              <div>功率: {gpuStats.power.toFixed(0)}W</div>
              <div>负载: {gpuStats.memory_load}</div>
            </div>
          </div>
        )}
      </div>

      {/* Instances */}
      <div className="panel" style={{ marginTop: 8 }}>
        <h3 style={{ fontWeight: 'bold', marginBottom: 8 }}>{t('status')}</h3>
        {instances.length === 0 ? (
          <div style={{ padding: 16, textAlign: 'center', color: 'var(--win-gray-dark)' }}>
            {t('noInstances')}
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr style={{ background: 'var(--win-gray)', textAlign: 'left' }}>
                <th style={{ padding: '4px 8px', border: '1px solid var(--win-gray-dark)' }}>{t('name')}</th>
                <th style={{ padding: '4px 8px', border: '1px solid var(--win-gray-dark)' }}>{language === 'zh' ? '模型' : 'Model'}</th>
                <th style={{ padding: '4px 8px', border: '1px solid var(--win-gray-dark)' }}>{t('port')}</th>
                <th style={{ padding: '4px 8px', border: '1px solid var(--win-gray-dark)' }}>{t('status')}</th>
              </tr>
            </thead>
            <tbody>
              {instances.map((instance) => (
                <tr key={instance.id}>
                  <td style={{ padding: '4px 8px', border: '1px solid var(--win-gray-dark)' }}>{instance.name}</td>
                  <td style={{ padding: '4px 8px', border: '1px solid var(--win-gray-dark)' }}>{instance.model?.split('/').pop() || t('notSet')}</td>
                  <td style={{ padding: '4px 8px', border: '1px solid var(--win-gray-dark)' }}>{instance.port || instance.params?.port || 'N/A'}</td>
                  <td style={{ padding: '4px 8px', border: '1px solid var(--win-gray-dark)' }}>
                    <span className={`status-dot status-${instance.status}`} style={{ marginRight: 4 }} />
                    {t(instance.status as any)}
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
