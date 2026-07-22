import { useRef, useState, useCallback, useEffect } from 'react'

/**
 * getUserMedia failures are NOT all the same problem, and a generic
 * "check your permissions" message sends people down the wrong path.
 * The most common one after fixing HTTP/HTTPS: NotAllowedError with NO
 * prompt ever appearing means the browser already recorded a "Block"
 * decision for this exact site from earlier testing - browsers don't
 * re-ask once blocked, they just fail silently every time after that,
 * which looks identical to "no permission asked" from the user's side.
 */
function describeCameraError(e) {
  switch (e.name) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
      return (
        'Camera permission is blocked for this site - most likely from an earlier attempt where it was ' +
        'denied (browsers do NOT ask again once blocked; they just fail silently, which looks identical to ' +
        '"no permission asked"). Reset it manually: on Chrome, tap the lock/info icon in the address bar → ' +
        'Permissions → Camera → set to "Ask" or "Allow". On iPhone Safari, this is controlled in the iOS ' +
        'Settings app, not in Safari itself: Settings → Safari → Camera → set to "Ask." Then reload the page.'
      )
    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return 'No camera was found on this device.'
    case 'NotReadableError':
    case 'TrackStartError':
      return 'The camera is already in use by another app (or browser tab) - close other apps using the camera and try again.'
    case 'OverconstrainedError':
    case 'ConstraintNotSatisfiedError':
      return "This device doesn't support the requested camera mode - try Switch Camera, or a different device."
    case 'SecurityError':
      return 'Camera access was blocked for security reasons - this usually means an insecure (non-HTTPS) connection.'
    default:
      return e.message || 'Could not access camera. Check permissions.'
  }
}

/**
 * Wraps getUserMedia so the component just gets a <video> ref to render
 * and a captureFrame() function that returns a base64 JPEG data URL of
 * the current frame - this is what gets streamed to the backend.
 *
 * Deliberately uses the browser's OWN camera (laptop webcam or phone
 * camera), not a server-side camera device - this is what makes "use my
 * laptop or my phone in the vehicle" actually work.
 */
export function useCamera() {
  const videoRef = useRef(null)
  const canvasRef = useRef(document.createElement('canvas'))
  const streamRef = useRef(null)
  const [active, setActive] = useState(false)
  const [error, setError] = useState(null)
  const [facingMode, setFacingMode] = useState('environment') // rear camera by default on phones
  const [permissionState, setPermissionState] = useState('unknown') // 'granted' | 'denied' | 'prompt' | 'unknown'

  // Best-effort proactive check using the Permissions API - not supported
  // in all browsers (notably Safari doesn't support querying 'camera'
  // this way), so this degrades gracefully to 'unknown' rather than
  // breaking anything. Where it IS supported, it catches an already-
  // blocked permission before the user even taps "Start Watching",
  // instead of waiting for a failed attempt to explain it.
  useEffect(() => {
    if (!navigator.permissions?.query) return
    let status
    navigator.permissions
      .query({ name: 'camera' })
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

  const start = useCallback(async (mode = facingMode) => {
    setError(null)

    // Camera access is only exposed at all on secure origins (https:// or
    // localhost). On plain http://, navigator.mediaDevices is undefined -
    // calling .getUserMedia() on it throws a confusing raw TypeError
    // ("Cannot read properties of undefined") instead of a clear message.
    // Checking this upfront lets us explain the real problem directly.
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setError(
        'Camera access needs a secure connection. This page is loaded over plain HTTP, which browsers ' +
        'block camera access on entirely - use an HTTPS tunnel (e.g. "ngrok http 8000") and open that ' +
        'https://... link instead of the raw IP address.'
      )
      setActive(false)
      return
    }

    try {
      // Prefer the rear/back camera ("environment") since that's the one
      // that would actually face the road in a real dashboard mount -
      // falls back automatically on devices without multiple cameras.
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: mode, width: { ideal: 960 }, height: { ideal: 540 } },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setFacingMode(mode)
      setActive(true)
    } catch (e) {
      // getUserMedia failures aren't all the same problem - a generic
      // message here would send you down the wrong troubleshooting path.
      setError(describeCameraError(e))
      setActive(false)
    }
  }, [facingMode])

  const stop = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    setActive(false)
  }, [])

  const switchCamera = useCallback(() => {
    const next = facingMode === 'environment' ? 'user' : 'environment'
    stop()
    start(next)
  }, [facingMode, start, stop])

  const captureFrameDataUrl = useCallback((quality = 0.7) => {
    const video = videoRef.current
    if (!video || video.readyState < 2) return null
    const canvas = canvasRef.current
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/jpeg', quality)
  }, [])

  useEffect(() => () => stop(), [stop])

  return { videoRef, active, error, permissionState, start, stop, switchCamera, facingMode, captureFrameDataUrl }
}
