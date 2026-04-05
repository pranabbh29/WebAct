import { useState, useEffect } from 'react'
import { Zap, Plus, Trash2, Play, Edit3, RefreshCw } from 'lucide-react'
import { apiFetch } from '../lib/api'

export default function Skills() {
  const [skills, setSkills] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [newSkill, setNewSkill] = useState({ name: '', description: '', prompt: '' })

  const fetchSkills = async () => {
    setLoading(true)
    try {
      const res = await apiFetch('/api/skills')
      if (!res.ok) throw new Error(`${res.status}`)
      const data = await res.json()
      if (Array.isArray(data)) setSkills(data)
    } catch (err) {
      console.error('Failed to fetch skills:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchSkills() }, [])

  const addSkill = async () => {
    if (!newSkill.name || !newSkill.prompt) return
    try {
      const res = await apiFetch('/api/skills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSkill),
      })
      if (!res.ok) throw new Error(`${res.status}`)
      const data = await res.json()
      setSkills(prev => [...prev, data])
      setNewSkill({ name: '', description: '', prompt: '' })
      setShowAdd(false)
    } catch (err) {
      console.error('Failed to add skill:', err)
    }
  }

  const deleteSkill = async (id) => {
    if (!confirm('Delete this skill?')) return
    try {
      const res = await apiFetch(`/api/skills/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error(`${res.status}`)
      setSkills(prev => prev.filter(s => s.id !== id))
    } catch (err) {
      console.error('Failed to delete skill:', err)
    }
  }

  const runSkill = async (skill) => {
    try {
      const res = await apiFetch('/api/skills/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skill_id: skill.id }),
      })
      if (!res.ok) throw new Error(`${res.status}`)
      alert(`Skill "${skill.name}" started! Check Agent Sessions for progress.`)
    } catch (err) {
      console.error('Failed to run skill:', err)
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <h2><Zap size={22} /> Skills</h2>
        <div className="page-header-actions">
          <button className="btn-secondary" onClick={fetchSkills}><RefreshCw size={14} /> Refresh</button>
          <button className="btn-primary" onClick={() => setShowAdd(true)}><Plus size={14} /> New Skill</button>
        </div>
      </div>

      {showAdd && (
        <div className="add-form">
          <input
            className="form-input"
            placeholder="Skill name"
            value={newSkill.name}
            onChange={e => setNewSkill(prev => ({ ...prev, name: e.target.value }))}
          />
          <input
            className="form-input"
            placeholder="Description"
            value={newSkill.description}
            onChange={e => setNewSkill(prev => ({ ...prev, description: e.target.value }))}
          />
          <textarea
            className="form-textarea"
            placeholder="Task prompt (what should the agent do?)"
            value={newSkill.prompt}
            onChange={e => setNewSkill(prev => ({ ...prev, prompt: e.target.value }))}
            rows={4}
          />
          <div className="form-actions">
            <button className="btn-secondary" onClick={() => setShowAdd(false)}>Cancel</button>
            <button className="btn-primary" onClick={addSkill}>Create</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="page-loading">Loading skills...</div>
      ) : skills.length === 0 ? (
        <div className="page-empty">
          <Zap size={48} strokeWidth={1} />
          <h3>No skills created</h3>
          <p>Skills are reusable task templates. Create one to quickly run common browser tasks.</p>
        </div>
      ) : (
        <div className="cards-grid">
          {skills.map(skill => (
            <div key={skill.id} className="skill-card">
              <div className="skill-card-header">
                <Zap size={16} className="text-accent" />
                <span className="skill-name">{skill.name}</span>
              </div>
              {skill.description && <p className="skill-desc">{skill.description}</p>}
              <p className="skill-prompt">{skill.prompt}</p>
              <div className="skill-card-actions">
                <button className="btn-primary btn-sm" onClick={() => runSkill(skill)}>
                  <Play size={12} /> Run
                </button>
                <button className="icon-btn danger" onClick={() => deleteSkill(skill.id)}>
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
