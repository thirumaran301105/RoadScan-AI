export default function AlertLog({ alerts }) {
  return (
    <table className="alert-log-table">
      <thead>
        <tr>
          <th>Time</th>
          <th>Severity</th>
          <th>Message</th>
        </tr>
      </thead>
      <tbody>
        {alerts.map((a, i) => (
          <tr key={i}>
            <td>{new Date(a.timestamp * 1000).toLocaleTimeString()}</td>
            <td>
              <span className={`badge badge-${a.severity}`}>{a.severity}</span>
            </td>
            <td>{a.message}</td>
          </tr>
        ))}
        {alerts.length === 0 && (
          <tr>
            <td colSpan={3} className="empty-row">
              No alerts yet this session.
            </td>
          </tr>
        )}
      </tbody>
    </table>
  )
}
