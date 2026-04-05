import { useState, useEffect } from 'react'
import { Settings, Save, RefreshCw } from 'lucide-react'
import { apiFetch } from '../lib/api'

export default function SettingsPage() {
  const [settings, setSettings] = useState({
    default_model: 'gemini-2.5-flash',
    max_steps: 25,
    use_vision: true,
    headless: false,
    max_actions_per_step: 5,
    default_timeout: 300,
  })
  const [loading, setLoading] = useState(true)
  const [saved, setSaved] = useState(false)

  const fetchSettings = async () => {
    setLoading(true)
    try {
      const res = await apiFetch('/api/settings')
      if (!res.ok) throw new Error(`${res.status}`)
      const data = await res.json()
      if (data && typeof data === 'object' && !data.error) setSettings(data)
    } catch (err) {
      console.error('Failed to fetch settings:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchSettings() }, [])

  const saveSettings = async () => {
    try {
      await apiFetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      console.error('Failed to save settings:', err)
    }
  }

  const update = (key, value) => setSettings(prev => ({ ...prev, [key]: value }))
  const updateInt = (key, value) => {
    const n = parseInt(value)
    if (!isNaN(n)) update(key, n)
  }

  if (loading) return <div className="page"><div className="page-loading">Loading settings...</div></div>

  return (
    <div className="page">
      <div className="page-header">
        <h2><Settings size={22} /> Settings</h2>
        <div className="page-header-actions">
          <button className="btn-secondary" onClick={fetchSettings}><RefreshCw size={14} /> Reset</button>
          <button className="btn-primary" onClick={saveSettings}>
            <Save size={14} /> {saved ? 'Saved!' : 'Save'}
          </button>
        </div>
      </div>

      <div className="settings-form">
        <div className="settings-section">
          <h3>Agent Configuration</h3>

          <div className="setting-row">
            <div className="setting-info">
              <label>Default Model</label>
              <p>The LLM model used for browser agent tasks.</p>
            </div>
            <select className="form-select" value={settings.default_model}
              onChange={e => update('default_model', e.target.value)}>
              <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
              <option value="gpt-4o">GPT-4o</option>
            </select>
          </div>

          <div className="setting-row">
            <div className="setting-info">
              <label>Max Steps</label>
              <p>Maximum number of steps the agent can take per task.</p>
            </div>
            <input type="number" className="form-input form-input-sm" value={settings.max_steps}
              onChange={e => updateInt('max_steps', e.target.value)} min={1} max={100} />
          </div>

          <div className="setting-row">
            <div className="setting-info">
              <label>Max Actions Per Step</label>
              <p>Maximum actions the agent can perform in a single step.</p>
            </div>
            <input type="number" className="form-input form-input-sm" value={settings.max_actions_per_step}
              onChange={e => updateInt('max_actions_per_step', e.target.value)} min={1} max={20} />
          </div>

          <div className="setting-row">
            <div className="setting-info">
              <label>Default Timeout (seconds)</label>
              <p>Maximum time a task can run before being stopped.</p>
            </div>
            <input type="number" className="form-input form-input-sm" value={settings.default_timeout}
              onChange={e => updateInt('default_timeout', e.target.value)} min={30} max={3600} />
          </div>

          <div className="setting-row">
            <div className="setting-info">
              <label>Google API Key</label>
              <p>API key for Google services (e.g. Gemini models).</p>
            </div>
            <input type="text" className="form-input form-input-sm" value={settings.google_api_key || ''}
              onChange={e => update('google_api_key', e.target.value)}
              placeholder="Enter your Google API key" />
          </div>
        </div>

        <div className="settings-section">
          <h3>Browser Configuration</h3>

          <div className="setting-row">
            <div className="setting-info">
              <label>Use Vision</label>
              <p>Send screenshots to the LLM for visual understanding.</p>
            </div>
            <label className="toggle">
              <input type="checkbox" checked={settings.use_vision}
                onChange={e => update('use_vision', e.target.checked)} />
              <span className="toggle-slider" />
            </label>
          </div>

          <div className="setting-row">
            <div className="setting-info">
              <label>Headless Mode</label>
              <p>Run browser without a visible window.</p>
            </div>
            <label className="toggle">
              <input type="checkbox" checked={settings.headless}
                onChange={e => update('headless', e.target.checked)} />
              <span className="toggle-slider" />
            </label>
          </div>
        </div>
      </div>
    </div>
  )
}
