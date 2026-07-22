import { useEffect, useRef, useState } from 'react'

function beep(urgent) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.value = urgent ? 880 : 550
    gain.gain.value = 0.15
    osc.start()
    setTimeout(() => {
      osc.stop()
      ctx.close()
    }, urgent ? 350 : 200)
  } catch {
    // audio not available - the visual banner still shows
  }
}

export default function AlertBanner({ latestAlert }) {
  const [visible, setVisible] = useState(false)
  const lastAlertTimeRef = useRef(0)

  useEffect(() => {
    if (!latestAlert) return
    if (latestAlert.timestamp === lastAlertTimeRef.current) return
    lastAlertTimeRef.current = latestAlert.timestamp
    setVisible(true)
    beep(latestAlert.urgent)
    const timer = setTimeout(() => setVisible(false), 5000)
    return () => clearTimeout(timer)
  }, [latestAlert])

  if (!visible || !latestAlert) return <div className="alert-banner-slot" />

  return (
    <div className={`alert-banner ${latestAlert.severity}`}>
      ⚠️ {latestAlert.message}
    </div>
  )
}
