import { accuracyLabel } from '../hooks/useGeolocation.js'

const GPS_STATE = {
  idle: { dot: 'off', label: 'GPS not started' },
  locating: { dot: 'locating', label: 'Finding device location...' },
  active: { dot: 'on', label: 'Device GPS locked' },
  error: { dot: 'off', label: 'GPS unavailable' },
}

export default function StatusBar({ position, gpsStatus, gpsError, connected, framesSent }) {
  const gps = GPS_STATE[gpsStatus] || GPS_STATE.idle
  const accuracy = position ? accuracyLabel(position.accuracy) : null
  const isBroken = accuracy?.level === 'broken'

  return (
    <div className="status-bar">
      {isBroken && (
        <div className="accuracy-broken-banner">
          ⚠️ Location is off by roughly {(position.accuracy / 1000).toLocaleString('en-IN', { maximumFractionDigits: 0 })} km - {accuracy.text}
        </div>
      )}
      <div className="status-item">
        <span className={`dot ${connected ? 'on' : 'off'}`} />
        {connected ? 'Connected to detection backend' : 'Not connected'}
      </div>
      <div className="status-item">
        <span className={`dot ${gps.dot}`} />
        {position
          ? `${gps.label}: ${position.latitude.toFixed(5)}, ${position.longitude.toFixed(5)}`
          : gps.label}
      </div>
      {accuracy && !isBroken && (
        <div className={`status-item accuracy-${accuracy.level}`}>
          Accuracy: {'\u00b1'}{Math.round(position.accuracy)}m - {accuracy.text}
        </div>
      )}
      {gpsError && gpsStatus !== 'active' && <div className="status-item gps-guidance">{gpsError}</div>}
      <div className="status-item muted">{framesSent} frames analyzed this session</div>
    </div>
  )
}
