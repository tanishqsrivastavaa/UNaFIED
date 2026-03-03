import { LogOut, MessageSquare, Settings } from "lucide-react";
import { useAuthStore } from "../../stores/authStore";
import { useNavigate } from "react-router-dom";

export default function Sidebar() {
    const user = useAuthStore((s) => s.user);
    const logoutFn = useAuthStore((s) => s.logout);
    const navigate = useNavigate();

    const handleLogout = async () => {
        await logoutFn();
        navigate("/login");
    };

    return (
        <aside className="sidebar">
            {/* Logo */}
            <div className="sidebar-logo">
                <span>UNaFIED</span>
            </div>

            {/* Navigation */}
            <nav className="sidebar-nav">
                <button className="sidebar-link active">
                    <MessageSquare size={18} />
                    <span>Chats</span>
                </button>
                <button className="sidebar-link">
                    <Settings size={18} />
                    <span>Settings</span>
                </button>
            </nav>

            {/* Spacer */}
            <div style={{ flex: 1 }} />

            {/* User Info */}
            <div className="sidebar-user">
                <div className="sidebar-avatar">
                    {user?.email?.charAt(0).toUpperCase()}
                </div>
                <div className="sidebar-user-info">
                    <span className="sidebar-email">{user?.email}</span>
                </div>
                <button className="sidebar-logout" onClick={handleLogout} title="Logout">
                    <LogOut size={16} />
                </button>
            </div>

            <style>{`
        .sidebar {
          width: 200px;
          min-width: 200px;
          height: 100vh;
          background: var(--color-sidebar);
          display: flex;
          flex-direction: column;
          padding: 1.25rem 0.75rem;
        }
        .sidebar-logo {
          padding: 0 0.5rem;
          margin-bottom: 2rem;
        }
        .sidebar-logo span {
          font-family: var(--font-serif);
          font-size: 1.5rem;
          color: #fff;
        }
        .sidebar-nav {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }
        .sidebar-link {
          display: flex;
          align-items: center;
          gap: 0.6rem;
          padding: 0.6rem 0.75rem;
          border-radius: 8px;
          border: none;
          background: transparent;
          color: #aaa;
          font-size: 0.85rem;
          cursor: pointer;
          transition: all 0.15s;
          text-align: left;
          width: 100%;
          font-family: var(--font-sans);
        }
        .sidebar-link:hover {
          background: var(--color-sidebar-hover);
          color: #fff;
        }
        .sidebar-link.active {
          background: var(--color-accent);
          color: #111;
        }
        .sidebar-user {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.75rem 0.5rem;
          border-top: 1px solid #333;
        }
        .sidebar-avatar {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: var(--color-accent);
          color: #111;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 0.8rem;
          flex-shrink: 0;
        }
        .sidebar-user-info {
          flex: 1;
          min-width: 0;
        }
        .sidebar-email {
          color: #ccc;
          font-size: 0.75rem;
          display: block;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .sidebar-logout {
          background: none;
          border: none;
          color: #777;
          cursor: pointer;
          padding: 0.25rem;
          border-radius: 6px;
          transition: color 0.15s;
          display: flex;
        }
        .sidebar-logout:hover {
          color: #fff;
        }
      `}</style>
        </aside>
    );
}
