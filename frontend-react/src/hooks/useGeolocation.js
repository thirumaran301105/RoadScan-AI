import { useState, useRef, useCallback, useEffect } from 'react'

/**
 * Continuously tracks the DEVICE'S OWN location - the laptop's or phone's
 * real GPS/location-services fix, via the standard browser Geolocation
 * API. No server-side GPS hardware or simulated route involved - whatever
 * device is running this page in the vehicle is what gets located.
 *
 * IMPORTANT, and worth being direct about: there is no software fix for
 * poor location accuracy on a device without a real GPS chip. This hook
 * already requests the best the browser/OS can give
 * (enableHighAccuracy: true, maximumAge: 0 so every reading is fresh, not
 * cached). What it adds on top is legitimate but limited: it keeps the
 * BEST (lowest-accuracy-number = most precise) reading seen so far in the
 * last KEEP_BEST_WINDOW_MS, instead of just whatever arrived most
 * recently, since consecutive readings can jitter even on the same
 * device. This reduces noise. It does not and cannot turn a laptop's
 * ~100-2000m WiFi-based position into phone-GPS-chip-level ~5-20m
 * precision - that's a hardware ceiling, not a software bug. See the
 * README for what actually helps (testing on a phone, or pairing a real
 * external GPS receiver for a permanent in-vehicle install).
 */
const KEEP_BEST_WINDOW_MS = 8000

function describeError(err) {
  switch (err.code) {
    case err.PERMISSION_DENIED:
      return (
        'Location permission is blocked for this site - if no popup ever appeared, this is likely a ' +
        '"Block" decision recorded from an earlier attempt (browsers don\'t re-ask once blocked). Reset it: ' +
        'on Chrome, tap the lock/info icon in the address bar → Permissions → Location → set to "Ask" or ' +
        '"Allow." On iPhone Safari: Settings → Safari → Location → set to "Ask." Then reload the page.'
      )
    case err.POSITION_UNAVAILABLE:
      return "Could not determine location yet. On a laptop, check your OS's Location Services are turned on " +
        '(Windows: Settings > Privacy & Security > Location; Mac: System Settings > Privacy & Security > Location Services) ' +
        "- browsers can't get a GPS fix without it, even with camera/site permission granted."
    case err.TIMEOUT:
      return 'Still waiting for a location fix - this can take longer on laptops than phones.'
    default:
      return err.message || 'Could not get device location.'
  }
}

export function accuracyLabel(accuracyMeters) {
  if (accuracyMeters == null) return null
  if (accuracyMeters <= 20) return { text: 'Excellent (GPS-chip-level)', level: 'good' }
  if (accuracyMeters <= 75) return { text: 'Good', level: 'good' }
  if (accuracyMeters <= 300) return { text: 'Fair - typical for WiFi-based positioning', level: 'fair' }
  if (accuracyMeters <= 50000) return { text: 'Poor - likely IP-based fallback; try a phone for real GPS', level: 'poor' }
  // Errors in the tens of thousands of km (or more) are NOT normal GPS
  // imprecision - normal worst-case fallback tops out around a few hundred
  // km at most. This specific scale of error is the signature of the
  // browser refusing/degrading geolocation entirely, almost always because
  // the page is being loaded over plain HTTP (not HTTPS) on a non-
  // localhost address. See the README's HTTPS/tunnel section.
  return {
    text: 'Extremely inaccurate (likely wrong by thousands of km) - this usually means the site is ' +
      "loaded over HTTP instead of HTTPS, so the browser won't hand over a real GPS fix. See the README's " +
      '"HTTPS required for phone testing" section - a tunnel like ngrok fixes this.',
    level: 'broken',
  }
}

export function useGeolocation() {
  const [position, setPosition] = useState(null) // best reading in the current window
  const [error, setError] = useState(null)
  const [status, setStatus] = useState('idle') // idle | locating | active | error
  const [permissionState, setPermissionState] = useState('unknown')
  const watchIdRef = useRef(null)
  const bestRef = useRef(null) // { latitude, longitude, accuracy, at }

  // Same best-effort proactive check as useCamera.js - geolocation's
  // permission name has broader browser support than camera's does, but
  // still degrades gracefully to 'unknown' where unsupported.
  useEffect(() => {
    if (!navigator.permissions?.query) return
    let status
    navigator.permissions
      .query({ name: 'geolocation' })
      .then((s) => {
        status = s
        setPermissionState(s.state)
        s.onchange = () => setPermissionState(s.state)
      })
      .catch(() => setPermissionState('unknown'))
    return () => {
      if (status) status.onchange = null
    }
  }, [])

  const start = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by this browser.')
      setStatus('error')
      return
    }

    // Same root cause as the camera check in useCamera.js: on an insecure
    // (http://) origin, geolocation calls typically surface as a generic
    // PERMISSION_DENIED error even though the user was never actually
    // asked - which is misleading to show as "you denied permission."
    if (!window.isSecureContext) {
      setError(
        'Location access needs a secure connection. This page is loaded over plain HTTP, which browsers ' +
        'block location access on (this is very likely why no permission prompt appeared at all) - use an ' +
        'HTTPS tunnel (e.g. "ngrok http 8000") and open that https://... link instead of the raw IP address.'
      )
      setStatus('error')
      return
    }

    setStatus('locating')
    setError(null)
    bestRef.current = null
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const reading = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          at: Date.now(),
        }
        const best = bestRef.current
        const windowExpired = best && Date.now() - best.at > KEEP_BEST_WINDOW_MS
        if (!best || windowExpired || reading.accuracy <= best.accuracy) {
          bestRef.current = reading
          setPosition(reading)
        }
        setStatus('active')
        setError(null)
      },
      (err) => {
        setError(describeError(err))
        // A timeout while still watching isn't fatal - keep the UI in
        // "locating" state so it's clear we're still trying, not stuck.
        setStatus(err.code === err.TIMEOUT && watchIdRef.current !== null ? 'locating' : 'error')
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 }
    )
  }, [])

  const stop = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
    setStatus('idle')
  }, [])

  useEffect(() => () => stop(), [stop])

  return { position, error, status, permissionState, watching: status === 'active' || status === 'locating', start, stop }
}
