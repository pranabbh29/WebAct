import { useState, useEffect, useCallback } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Sidebar from './components/Sidebar'
import TopBar from './components/TopBar'
import LoginPage from './pages/LoginPage'
import NewSession from './pages/NewSession'
import AgentSessions from './pages/AgentSessions'
import SessionDetail from './pages/SessionDetail'
import RemoteBrowsers from './pages/RemoteBrowsers'
import Skills from './pages/Skills'
import ScheduledJobs from './pages/ScheduledJobs'
import Analytics from './pages/Analytics'
import SettingsPage from './pages/SettingsPage'
import { apiFetch } from './lib/api'
import './App.css'

function AppShell() {
  const [sessions, setSessions] = useState([])

  const fetchSessions = useCallback(async () => {
    try {
      const res = await apiFetch('/api/sessions')
      if (!res.ok) return
      const data = await res.json()
      if (Array.isArray(data)) setSessions(data)
    } catch {}
  }, [])

  useEffect(() => { fetchSessions() }, [fetchSessions])

  return (
    <div className="app-layout">
      <Sidebar sessions={sessions} />
      <div className="app-main">
        <TopBar />
        <div className="app-content">
          <Routes>
            <Route path="/" element={<NewSession onSessionCreated={fetchSessions} />} />
            <Route path="/sessions" element={<AgentSessions />} />
            <Route path="/sessions/:id" element={<SessionDetail />} />
            <Route path="/remote-browsers" element={<RemoteBrowsers />} />
            <Route path="/skills" element={<Skills />} />
            <Route path="/scheduled-jobs" element={<ScheduledJobs />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </div>
      </div>
    </div>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/*" element={
            <ProtectedRoute>
              <AppShell />
            </ProtectedRoute>
          } />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
