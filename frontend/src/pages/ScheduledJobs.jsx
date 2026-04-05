import { useState, useEffect } from 'react'
import { CalendarClock, Plus, Trash2, Play, Pause, RefreshCw, Clock } from 'lucide-react'
import { apiFetch } from '../lib/api'

export default function ScheduledJobs() {
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [newJob, setNewJob] = useState({ name: '', task: '', cron: '', enabled: true })

  const fetchJobs = async () => {
    setLoading(true)
    try {
      const res = await apiFetch('/api/scheduled-jobs')
      if (!res.ok) throw new Error(`${res.status}`)
      const data = await res.json()
      if (Array.isArray(data)) setJobs(data)
    } catch (err) {
      console.error('Failed to fetch jobs:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchJobs() }, [])

  const addJob = async () => {
    if (!newJob.name || !newJob.task || !newJob.cron) return
    try {
      const res = await apiFetch('/api/scheduled-jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newJob),
      })
      if (!res.ok) throw new Error(`${res.status}`)
      const data = await res.json()
      setJobs(prev => [...prev, data])
      setNewJob({ name: '', task: '', cron: '', enabled: true })
      setShowAdd(false)
    } catch (err) {
      console.error('Failed to add job:', err)
    }
  }

  const toggleJob = async (id, enabled) => {
    try {
      const res = await apiFetch(`/api/scheduled-jobs/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !enabled }),
      })
      if (!res.ok) throw new Error(`${res.status}`)
      const data = await res.json()
      setJobs(prev => prev.map(j => j.id === id ? data : j))
    } catch (err) {
      console.error('Failed to toggle job:', err)
    }
  }

  const deleteJob = async (id) => {
    if (!confirm('Delete this scheduled job?')) return
    try {
      const res = await apiFetch(`/api/scheduled-jobs/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error(`${res.status}`)
      setJobs(prev => prev.filter(j => j.id !== id))
    } catch (err) {
      console.error('Failed to delete job:', err)
    }
  }

  const runNow = async (id) => {
    try {
      const res = await apiFetch(`/api/scheduled-jobs/${id}/run`, { method: 'POST' })
      if (!res.ok) throw new Error(`${res.status}`)
      alert('Job triggered! Check Agent Sessions for progress.')
    } catch (err) {
      console.error('Failed to run job:', err)
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <h2><CalendarClock size={22} /> Scheduled Jobs</h2>
        <div className="page-header-actions">
          <button className="btn-secondary" onClick={fetchJobs}><RefreshCw size={14} /> Refresh</button>
          <button className="btn-primary" onClick={() => setShowAdd(true)}><Plus size={14} /> New Job</button>
        </div>
      </div>

      {showAdd && (
        <div className="add-form">
          <input className="form-input" placeholder="Job name" value={newJob.name}
            onChange={e => setNewJob(prev => ({ ...prev, name: e.target.value }))} />
          <textarea className="form-textarea" placeholder="Task prompt" value={newJob.task}
            onChange={e => setNewJob(prev => ({ ...prev, task: e.target.value }))} rows={3} />
          <input className="form-input" placeholder="Cron expression (e.g. 0 9 * * *)" value={newJob.cron}
            onChange={e => setNewJob(prev => ({ ...prev, cron: e.target.value }))} />
          <div className="form-actions">
            <button className="btn-secondary" onClick={() => setShowAdd(false)}>Cancel</button>
            <button className="btn-primary" onClick={addJob}>Create</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="page-loading">Loading jobs...</div>
      ) : jobs.length === 0 ? (
        <div className="page-empty">
          <CalendarClock size={48} strokeWidth={1} />
          <h3>No scheduled jobs</h3>
          <p>Schedule browser tasks to run automatically on a recurring basis.</p>
        </div>
      ) : (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Task</th>
                <th>Schedule</th>
                <th>Status</th>
                <th>Last Run</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map(job => (
                <tr key={job.id} className={!job.enabled ? 'row-disabled' : ''}>
                  <td className="name-cell">{job.name}</td>
                  <td className="task-cell">{job.task}</td>
                  <td><code className="cron-code">{job.cron}</code></td>
                  <td>
                    <span className={`status-pill ${job.enabled ? 'active' : 'paused'}`}>
                      {job.enabled ? 'Active' : 'Paused'}
                    </span>
                  </td>
                  <td className="date-cell">{job.last_run || 'Never'}</td>
                  <td className="actions-cell">
                    <button className="icon-btn" title="Run now" onClick={() => runNow(job.id)}>
                      <Play size={14} />
                    </button>
                    <button className="icon-btn" title={job.enabled ? 'Pause' : 'Resume'}
                      onClick={() => toggleJob(job.id, job.enabled)}>
                      {job.enabled ? <Pause size={14} /> : <Play size={14} />}
                    </button>
                    <button className="icon-btn danger" title="Delete" onClick={() => deleteJob(job.id)}>
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
