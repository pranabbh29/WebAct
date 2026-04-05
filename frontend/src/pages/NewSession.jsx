import { useState, useRef, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Plus, Send, Square } from 'lucide-react'
import { apiFetch, getAuthToken } from '../lib/api'

const FILE_ICONS = {
  image: '\u{1F5BC}',
  pdf: '\u{1F4C4}',
  doc: '\u{1F4DD}',
  default: '\u{1F4CE}',
}

function getFileIcon(name) {
  const ext = name.split('.').pop().toLowerCase()
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) return FILE_ICONS.image
  if (ext === 'pdf') return FILE_ICONS.pdf
  if (['doc', 'docx', 'txt', 'md'].includes(ext)) return FILE_ICONS.doc
  return FILE_ICONS.default
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

export default function NewSession({ onSessionCreated }) {
  const [searchParams] = useSearchParams()
  const [input, setInput] = useState('')
  const [files, setFiles] = useState([])
  const [tasks, setTasks] = useState([])
  const [isRunning, setIsRunning] = useState(false)
  const [activeTaskId, setActiveTaskId] = useState(null)
  const fileInputRef = useRef(null)
  const feedRef = useRef(null)
  const eventSourceRef = useRef(null)

  useEffect(() => {
    const example = searchParams.get('example')
    if (example) setInput(example)
  }, [searchParams])

  // Auto-scroll feed on new content
  useEffect(() => {
    if (feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight
    }
  }, [tasks])

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

  const handleDrop = (e) => {
    e.preventDefault()
    setFiles(prev => [...prev, ...Array.from(e.dataTransfer.files)])
  }

  const handlePaste = (e) => {
    const pastedFiles = Array.from(e.clipboardData.items)
      .filter(item => item.kind === 'file')
      .map(item => item.getAsFile())
      .filter(Boolean)
    if (pastedFiles.length > 0) setFiles(prev => [...prev, ...pastedFiles])
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
    setTasks(prev => prev.map(t =>
      t.status === 'running' ? { ...t, status: 'error', error: 'Stopped by user' } : t
    ))
  }

  const updateTask = (taskId, updater) => {
    setTasks(prev => prev.map(t => t.id === taskId ? updater(t) : t))
  }

  const runTask = async (taskText) => {
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
    setTasks(prev => [...prev, newTask])

    try {
      const formData = new FormData()
      formData.append('task', taskText)
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
          updateTask(localId, t => ({ ...t, steps: [...t.steps, data] }))
        }

        if (data.type === 'final') {
          eventSource.close()
          eventSourceRef.current = null
          setActiveTaskId(null)
          setIsRunning(false)
          onSessionCreated?.()
          updateTask(localId, t => ({ ...t, status: data.status, result: data.result, error: data.error }))
        }
      }

      eventSource.onerror = () => {
        eventSource.close()
        eventSourceRef.current = null
        setIsRunning(false)
        updateTask(localId, t => ({ ...t, status: 'error', error: 'Connection lost' }))
      }
    } catch (err) {
      setIsRunning(false)
      updateTask(localId, t => ({ ...t, status: 'error', error: err.message }))
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    runTask(input)
  }

  const hasTasks = tasks.length > 0

  return (
    <>
    {/* Hidden file input — must be outside overflow:hidden container */}
    <input type="file" ref={fileInputRef} onChange={handleFiles} multiple hidden
      accept="image/*,.pdf,.doc,.docx,.txt,.csv,.json,.xlsx,.xls" />

    <div className="new-session" onDrop={handleDrop} onDragOver={e => e.preventDefault()}>
      {/* Scrollable task feed area */}
      <div className="session-feed" ref={feedRef}>
        {!hasTasks && (
          <div className="session-welcome">
            <h1 className="welcome-title">What should I do?</h1>
          </div>
        )}

        {hasTasks && (
          <div className="task-feed">
            {tasks.map(task => (
              <TaskCard key={task.id} task={task} />
            ))}
            {isRunning && (
              <div className="task-controls">
                <button className="stop-btn" onClick={stopTask}>
                  <Square size={12} fill="currentColor" />
                  <span>Stop</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Input bar — always visible at bottom */}
      <div className="session-input-area">
        <div className="chat-input-box">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onPaste={handlePaste}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(e) } }}
            placeholder={isRunning ? 'Agent is working... wait or stop to send a new task' : 'Send a message...'}
            disabled={isRunning}
            rows={2}
          />

          {files.length > 0 && (
            <div className="input-attachments">
              {files.map((f, i) => (
                <div key={i} className="attachment-chip">
                  <span>{getFileIcon(f.name)}</span>
                  <span className="attachment-name">{f.name}</span>
                  <span className="attachment-size">{formatSize(f.size)}</span>
                  <button onClick={() => removeFile(i)}>&times;</button>
                </div>
              ))}
            </div>
          )}

          <div className="chat-toolbar">
            <div className="toolbar-left">
              <button className="toolbar-btn" onClick={() => fileInputRef.current?.click()} title="Add attachment" disabled={isRunning}>
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
                <button
                  className="run-task-btn"
                  onClick={handleSubmit}
                  disabled={!input.trim() && files.length === 0}
                >
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


function TaskCard({ task }) {
  const [showSteps, setShowSteps] = useState(false)
  const isDone = task.status !== 'running'

  return (
    <div className="task-card">
      <div className="task-header">
        <div className={`task-status ${task.status}`} />
        <div className="task-header-content">
          <span className="task-text">{task.task}</span>
          {task.files?.length > 0 && (
            <div className="task-files">
              {task.files.map((f, i) => (
                <span key={i} className="task-file-chip">{getFileIcon(f)} {f}</span>
              ))}
            </div>
          )}
        </div>
        <span className="task-badge">
          {task.status === 'running' ? `Step ${task.steps.length}...` :
           task.status === 'done' ? `${task.steps.length} steps` : 'Error'}
        </span>
      </div>

      {/* While running: show steps live */}
      {!isDone && task.steps.length > 0 && (
        <div className="steps-container">
          {task.steps.map((step, i) => <StepItem key={i} step={step} />)}
        </div>
      )}

      {task.status === 'running' && (
        <div className="loading-dots"><span /><span /><span /></div>
      )}

      {/* Once done: show result, with collapsible steps */}
      {(task.result || task.error) && (
        <div className="result-section">
          <div className="result-label">{task.error ? 'Error' : 'Result'}</div>
          <div className={`result-box ${task.error ? 'error' : 'success'}`}>
            {task.error || task.result}
          </div>
        </div>
      )}

      {isDone && task.steps.length > 0 && (
        <div className="steps-toggle-section">
          <button className="steps-toggle-btn" onClick={() => setShowSteps(!showSteps)}>
            {showSteps ? '\u25BE Hide' : '\u25B8 Show'} {task.steps.length} steps
          </button>
          {showSteps && (
            <div className="steps-container">
              {task.steps.map((step, i) => <StepItem key={i} step={step} />)}
            </div>
          )}
        </div>
      )}
    </div>
  )
}


function StepItem({ step }) {
  const [showScreenshot, setShowScreenshot] = useState(false)
  const evalClass = step.evaluation?.toLowerCase().includes('success') ? 'success' :
                    step.evaluation?.toLowerCase().includes('fail') ? 'failure' : ''

  return (
    <div className="step">
      <div className="step-header">
        <span className="step-number">Step {step.step}</span>
        {step.evaluation && <span className={`step-eval ${evalClass}`}>{step.evaluation}</span>}
      </div>

      {/* Goal / next action description */}
      {step.next_goal && <div className="step-goal">{step.next_goal}</div>}

      {/* Thinking — agent's internal reasoning */}
      {step.thinking && (
        <div className="step-thinking">
          <span className="step-field-label">Thinking</span>
          <p>{step.thinking}</p>
        </div>
      )}

      {/* Memory — what the agent remembers */}
      {step.memory && (
        <div className="step-memory">
          <span className="step-field-label">Memory</span>
          <p>{step.memory}</p>
        </div>
      )}

      {/* Actions */}
      {step.actions?.length > 0 && (
        <div className="step-actions">
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
