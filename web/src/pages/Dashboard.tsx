import { motion } from 'framer-motion'
import { Server, Cpu, Activity, Zap, Thermometer } from 'lucide-react'
import { useStore } from '../store'

export default function Dashboard() {
  const { instances, gpuStats } = useStore()

  const runningInstances = instances.filter(i => i.status === 'running')

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  }

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
  }

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="space-y-6"
    >
      {/* 统计卡片 */}
      <motion.div variants={item} className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard
          icon={Server}
          label="总实例"
          value={instances.length}
          color="primary"
        />
        <StatCard
          icon={Activity}
          label="运行中"
          value={runningInstances.length}
          color="success"
        />
        <StatCard
          icon={Cpu}
          label="GPU利用率"
          value={gpuStats ? `${gpuStats.utilization.toFixed(0)}%` : 'N/A'}
          color="accent"
        />
        <StatCard
          icon={Zap}
          label="显存使用"
          value={gpuStats ? `${gpuStats.memory_used.toFixed(1)}GB` : 'N/A'}
          color="warning"
        />
      </motion.div>

      {/* GPU 详情 */}
      {gpuStats && (
        <motion.div variants={item} className="glass-card p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Cpu className="text-accent" />
            GPU 监控
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            <GPUStat label="GPU" value={gpuStats.name} />
            <GPUStat label="利用率" value={`${gpuStats.utilization.toFixed(0)}%`} />
            <GPUStat label="显存" value={`${gpuStats.memory_used.toFixed(1)} / ${gpuStats.memory_total.toFixed(0)} GB`} />
            <GPUStat label="温度" value={`${gpuStats.temperature}°C`} icon={<Thermometer size={14} />} />
            <GPUStat label="功率" value={`${gpuStats.power.toFixed(0)}W`} />
            <GPUStat label="性能限制" value={gpuStats.perf_limit || 'None'} />
          </div>
        </motion.div>
      )}

      {/* 实例列表 */}
      <motion.div variants={item} className="glass-card p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Server className="text-primary" />
          实例状态
        </h2>
        {instances.length === 0 ? (
          <p className="text-gray-500 text-center py-8">暂无实例，请先创建</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {instances.map((instance) => (
              <div
                key={instance.id}
                className="p-4 bg-white/5 rounded-xl border border-white/10"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="font-medium">{instance.name}</span>
                  <span className={`status-dot status-${instance.status}`} />
                </div>
                <div className="space-y-1 text-sm text-gray-400">
                  <p>模型: {instance.model?.split('/').pop() || '未设置'}</p>
                  <p>端口: {instance.port || instance.params?.port || 'N/A'}</p>
                  <p>状态: {instance.status}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </motion.div>
    </motion.div>
  )
}

function StatCard({ icon: Icon, label, value, color }: {
  icon: any
  label: string
  value: string | number
  color: string
}) {
  const colors: Record<string, string> = {
    primary: 'from-primary to-purple-500',
    success: 'from-success to-emerald-500',
    accent: 'from-accent to-cyan-500',
    warning: 'from-warning to-orange-500',
  }

  return (
    <div className="glass-card p-4 flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${colors[color]} flex items-center justify-center`}>
        <Icon className="w-6 h-6 text-white" />
      </div>
      <div>
        <p className="text-sm text-gray-400">{label}</p>
        <p className="text-2xl font-semibold">{value}</p>
      </div>
    </div>
  )
}

function GPUStat({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="text-center">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="font-medium flex items-center justify-center gap-1">
        {icon}
        {value}
      </p>
    </div>
  )
}
