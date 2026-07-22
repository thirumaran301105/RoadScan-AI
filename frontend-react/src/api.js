const BASE = ''

export async function fetchRoadType(latitude, longitude) {
  const res = await fetch(`${BASE}/api/road_type?latitude=${latitude}&longitude=${longitude}`)
  if (!res.ok) throw new Error('Failed to detect road type')
  return res.json()
}

export async function fetchPotholes() {
  const res = await fetch(`${BASE}/api/potholes`)
  if (!res.ok) throw new Error('Failed to load potholes')
  return res.json()
}

export async function fetchAllPotholes() {
  const res = await fetch(`${BASE}/api/potholes/all`)
  if (!res.ok) throw new Error('Failed to load potholes')
  return res.json()
}

export async function fetchStats() {
  const res = await fetch(`${BASE}/api/stats`)
  if (!res.ok) throw new Error('Failed to load stats')
  return res.json()
}

export async function markRepaired(potholeId) {
  const res = await fetch(`${BASE}/api/potholes/${potholeId}/mark_repaired`, { method: 'POST' })
  if (!res.ok) throw new Error('Failed to mark repaired')
  return res.json()
}

export async function uploadPass({ gpsFile, imageFiles }) {
  const form = new FormData()
  form.append('gps_csv', gpsFile)
  for (const f of imageFiles) form.append('images', f)
  const res = await fetch(`${BASE}/api/upload_pass`, { method: 'POST', body: form })
  const data = await res.json()
  if (!res.ok) throw new Error(data.detail || 'Upload failed')
  return data
}
