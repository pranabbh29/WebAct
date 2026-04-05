import { useAuth } from '../contexts/AuthContext'
import { LogOut } from 'lucide-react'

export default function TopBar() {
  const { user, signOut } = useAuth()

  const avatar = user?.user_metadata?.avatar_url
  const name = user?.user_metadata?.full_name || user?.email || ''

  return (
    <header className="topbar">
      <div className="topbar-left">
        <span className="topbar-title">WebAct</span>
      </div>

      <div className="topbar-right">
        {user && (
          <div className="user-info">
            {avatar && <img src={avatar} alt="" className="user-avatar" />}
            <span className="user-name">{name}</span>
            <button className="icon-btn" onClick={signOut} title="Sign out">
              <LogOut size={16} />
            </button>
          </div>
        )}
      </div>
    </header>
  )
}
