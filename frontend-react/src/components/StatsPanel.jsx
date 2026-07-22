import { useEffect, useState } from 'react'
import { fetchStats } from '../api'

export default function StatsPanel({ refreshSignal }) {
  const [stats, setStats] = useState(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const data = await fetchStats()
        if (!cancelled) setStats(data)
      } catch {
        // keep showing the last known stats if a refresh fails
      }
    }
    load()
    const id = setInterval(load, 4000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [refreshSignal])

  const active = (stats?.by_status?.active || 0) + (stats?.by_status?.reopened || 0)
  const pending = stats?.by_status?.candidate || 0
  const severe = stats?.active_by_severity?.severe || 0
  const repaired = (stats?.by_status?.confirmed_repaired || 0) + (stats?.by_status?.likely_repaired || 0)
  const cost = stats?.total_estimated_active_repair_cost_inr ?? 0

  return (
    <div className="stat-row">
      <div className="stat-card">
        <div className="stat-val">{active}</div>
        <div className="stat-lbl">Confirmed</div>
      </div>
      <div className="stat-card">
        <div className="stat-val">{pending}</div>
        <div className="stat-lbl">Pending</div>
      </div>
      <div className="stat-card">
        <div className="stat-val">{severe}</div>
        <div className="stat-lbl">Severe</div>
      </div>
      <div className="stat-card">
        <div className="stat-val">{repaired}</div>
        <div className="stat-lbl">Repaired</div>
      </div>
      <div className="stat-card">
        <div className="stat-val">₹{cost.toLocaleString('en-IN')}</div>
        <div className="stat-lbl">Est. Cost</div>
      </div>
    </div>
  )
}
