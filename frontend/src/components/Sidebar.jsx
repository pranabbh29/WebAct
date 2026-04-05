import { NavLink } from 'react-router-dom'
import {
  PenSquare, Bot, Monitor, Zap, CalendarClock, BarChart3,
  Settings, X, ChevronRight
} from 'lucide-react'
import { useState } from 'react'

const NAV_ITEMS = [
  { path: '/', icon: PenSquare, label: 'New Session', shortcut: '⇧⌘O' },
  { path: '/sessions', icon: Bot, label: 'Agent Sessions' },
  { path: '/remote-browsers', icon: Monitor, label: 'Remote Browsers' },
  { path: '/skills', icon: Zap, label: 'Skills' },
  { path: '/scheduled-jobs', icon: CalendarClock, label: 'Scheduled Jobs' },
  { path: '/analytics', icon: BarChart3, label: 'Analytics' },
]

const GET_STARTED = [
  { label: 'Research papers digest', tag: 'EX' },
  { label: 'Social media trends', tag: 'EX' },
  { label: 'Broken link checker', tag: 'EX' },
]

export default function Sidebar({ sessions = [] }) {
  const [showGetStarted, setShowGetStarted] = useState(true)

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-logo">
          <div className="logo-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
              <path d="M2 12h20" />
            </svg>
          </div>
          <span className="logo-text">WebAct</span>
        </div>
        <button className="sidebar-icon-btn">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="7" height="7" />
            <rect x="14" y="3" width="7" height="7" />
            <rect x="3" y="14" width="7" height="7" />
            <rect x="14" y="14" width="7" height="7" />
          </svg>
        </button>
      </div>

      <nav className="sidebar-nav">
        {NAV_ITEMS.map(item => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/'}
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          >
            <item.icon size={18} />
            <span>{item.label}</span>
            {item.shortcut && <span className="nav-shortcut">{item.shortcut}</span>}
          </NavLink>
        ))}

        <NavLink
          to="/settings"
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
        >
          <Settings size={18} />
          <span>Settings</span>
          <ChevronRight size={14} className="nav-chevron" />
        </NavLink>
      </nav>

      {showGetStarted && (
        <div className="sidebar-section">
          <div className="section-header">
            <span className="section-title">Get started</span>
            <button className="section-close" onClick={() => setShowGetStarted(false)}>
              <X size={14} />
            </button>
          </div>
          {GET_STARTED.map((item, i) => (
            <NavLink
              key={i}
              to={`/?example=${encodeURIComponent(item.label)}`}
              className="nav-item example-item"
            >
              <span>{item.label}</span>
              <span className="example-tag">{item.tag}</span>
            </NavLink>
          ))}
        </div>
      )}

      {sessions.length > 0 && (
        <div className="sidebar-section">
          <div className="section-header">
            <span className="section-title">History</span>
          </div>
          {sessions.slice(0, 10).map(session => (
            <NavLink
              key={session.id}
              to={`/sessions/${session.id}`}
              className="nav-item history-item"
            >
              <span className="history-label">{session.task}</span>
              {session.version && <span className="history-version">{session.version}</span>}
            </NavLink>
          ))}
        </div>
      )}
    </aside>
  )
}
