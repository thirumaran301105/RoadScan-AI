import { useState, useCallback } from 'react'
import DriverView from './components/DriverView.jsx'
import Dashboard from './components/Dashboard.jsx'

export default function App() {
  const [tab, setTab] = useState('driver')
  const [refreshSignal, setRefreshSignal] = useState(0)

  const bumpRefresh = useCallback(() => setRefreshSignal((n) => n + 1), [])

  return (
    <div className="app">
      <header>
        <h1>🕳️ RoadScan AI</h1>
        <span className="tagline">Pothole & Road Damage Intelligence - continuous detection, driver alerts, repair verification</span>
      </header>

      {!window.isSecureContext && (
        <div className="insecure-context-banner">
          ⚠️ <b>This page is loaded over plain HTTP</b> ({window.location.origin}) - browsers block
          camera and location access entirely on insecure connections, so <b>Start Watching will not
          work</b> until you switch to HTTPS. Use a tunnel (<code>ngrok http 8000</code>) and open the{' '}
          <code>https://...ngrok-free.app</code> link it gives you instead. See the README for details.
        </div>
      )}

      <div className="tabs">
        <button className={`tab-btn ${tab === 'driver' ? 'active' : ''}`} onClick={() => setTab('driver')}>
          🚗 Driver View
        </button>
        <button className={`tab-btn ${tab === 'dashboard' ? 'active' : ''}`} onClick={() => setTab('dashboard')}>
          🗺️ Management Dashboard
        </button>
      </div>

      <div className="tab-content">
        {tab === 'driver' && <DriverView onPotholeLogged={bumpRefresh} />}
        {tab === 'dashboard' && <Dashboard refreshSignal={refreshSignal} bumpRefresh={bumpRefresh} />}
      </div>
    </div>
  )
}
