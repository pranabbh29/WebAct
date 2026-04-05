import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Clock, CheckCircle2, XCircle, Send, Square, Plus } from 'lucide-react'
import { apiFetch, getAuthToken } from '../lib/api'

export default function SessionDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Follow-up chat state
  const [followUps, setFollowUps] = useState([])
  const [input, setInput] = useState('')
  const [files, setFiles] = useState([])
  const [isRunning, setIsRunning] = useState(false)
  const [activeTaskId, setActiveTaskId] = useState(null)
  const eventSourceRef = useRef(null)
  const feedRef = useRef(null)
  const fileInputRef = useRef(null)

  useEffect(() => {
    const fetchSession = async () => {
      setLoading(true)
      try {
        const res = await apiFetch(`/api/sessions/${id}`)
        if (!res.ok) throw new Error('Session not found')
        const data = await res.json()
        setSession(data)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    fetchSession()
  }, [id])

  // Auto-scroll on new content
  useEffect(() => {
    if (feedRef.current) feedRef.current.scrollTop = feedRef.current.scrollHeight
  }, [followUps])

  // Cleanup EventSource on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
        eventSourceRef.current = null
      }
    }
  }, [])

  const handleFiles = (e) => {
    setFiles(prev => [...prev, ...Array.from(e.target.files)])
    e.target.value = ''
  }

  const removeFile = (index) => setFiles(prev => prev.filter((_, i) => i !== index))

  const updateFollowUp = (localId, updater) => {
    setFollowUps(prev => prev.map(t => t.id === localId ? updater(t) : t))
  }

  const stopTask = async () => {
    if (!activeTaskId) return
    try { await apiFetch(`/api/stop/${activeTaskId}`, { method: 'POST' }) } catch {}
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }
    setIsRunning(false)
    setActiveTaskId(null)
    setFollowUps(prev => prev.map(t =>
      t.status === 'running' ? { ...t, status: 'error', error: 'Stopped by user' } : t
    ))
  }

  const runFollowUp = async (taskText) => {
    if ((!taskText.trim() && files.length === 0) || isRunning) return
    setInput('')
    const currentFiles = [...files]
    setFiles([])
    setIsRunning(true)

    const localId = Date.now()
    const newTask = {
      id: localId,
      task: taskText || '(file upload)',
      status: 'running',
      steps: [],
      result: null,
      error: null,
      files: currentFiles.map(f => f.name),
    }
    setFollowUps(prev => [...prev, newTask])

    // Prepend context from original session
    const contextPrefix = `[Follow-up to previous task: "${session.task}"]\n\n`

    try {
      const formData = new FormData()
      formData.append('task', contextPrefix + taskText)
      formData.append('max_steps', '25')
      currentFiles.forEach(f => formData.append('files', f))

      const res = await apiFetch('/api/run', { method: 'POST', body: formData })
      if (!res.ok) throw new Error(`Server error: ${res.status}`)
      const { task_id } = await res.json()
      if (!task_id) throw new Error('No task_id in response')
      setActiveTaskId(task_id)

      const token = await getAuthToken()
      const eventSource = new EventSource(`/api/stream/${task_id}?token=${token}`)
      eventSourceRef.current = eventSource

      eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data)
        if (data.type === 'step') {
          updateFollowUp(localId, t => ({ ...t, steps: [...t.steps, data] }))
        }
        if (data.type === 'final') {
          eventSource.close()
          eventSourceRef.current = null
          setActiveTaskId(null)
          setIsRunning(false)
          updateFollowUp(localId, t => ({ ...t, status: data.status, result: data.result, error: data.error }))
        }
      }

      eventSource.onerror = () => {
        eventSource.close()
        eventSourceRef.current = null
        setIsRunning(false)
        updateFollowUp(localId, t => ({ ...t, status: 'error', error: 'Connection lost' }))
      }
    } catch (err) {
      setIsRunning(false)
      updateFollowUp(localId, t => ({ ...t, status: 'error', error: err.message }))
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    runFollowUp(input)
  }

  if (loading) return <div className="page"><div className="page-loading">Loading session...</div></div>
  if (error) return (
    <div className="page">
      <div className="page-empty">
        <h3>Session not found</h3>
        <p>{error}</p>
        <button className="btn-primary" onClick={() => navigate('/sessions')}>Back to Sessions</button>
      </div>
    </div>
  )

  const statusIcon = session.status === 'running'
    ? <Clock size={16} className="status-icon running" />
    : session.status === 'done'
    ? <CheckCircle2 size={16} className="status-icon done" />
    : <XCircle size={16} className="status-icon error" />

  return (
    <>
    <input type="file" ref={fileInputRef} onChange={handleFiles} multiple hidden
      accept="image/*,.pdf,.doc,.docx,.txt,.csv,.json,.xlsx,.xls" />

    <div className="session-detail-layout">
      {/* Scrollable content */}
      <div className="session-detail-feed" ref={feedRef}>
        <button className="back-btn" onClick={() => navigate('/sessions')}>
          <ArrowLeft size={16} />
          <span>Back to Sessions</span>
        </button>

        <div className="detail-header">
          <div className="detail-title-row">
            {statusIcon}
            <h2>{session.task}</h2>
            <span className={`status-pill ${session.status}`}>{session.status}</span>
          </div>
          <div className="detail-meta">
            <span>{session.steps_count || session.steps?.length || 0} steps</span>
            {session.duration > 0 && <span>{session.duration}s</span>}
            {session.files?.length > 0 && <span>{session.files.length} files</span>}
          </div>
        </div>

        {/* Original Result */}
        {(session.result || session.error) && (
          <div className={`detail-result ${session.error ? 'error' : 'success'}`}>
            <div className="detail-result-label">{session.error ? 'Error' : 'Result'}</div>
            <div className="detail-result-text">{session.error || session.result}</div>
          </div>
        )}

        {/* Original Steps — collapsed by default since session is done */}
        {session.steps?.length > 0 && (
          <CollapsibleSteps steps={session.steps} defaultOpen={session.status === 'running'} />
        )}

        {/* Follow-up tasks */}
        {followUps.map(task => {
          const isDone = task.status !== 'running'
          return (
            <div key={task.id} className="followup-card">
              <div className="followup-header">
                <div className={`task-status ${task.status}`} />
                <span className="task-text">{task.task}</span>
                <span className="task-badge">
                  {task.status === 'running' ? `Step ${task.steps.length}...` :
                   task.status === 'done' ? `${task.steps.length} steps` : 'Error'}
                </span>
              </div>

              {/* While running: show steps live */}
              {!isDone && task.steps.length > 0 && (
                <div className="detail-steps" style={{ marginTop: 12 }}>
                  {task.steps.map((step, i) => <StepCard key={i} step={step} />)}
                </div>
              )}

              {task.status === 'running' && (
                <div className="loading-dots"><span /><span /><span /></div>
              )}

              {/* Once done: show result, collapsible steps */}
              {(task.result || task.error) && (
                <div className={`detail-result ${task.error ? 'error' : 'success'}`} style={{ marginTop: 12 }}>
                  <div className="detail-result-label">{task.error ? 'Error' : 'Result'}</div>
                  <div className="detail-result-text">{task.error || task.result}</div>
                </div>
              )}

              {isDone && task.steps.length > 0 && (
                <CollapsibleSteps steps={task.steps} defaultOpen={false} />
              )}
            </div>
          )
        })}

        {isRunning && (
          <div className="task-controls">
            <button className="stop-btn" onClick={stopTask}>
              <Square size={12} fill="currentColor" />
              <span>Stop</span>
            </button>
          </div>
        )}
      </div>

      {/* Input bar — always at bottom */}
      <div className="session-input-area">
        <div className="chat-input-box">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(e) } }}
            placeholder={isRunning ? 'Agent is working...' : 'Ask a follow-up question...'}
            disabled={isRunning}
            rows={2}
          />

          {files.length > 0 && (
            <div className="input-attachments">
              {files.map((f, i) => (
                <div key={i} className="attachment-chip">
                  <span>{f.name}</span>
                  <button onClick={() => removeFile(i)}>&times;</button>
                </div>
              ))}
            </div>
          )}

          <div className="chat-toolbar">
            <div className="toolbar-left">
              <button className="toolbar-btn" onClick={() => fileInputRef.current?.click()} disabled={isRunning}>
                <Plus size={18} />
              </button>
            </div>
            <div className="toolbar-right">
              {isRunning ? (
                <button className="stop-btn-inline" onClick={stopTask}>
                  <Square size={12} fill="currentColor" />
                  <span>Stop</span>
                </button>
              ) : (
                <button className="run-task-btn" onClick={handleSubmit}
                  disabled={!input.trim() && files.length === 0}>
                  <Send size={14} />
                  <span>Run task</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
    </>
  )
}

function CollapsibleSteps({ steps, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="steps-toggle-section">
      <button className="steps-toggle-btn" onClick={() => setOpen(!open)}>
        {open ? '\u25BE Hide' : '\u25B8 Show'} {steps.length} steps
      </button>
      {open && (
        <div className="detail-steps">
          {steps.map((step, i) => <StepCard key={i} step={step} />)}
        </div>
      )}
    </div>
  )
}

function StepCard({ step }) {
  const [showScreenshot, setShowScreenshot] = useState(false)
  const evalClass = step.evaluation?.toLowerCase().includes('success') ? 'success' :
                    step.evaluation?.toLowerCase().includes('fail') ? 'failure' : ''

  return (
    <div className="detail-step">
      <div className="detail-step-header">
        <span className="step-number">Step {step.step}</span>
        {step.evaluation && <span className={`step-eval ${evalClass}`}>{step.evaluation}</span>}
      </div>

      {step.next_goal && <div className="detail-step-goal">{step.next_goal}</div>}

      {step.thinking && (
        <div className="step-thinking">
          <span className="step-field-label">Thinking</span>
          <p>{step.thinking}</p>
        </div>
      )}

      {step.memory && (
        <div className="step-memory">
          <span className="step-field-label">Memory</span>
          <p>{step.memory}</p>
        </div>
      )}

      {step.actions?.length > 0 && (
        <div className="detail-step-actions">
          {step.actions.map((action, i) => (
            <div key={i} className="action-block">{action}</div>
          ))}
        </div>
      )}

      {step.screenshot && (
        <>
          <button className="screenshot-toggle" onClick={() => setShowScreenshot(!showScreenshot)}>
            {showScreenshot ? '\u25BE Hide' : '\u25B8 Show'} screenshot
          </button>
          {showScreenshot && (
            <div className="step-screenshot">
              <img src={`data:image/png;base64,${step.screenshot}`} alt={`Step ${step.step}`} />
            </div>
          )}
        </>
      )}
    </div>
  )
}
