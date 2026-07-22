import { useRef, useState, useCallback, useEffect } from 'react'

/**
 * Manages the /ws/frame_stream connection: sends {frame, latitude,
 * longitude} and surfaces whatever the backend sends back (detection
 * boxes + any newly-fired driver alerts).
 *
 * IMPORTANT: frame sampling is DISTANCE-based, not fixed-time-based.
 * A fixed time interval (e.g. "every 1.2 seconds") leaves huge gaps at
 * higher speed - at 40 km/h (~11 m/s), a 1.2s interval means ~13 meters
 * pass between each photo taken, and a pothole sitting entirely within
 * that gap is simply never seen. Sampling by distance traveled instead
 * means faster movement automatically triggers more frequent captures,
 * keeping the spatial coverage roughly consistent regardless of speed -
 * within the hard floor below, which is set by how fast the backend can
 * actually run inference (see MIN_TIME_BETWEEN_FRAMES_MS).
 */
const MIN_DISTANCE_METERS_BETWEEN_FRAMES = 8    // ~ once per this many meters traveled
const MAX_TIME_BETWEEN_FRAMES_MS = 2000          // send at least this often even if stationary
const MIN_TIME_BETWEEN_FRAMES_MS = 200           // hard floor - corrected from an earlier, wrong estimate.
                                                   // Direct benchmarking of the actual production
                                                   // detect_frame() function measured ~70ms/frame steady-
                                                   // state on a plain CPU (the original ~1s figure was a
                                                   // one-time cold-start measurement, not steady-state -
                                                   // see README section 3). 200ms leaves headroom for
                                                   // JPEG encoding + network round-trip + JSON overhead on
                                                   // top of the ~70ms of actual model inference.
const CHECK_INTERVAL_MS = 200                     // how often we check whether it's time to send

function haversineMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000
  const toRad = (d) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)))
}

export function useFrameStreamSocket({ captureFrameDataUrl, getPosition, enabled }) {
  const wsRef = useRef(null)
  const intervalRef = useRef(null)
  const [connected, setConnected] = useState(false)
  const [lastDetections, setLastDetections] = useState([])
  const [alerts, setAlerts] = useState([])
  const [warning, setWarning] = useState(null)
  const [framesSent, setFramesSent] = useState(0)
  const lastSentRef = useRef({ lat: null, lon: null, at: 0 })

  const connect = useCallback(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws'
    const ws = new WebSocket(`${protocol}://${window.location.host}/ws/frame_stream`)
    wsRef.current = ws

    ws.onopen = () => setConnected(true)
    ws.onclose = () => {
      setConnected(false)
      wsRef.current = null
    }
    ws.onerror = () => ws.close()
    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data)
        if (msg.type === 'frame_result') {
          setLastDetections(msg.detections || [])
          setWarning(msg.warning || null)
          if (msg.alerts && msg.alerts.length > 0) {
            setAlerts((prev) => [...msg.alerts, ...prev].slice(0, 50))
          }
        } else if (msg.type === 'error') {
          console.warn('[frame_stream] server error:', msg.message)
        }
      } catch {
        // ignore malformed frame
      }
    }
  }, [])

  const disconnect = useCallback(() => {
    if (wsRef.current) wsRef.current.close()
    wsRef.current = null
    setConnected(false)
  }, [])

  useEffect(() => {
    if (!enabled) {
      disconnect()
      clearInterval(intervalRef.current)
      return
    }

    connect()
    lastSentRef.current = { lat: null, lon: null, at: 0 }

    intervalRef.current = setInterval(() => {
      const ws = wsRef.current
      if (!ws || ws.readyState !== WebSocket.OPEN) return

      const now = Date.now()
      const elapsed = now - lastSentRef.current.at
      if (elapsed < MIN_TIME_BETWEEN_FRAMES_MS) return // never faster than inference can keep up

      const position = getPosition()
      let shouldSend = elapsed >= MAX_TIME_BETWEEN_FRAMES_MS // always send eventually, even if stationary

      if (!shouldSend && position && lastSentRef.current.lat !== null) {
        const distance = haversineMeters(
          lastSentRef.current.lat, lastSentRef.current.lon,
          position.latitude, position.longitude,
        )
        shouldSend = distance >= MIN_DISTANCE_METERS_BETWEEN_FRAMES
      } else if (!shouldSend && position && lastSentRef.current.lat === null) {
        shouldSend = true // first reading with a real GPS fix - send immediately
      }

      if (!shouldSend) return

      const dataUrl = captureFrameDataUrl()
      if (!dataUrl) return

      ws.send(JSON.stringify({
        frame: dataUrl,
        latitude: position?.latitude ?? null,
        longitude: position?.longitude ?? null,
      }))
      setFramesSent((n) => n + 1)
      lastSentRef.current = { lat: position?.latitude ?? null, lon: position?.longitude ?? null, at: now }
    }, CHECK_INTERVAL_MS)

    return () => {
      clearInterval(intervalRef.current)
      disconnect()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled])

  return { connected, lastDetections, alerts, warning, framesSent }
}
