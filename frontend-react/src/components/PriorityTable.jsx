import { useEffect, useState, useCallback } from 'react'
import { fetchPotholes, markRepaired } from '../api'

export default function PriorityTable({ refreshSignal, onChange }) {
  const [potholes, setPotholes] = useState([])

  const load = useCallback(async () => {
    try {
      const data = await fetchPotholes()
      setPotholes(data)
    } catch {
      // keep the last known list if a refresh fails
    }
  }, [])

  useEffect(() => {
    load()
    const id = setInterval(load, 4000)
    return () => clearInterval(id)
  }, [load, refreshSignal])

  async function handleMarkRepaired(id) {
    await markRepaired(id)
    await load()
    onChange?.()
  }

  return (
    <table className="pothole-table">
      <thead>
        <tr>
          <th>#</th>
          <th>Severity</th>
          <th>Road Type</th>
          <th>Sightings</th>
          <th>Priority</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {potholes.map((p, i) => (
          <tr key={p.pothole_id}>
            <td>{i + 1}</td>
            <td>
              <span className={`badge badge-${p.severity}`}>{p.severity}</span>
            </td>
            <td>{p.road_type}</td>
            <td>{p.sighting_count}</td>
            <td>{p.priority_score}</td>
            <td>
              <button className="repair-btn" onClick={() => handleMarkRepaired(p.pothole_id)}>
                Mark Repaired
              </button>
            </td>
          </tr>
        ))}
        {potholes.length === 0 && (
          <tr>
            <td colSpan={6} className="empty-row">
              No active potholes yet.
            </td>
          </tr>
        )}
      </tbody>
    </table>
  )
}
