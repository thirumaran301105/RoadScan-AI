import { useEffect, useRef } from 'react'

export default function CameraFeed({ videoRef, active, detections }) {
  const overlayRef = useRef(null)

  useEffect(() => {
    const canvas = overlayRef.current
    const video = videoRef.current
    if (!canvas || !video) return

    const draw = () => {
      if (!video.videoWidth) return
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      const ctx = canvas.getContext('2d')
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      const severityColor = { minor: '#4cc9f0', moderate: '#00a9f2', severe: '#3928d6' }
      detections.forEach((d) => {
        const [x1, y1, x2, y2] = d.bbox
        ctx.strokeStyle = severityColor[d.severity] || '#f2a900'
        ctx.lineWidth = 4
        ctx.strokeRect(x1, y1, x2 - x1, y2 - y1)
        ctx.fillStyle = severityColor[d.severity] || '#f2a900'
        const label = `${d.severity} ${(d.confidence * 100).toFixed(0)}%`
        const textWidth = ctx.measureText(label).width
        ctx.fillRect(x1, y1 - 24, textWidth + 12, 24)
        ctx.fillStyle = '#fff'
        ctx.font = '16px sans-serif'
        ctx.fillText(label, x1 + 6, y1 - 6)
      })
    }
    const id = requestAnimationFrame(function loop() {
      draw()
      requestAnimationFrame(loop)
    })
    return () => cancelAnimationFrame(id)
  }, [detections, videoRef])

  return (
    <div className="camera-wrap">
      <video ref={videoRef} playsInline muted className="camera-video" />
      <canvas ref={overlayRef} className="camera-overlay" />
      {!active && (
        <div className="camera-placeholder">
          <span>Camera not started</span>
        </div>
      )}
    </div>
  )
}
