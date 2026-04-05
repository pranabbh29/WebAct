import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bot, Trash2, Eye, RefreshCw, Clock, CheckCircle2, XCircle } from 'lucide-react'
import { apiFetch } from '../lib/api'

export default function AgentSessions() {
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  const fetchSessions = async () => {
    setLoading(true)
    try {
      const res = await apiFetch('/api/sessions')
      if (!res.ok) throw new Error(`${res.status}`)
      const data = await res.json()
      if (Array.isArray(data)) setSessions(data)
    } catch (err) {
      console.error('Failed to fetch sessions:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchSessions() }, [])

  const deleteSession = async (id) => {
    if (!confirm('Delete this session?')) return
    try {
      const res = await apiFetch(`/api/sessions/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error(`${res.status}`)
      setSessions(prev => prev.filter(s => s.id !== id))
    } catch (err) {
      console.error('Failed to delete session:', err)
    }
  }

  const statusIcon = (status) => {
    if (status === 'running') return <Clock size={14} className="status-icon running" />
    if (status === 'done') return <CheckCircle2 size={14} className="status-icon done" />
    return <XCircle size={14} className="status-icon error" />
  }

  return (
    <div className="page">
      <div className="page-header">
        <h2><Bot size={22} /> Agent Sessions</h2>
        <button className="btn-secondary" onClick={fetchSessions}>
          <RefreshCw size={14} />
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="page-loading">Loading sessions...</div>
      ) : sessions.length === 0 ? (
        <div className="page-empty">
          <Bot size={48} strokeWidth={1} />
          <h3>No sessions yet</h3>
          <p>Run a task from the New Session page to see it here.</p>
          <button className="btn-primary" onClick={() => navigate('/')}>New Session</button>
        </div>
      ) : (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Task</th>
                <th>Status</th>
                <th>Steps</th>
                <th>Result</th>
                <th>Files</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map(session => (
                <tr key={session.id}>
                  <td className="task-cell">{session.task}</td>
                  <td>
                    <span className={`status-pill ${session.status}`}>
                      {statusIcon(session.status)}
                      {session.status}
                    </span>
                  </td>
                  <td>{session.steps_count || 0}</td>
                  <td className="result-cell">{session.result || '-'}</td>
                  <td>{session.files?.length || 0}</td>
                  <td className="actions-cell">
                    <button className="icon-btn" title="View" onClick={() => navigate(`/sessions/${session.id}`)}>
                      <Eye size={14} />
                    </button>
                    <button className="icon-btn danger" title="Delete" onClick={() => deleteSession(session.id)}>
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
