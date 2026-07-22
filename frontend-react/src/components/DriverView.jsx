import CameraFeed from './CameraFeed.jsx'
import AlertBanner from './AlertBanner.jsx'
import StatusBar from './StatusBar.jsx'
import AlertLog from './AlertLog.jsx'
import { useCamera } from '../hooks/useCamera.js'
import { useGeolocation } from '../hooks/useGeolocation.js'
import { useFrameStreamSocket } from '../hooks/useFrameStreamSocket.js'
import { useRoadType } from '../hooks/useRoadType.js'
import { useState } from 'react'

export default function DriverView({ onPotholeLogged }) {
  const camera = useCamera()
  const geo = useGeolocation()
  const [watching, setWatching] = useState(false)
  const { label: roadTypeLabel } = useRoadType(geo.position)

  const { connected, lastDetections, alerts, warning, framesSent } = useFrameStreamSocket({
    captureFrameDataUrl: camera.captureFrameDataUrl,
    getPosition: () => geo.position,
    enabled: watching && camera.active,
  })

  async function startWatching() {
    await camera.start()
    geo.start()
    setWatching(true)
  }

  function stopWatching() {
    setWatching(false)
    camera.stop()
    geo.stop()
  }

  // Fire onPotholeLogged whenever a new alert lands, so the parent can
  // nudge the dashboard's map/table to refresh sooner than their own poll.
  const latestAlert = alerts[0] || null
  if (latestAlert) onPotholeLogged?.()

  const cameraBlocked = camera.permissionState === 'denied'
  const gpsBlocked = geo.permissionState === 'denied'

  return (
    <div className="layout">
      <div>
        <div className="panel">
          <h2>Live Camera Feed (your device)</h2>

          {(cameraBlocked || gpsBlocked) && !watching && (
            <div className="permission-blocked-banner">
              ⚠️ {cameraBlocked && gpsBlocked
                ? 'Camera AND location are both already blocked'
                : cameraBlocked ? 'Camera is already blocked' : 'Location is already blocked'}{' '}
              for this site from an earlier attempt - tapping Start Watching will fail silently instead of
              asking again. Reset it first: tap the lock/info icon in your address bar → Permissions → set
              Camera/Location back to "Ask" (on iPhone: Settings → Safari → Camera/Location → "Ask"), then
              reload this page.
            </div>
          )}

          <div className="controls">
            {!watching ? (
              <button onClick={startWatching}>Start Watching</button>
            ) : (
              <button className="stop secondary" onClick={stopWatching}>Stop</button>
            )}
            {camera.active && (
              <button className="secondary" onClick={camera.switchCamera}>
                Switch Camera ({camera.facingMode === 'environment' ? 'rear' : 'front'})
              </button>
            )}
            <span className="road-type-badge" title="Detected automatically from your device's GPS position against OpenStreetMap road data">
              🛣️ {roadTypeLabel}
            </span>
          </div>
          {camera.error && <div className="error-text">{camera.error}</div>}
          {geo.error && <div className="warning-text">{geo.error}</div>}
          {warning && <div className="warning-text">{warning}</div>}

          <AlertBanner latestAlert={latestAlert} />
          <CameraFeed videoRef={camera.videoRef} active={camera.active} detections={lastDetections} />
          <StatusBar
            position={geo.position}
            gpsStatus={geo.status}
            gpsError={geo.error}
            connected={connected}
            framesSent={framesSent}
          />
        </div>
      </div>

      <div>
        <div className="panel">
          <h2>Recent Alerts</h2>
          <AlertLog alerts={alerts} />
        </div>
      </div>
    </div>
  )
}
