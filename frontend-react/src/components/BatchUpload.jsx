import { useRef, useState } from 'react'
import { uploadPass } from '../api.js'

export default function BatchUpload({ onUploaded }) {
  const gpsInputRef = useRef(null)
  const imagesInputRef = useRef(null)
  const [status, setStatus] = useState('For pre-recorded footage instead of a live camera - choose a GPS CSV + images in order. Road type is detected automatically from each GPS point.')

  async function handleUpload() {
    const gpsFile = gpsInputRef.current?.files?.[0]
    const imageFiles = imagesInputRef.current?.files
    if (!gpsFile || !imageFiles?.length) {
      setStatus('Choose both a GPS CSV and image files.')
      return
    }
    setStatus('Uploading and running detection...')
    try {
      const data = await uploadPass({ gpsFile, imageFiles: Array.from(imageFiles) })
      setStatus(
        `Pass ${data.pass_id}: ${data.n_frames_processed} frames processed, ` +
        `${data.n_raw_detections} detections, ${data.n_new_potholes} new, ` +
        `${data.n_updated_potholes} re-sighted, ${data.n_marked_likely_repaired} marked likely repaired.` +
        (data.warnings?.length ? ` Warnings: ${data.warnings.join(' ')}` : '')
      )
      onUploaded?.()
    } catch (e) {
      setStatus(`Error: ${e.message}`)
    }
  }

  return (
    <div className="panel">
      <h2>Batch Upload (process already-recorded footage)</h2>
      <div className="controls">
        <input ref={gpsInputRef} type="file" accept=".csv" title="GPS track CSV" />
        <input ref={imagesInputRef} type="file" accept="image/*" multiple title="Images (in order)" />
        <button onClick={handleUpload}>Upload Pass</button>
      </div>
      <div className="status-text">{status}</div>
    </div>
  )
}
