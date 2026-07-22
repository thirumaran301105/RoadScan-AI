import { useEffect, useState, useRef } from 'react'
import { fetchRoadType } from '../api.js'

const POLL_INTERVAL_MS = 15000
const ROAD_TYPE_LABELS = {
  national_highway: 'National Highway',
  state_highway: 'State Highway',
  arterial_road: 'Arterial Road',
  residential_road: 'Residential Road',
  unknown: 'Unknown (detecting...)',
}

/**
 * Polls /api/road_type for the device's current GPS position, so the UI
 * can show "Detected road type: Arterial Road" instead of asking the
 * driver to pick one - road type is inferred from GPS position against
 * OpenStreetMap's own road classification data (see backend/road_classifier.py).
 */
export function useRoadType(position) {
  const [roadType, setRoadType] = useState(null)
  const lastFetchedRef = useRef(0)

  useEffect(() => {
    if (!position) return

    let cancelled = false
    async function load() {
      try {
        const data = await fetchRoadType(position.latitude, position.longitude)
        if (!cancelled) setRoadType(data.road_type)
      } catch {
        // keep showing the last known value if a lookup fails
      }
    }

    const now = Date.now()
    if (now - lastFetchedRef.current > POLL_INTERVAL_MS) {
      lastFetchedRef.current = now
      load()
    }
    const id = setInterval(() => {
      lastFetchedRef.current = Date.now()
      load()
    }, POLL_INTERVAL_MS)

    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [position?.latitude, position?.longitude])

  return { roadType, label: ROAD_TYPE_LABELS[roadType] || 'Detecting road type...' }
}
