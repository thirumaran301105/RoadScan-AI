import { useEffect, useState, useCallback, useRef } from 'react'
import { GoogleMap, Marker, Circle, InfoWindow, useJsApiLoader } from '@react-google-maps/api'
import { fetchAllPotholes } from '../api.js'

const SEVERITY_COLOR = { minor: '#f2c94c', moderate: '#f2a900', severe: '#d62839' }
const STATUS_COLOR = { confirmed_repaired: '#2ecc71', likely_repaired: '#7fdba0', candidate: '#6b7076' }
const DEFAULT_CENTER = { lat: 12.9716, lng: 77.5946 }
const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY

const MAP_CONTAINER_STYLE = { width: '100%', height: '420px', borderRadius: '8px' }

// Dark map styling to match the rest of the dashboard, instead of Google's
// default light theme clashing with everything else.
const DARK_MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#1e2124' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1e2124' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#9aa1a8' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#34383c' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#212428' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#3a3f44' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0f1113' }] },
  { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#242729' }] },
  { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
]

function markerColor(p) {
  return STATUS_COLOR[p.status] || SEVERITY_COLOR[p.severity] || '#9aa1a8'
}

export default function LiveMap({ devicePosition, refreshSignal }) {
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'roadscan-google-map',
    googleMapsApiKey: GOOGLE_MAPS_API_KEY || '',
  })

  const [potholes, setPotholes] = useState([])
  const [selected, setSelected] = useState(null)
  const mapRef = useRef(null)
  const hasCenteredRef = useRef(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const data = await fetchAllPotholes()
        if (!cancelled) setPotholes(data)
      } catch {
        // keep showing the last known markers if a refresh fails
      }
    }
    load()
    const id = setInterval(load, 4000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [refreshSignal])

  const onLoad = useCallback((map) => {
    mapRef.current = map
  }, [])

  // Recenter once, the first time we get a real device fix - not on every
  // update, or the map would fight the driver every time they try to pan.
  useEffect(() => {
    if (devicePosition && mapRef.current && !hasCenteredRef.current) {
      mapRef.current.panTo({ lat: devicePosition.latitude, lng: devicePosition.longitude })
      hasCenteredRef.current = true
    }
  }, [devicePosition])

  if (!GOOGLE_MAPS_API_KEY) {
    return (
      <div className="map-config-notice">
        <b>Google Maps API key not set.</b>
        <p>
          Add <code>VITE_GOOGLE_MAPS_API_KEY=your_key_here</code> to a <code>.env</code> file in{' '}
          <code>frontend-react/</code>, then rebuild. See the README for how to get a key (requires
          a Google Cloud project with billing enabled and the "Maps JavaScript API" turned on).
        </p>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="map-config-notice error">
        <b>Google Maps failed to load.</b>
        <p>Check that your API key is valid and the Maps JavaScript API is enabled for it.</p>
      </div>
    )
  }

  if (!isLoaded) {
    return <div className="map-loading">Loading map...</div>
  }

  const center = devicePosition
    ? { lat: devicePosition.latitude, lng: devicePosition.longitude }
    : potholes.length
      ? { lat: potholes[0].latitude, lng: potholes[0].longitude }
      : DEFAULT_CENTER

  return (
    <GoogleMap
      mapContainerStyle={MAP_CONTAINER_STYLE}
      center={center}
      zoom={17}
      onLoad={onLoad}
      options={{ styles: DARK_MAP_STYLE, disableDefaultUI: false, clickableIcons: false }}
    >
      {devicePosition && (
        <>
          <Marker
            position={{ lat: devicePosition.latitude, lng: devicePosition.longitude }}
            icon={{
              path: window.google.maps.SymbolPath.CIRCLE,
              scale: 8,
              fillColor: '#3aa8ff',
              fillOpacity: 1,
              strokeColor: '#ffffff',
              strokeWeight: 2,
            }}
            title="Your device's current location"
          />
          {/* Honest accuracy circle - shows the real uncertainty radius the
              browser reported, instead of implying the pin is exact. A
              laptop without a GPS chip will show a much bigger circle than
              a phone - that's real hardware precision, not a rendering bug. */}
          {devicePosition.accuracy && (
            <Circle
              center={{ lat: devicePosition.latitude, lng: devicePosition.longitude }}
              radius={devicePosition.accuracy}
              options={{
                fillColor: '#3aa8ff',
                fillOpacity: 0.08,
                strokeColor: '#3aa8ff',
                strokeOpacity: 0.4,
                strokeWeight: 1,
              }}
            />
          )}
        </>
      )}

      {potholes.map((p) => (
        <Marker
          key={p.pothole_id}
          position={{ lat: p.latitude, lng: p.longitude }}
          icon={{
            path: window.google.maps.SymbolPath.CIRCLE,
            scale: p.status === 'candidate' ? 5 : 7,
            fillColor: markerColor(p),
            fillOpacity: p.status === 'candidate' ? 0.5 : 0.85,
            strokeColor: '#ffffff',
            strokeWeight: p.status === 'candidate' ? 1 : 1.5,
          }}
          onClick={() => setSelected(p)}
        />
      ))}

      {selected && (
        <InfoWindow
          position={{ lat: selected.latitude, lng: selected.longitude }}
          onCloseClick={() => setSelected(null)}
        >
          <div className="map-info-window">
            <b>Pothole {selected.pothole_id}</b>
            {selected.status === 'candidate' && (
              <>
                <br />
                <span style={{ color: '#a15c00' }}>
                  Unconfirmed - seen {selected.sighting_count} time{selected.sighting_count === 1 ? '' : 's'} so far.
                  Not yet in the repair queue until seen again.
                </span>
              </>
            )}
            <br />
            Severity: {selected.severity}
            <br />
            Status: {selected.status}
            <br />
            Sightings: {selected.sighting_count}
            <br />
            Confidence: {(selected.confidence * 100).toFixed(0)}%
          </div>
        </InfoWindow>
      )}
    </GoogleMap>
  )
}
