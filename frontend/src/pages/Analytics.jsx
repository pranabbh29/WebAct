import { useState, useEffect } from 'react'
import { BarChart3, RefreshCw, TrendingUp, Clock, CheckCircle2, XCircle, Activity } from 'lucide-react'
import { apiFetch } from '../lib/api'

export default function Analytics() {
  const [analytics, setAnalytics] = useState(null)
  const [loading, setLoading] = useState(true)

  const fetchAnalytics = async () => {
    setLoading(true)
    try {
      const res = await apiFetch('/api/analytics')
      if (!res.ok) throw new Error(`${res.status}`)
      const data = await res.json()
      if (data && typeof data === 'object') setAnalytics(data)
    } catch (err) {
      console.error('Failed to fetch analytics:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchAnalytics() }, [])

  if (loading) return <div className="page"><div className="page-loading">Loading analytics...</div></div>

  return (
    <div className="page">
      <div className="page-header">
        <h2><BarChart3 size={22} /> Analytics</h2>
        <button className="btn-secondary" onClick={fetchAnalytics}><RefreshCw size={14} /> Refresh</button>
      </div>

      {analytics ? (
        <>
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-icon"><Activity size={20} /></div>
              <div className="stat-content">
                <span className="stat-value">{analytics.total_sessions}</span>
                <span className="stat-label">Total Sessions</span>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon success"><CheckCircle2 size={20} /></div>
              <div className="stat-content">
                <span className="stat-value">{analytics.completed}</span>
                <span className="stat-label">Completed</span>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon error"><XCircle size={20} /></div>
              <div className="stat-content">
                <span className="stat-value">{analytics.failed}</span>
                <span className="stat-label">Failed</span>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon"><Clock size={20} /></div>
              <div className="stat-content">
                <span className="stat-value">{analytics.avg_steps}</span>
                <span className="stat-label">Avg Steps</span>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon accent"><TrendingUp size={20} /></div>
              <div className="stat-content">
                <span className="stat-value">{analytics.success_rate}%</span>
                <span className="stat-label">Success Rate</span>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon"><Clock size={20} /></div>
              <div className="stat-content">
                <span className="stat-value">{analytics.avg_duration}s</span>
                <span className="stat-label">Avg Duration</span>
              </div>
            </div>
          </div>

          {analytics.recent_tasks?.length > 0 && (
            <>
              <h3 className="section-heading">Recent Tasks</h3>
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Task</th>
                      <th>Status</th>
                      <th>Steps</th>
                      <th>Duration</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.recent_tasks.map((t, i) => (
                      <tr key={i}>
                        <td className="task-cell">{t.task}</td>
                        <td><span className={`status-pill ${t.status}`}>{t.status}</span></td>
                        <td>{t.steps}</td>
                        <td>{t.duration}s</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      ) : (
        <div className="page-empty">
          <BarChart3 size={48} strokeWidth={1} />
          <h3>No data yet</h3>
          <p>Analytics will appear here after you run some tasks.</p>
        </div>
      )}
    </div>
  )
}
