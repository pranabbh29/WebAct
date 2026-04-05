import { useState, useEffect } from 'react'
import { Monitor, Plus, Trash2, RefreshCw, Circle, Wifi, WifiOff } from 'lucide-react'
import { apiFetch } from '../lib/api'

export default function RemoteBrowsers() {
  const [browsers, setBrowsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [newBrowser, setNewBrowser] = useState({ name: '', ws_url: '' })

  const fetchBrowsers = async () => {
    setLoading(true)
    try {
      const res = await apiFetch('/api/remote-browsers')
      if (!res.ok) throw new Error(`${res.status}`)
      const data = await res.json()
      if (Array.isArray(data)) setBrowsers(data)
    } catch (err) {
      console.error('Failed to fetch browsers:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchBrowsers() }, [])

  const addBrowser = async () => {
    if (!newBrowser.name || !newBrowser.ws_url) return
    try {
      const res = await apiFetch('/api/remote-browsers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newBrowser),
      })
      if (!res.ok) throw new Error(`${res.status}`)
      const data = await res.json()
      setBrowsers(prev => [...prev, data])
      setNewBrowser({ name: '', ws_url: '' })
      setShowAdd(false)
    } catch (err) {
      console.error('Failed to add browser:', err)
    }
  }

  const deleteBrowser = async (id) => {
    if (!confirm('Remove this browser connection?')) return
    try {
      const res = await apiFetch(`/api/remote-browsers/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error(`${res.status}`)
      setBrowsers(prev => prev.filter(b => b.id !== id))
    } catch (err) {
      console.error('Failed to delete browser:', err)
    }
  }

  const testConnection = async (id) => {
    try {
      const res = await apiFetch(`/api/remote-browsers/${id}/test`, { method: 'POST' })
      const data = await res.json()
      setBrowsers(prev => prev.map(b => b.id === id ? { ...b, status: data.status } : b))
    } catch (err) {
      setBrowsers(prev => prev.map(b => b.id === id ? { ...b, status: 'error' } : b))
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <h2><Monitor size={22} /> Remote Browsers</h2>
        <div className="page-header-actions">
          <button className="btn-secondary" onClick={fetchBrowsers}><RefreshCw size={14} /> Refresh</button>
          <button className="btn-primary" onClick={() => setShowAdd(true)}><Plus size={14} /> Add Browser</button>
        </div>
      </div>

      {showAdd && (
        <div className="add-form">
          <input
            className="form-input"
            placeholder="Browser name"
            value={newBrowser.name}
            onChange={e => setNewBrowser(prev => ({ ...prev, name: e.target.value }))}
          />
          <input
            className="form-input"
            placeholder="WebSocket URL (ws://...)"
            value={newBrowser.ws_url}
            onChange={e => setNewBrowser(prev => ({ ...prev, ws_url: e.target.value }))}
          />
          <div className="form-actions">
            <button className="btn-secondary" onClick={() => setShowAdd(false)}>Cancel</button>
            <button className="btn-primary" onClick={addBrowser}>Add</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="page-loading">Loading browsers...</div>
      ) : browsers.length === 0 ? (
        <div className="page-empty">
          <Monitor size={48} strokeWidth={1} />
          <h3>No remote browsers</h3>
          <p>Add a remote browser connection to run agents on external Chrome instances.</p>
        </div>
      ) : (
        <div className="cards-grid">
          {browsers.map(browser => (
            <div key={browser.id} className="browser-card">
              <div className="browser-card-header">
                <div className="browser-info">
                  {browser.status === 'connected' ? <Wifi size={16} className="text-success" /> : <WifiOff size={16} className="text-muted" />}
                  <span className="browser-name">{browser.name}</span>
                </div>
                <span className={`status-dot ${browser.status || 'unknown'}`} />
              </div>
              <div className="browser-url">{browser.ws_url}</div>
              <div className="browser-card-actions">
                <button className="btn-secondary btn-sm" onClick={() => testConnection(browser.id)}>Test</button>
                <button className="icon-btn danger" onClick={() => deleteBrowser(browser.id)}><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
