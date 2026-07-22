import { useState, useCallback } from 'react'
import LiveMap from './LiveMap.jsx'
import StatsPanel from './StatsPanel.jsx'
import PriorityTable from './PriorityTable.jsx'
import BatchUpload from './BatchUpload.jsx'
import { useGeolocation } from '../hooks/useGeolocation.js'

export default function Dashboard({ refreshSignal, bumpRefresh }) {
  const geo = useGeolocation()
  const [mapGeoStarted, setMapGeoStarted] = useState(false)

  const handleShowMyLocation = useCallback(() => {
    geo.start()
    setMapGeoStarted(true)
  }, [geo])

  return (
    <div className="layout">
      <div>
        <div className="panel">
          <div className="panel-header">
            <h2>Live Map</h2>
            {!mapGeoStarted && (
              <button className="secondary small" onClick={handleShowMyLocation}>Show my location</button>
            )}
          </div>
          <LiveMap devicePosition={geo.position} refreshSignal={refreshSignal} />
        </div>
        <div style={{ marginTop: 14 }}>
          <BatchUpload onUploaded={bumpRefresh} />
        </div>
      </div>

      <div>
        <div className="panel">
          <h2>Summary</h2>
          <StatsPanel refreshSignal={refreshSignal} />
        </div>
        <div className="panel" style={{ marginTop: 14 }}>
          <h2>Priority Repair List</h2>
          <PriorityTable refreshSignal={refreshSignal} onChange={bumpRefresh} />
        </div>
      </div>
    </div>
  )
}
