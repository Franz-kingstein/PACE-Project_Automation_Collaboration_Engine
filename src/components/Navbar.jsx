import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';
import { useAuth } from '../contexts/AuthContext';

const linkStyle = {
  color: 'white',
  textDecoration: 'none',
  padding: '10px 12px',
  borderRadius: 8,
  transition: 'background-color .2s ease',
};

const Navbar = () => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { user } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);

  const isActive = (path) => pathname === path || pathname.startsWith(path + '/');
  const go = (path) => { setMenuOpen(false); navigate(path); };
  const handleLogout = async () => { await signOut(auth); navigate('/'); };

  const sidebarWidth = 240;

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={() => setMenuOpen((v) => !v)}
        aria-label="Menu"
        className="sidebar-toggle"
        style={{ position: 'fixed', top: 12, left: 12, zIndex: 200, background: '#21808D', color: 'white', border: 'none', width: 40, height: 40, borderRadius: 8, cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}
      >☰</button>

      {/* Sidebar */}
      <aside
        className="sidebar"
        style={{ position: 'fixed', top: 0, left: 0, bottom: 0, width: sidebarWidth, background: '#21808D', color: 'white', boxShadow: '2px 0 8px rgba(0,0,0,0.15)', zIndex: 150, transform: menuOpen ? 'translateX(0)' : 'translateX(-100%)', transition: 'transform .25s ease' }}
      >
        <div onClick={() => go('/home')} style={{ height: 60, display: 'flex', alignItems: 'center', padding: '0 16px', borderBottom: '1px solid rgba(255,255,255,0.2)', gap: 8, cursor: 'pointer' }}>
          <span style={{ fontSize: 18, transform: 'rotate(-45deg)' }}>➤</span>
          <strong>PACE</strong>
        </div>
        <div style={{ display: 'grid', gap: 4, padding: 12 }}>
          <button onClick={() => go('/home')} style={{ ...linkStyle, textAlign: 'left', background: isActive('/home') ? 'rgba(255,255,255,0.2)' : 'transparent' }}>Home</button>
          <button onClick={() => go('/tasks')} style={{ ...linkStyle, textAlign: 'left', background: isActive('/tasks') ? 'rgba(255,255,255,0.2)' : 'transparent' }}>My Tasks</button>
          <button onClick={() => go('/home#projects')} style={{ ...linkStyle, textAlign: 'left' }}>Projects</button>
          <button onClick={() => go('/chat')} style={{ ...linkStyle, textAlign: 'left', background: isActive('/chat') ? 'rgba(255,255,255,0.2)' : 'transparent' }}>Chat</button>
          <button onClick={() => go('/bugs')} style={{ ...linkStyle, textAlign: 'left', background: isActive('/bugs') ? 'rgba(255,255,255,0.2)' : 'transparent' }}>Bugs</button>
        </div>
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: 12, borderTop: '1px solid rgba(255,255,255,0.2)' }}>
          <button onClick={() => setUserOpen((o) => !o)} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'transparent', border: 'none', color: 'white', cursor: 'pointer', width: '100%', padding: 8 }}>
            <img src={user?.photoURL || '/default-avatar.png'} alt="avatar" style={{ width: 32, height: 32, borderRadius: '50%' }} />
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: 14 }}>{user?.displayName || user?.email}</div>
              <div style={{ fontSize: 12, opacity: 0.8 }}>Menu ▾</div>
            </div>
          </button>
          {userOpen && (
            <div style={{ background: 'white', color: '#1F2121', borderRadius: 8, overflow: 'hidden', boxShadow: '0 8px 24px rgba(0,0,0,0.2)' }}>
              <button onClick={() => { setUserOpen(false); go('/profile'); }} style={{ display: 'block', width: '100%', textAlign: 'left', border: 'none', background: 'white', padding: '10px 12px', cursor: 'pointer' }}>Profile</button>
              <button onClick={() => { setUserOpen(false); go('/profile'); }} style={{ display: 'block', width: '100%', textAlign: 'left', border: 'none', background: 'white', padding: '10px 12px', cursor: 'pointer' }}>Settings</button>
              <button onClick={handleLogout} style={{ display: 'block', width: '100%', textAlign: 'left', border: 'none', background: 'white', padding: '10px 12px', cursor: 'pointer', color: '#B00020' }}>Logout</button>
            </div>
          )}
        </div>
      </aside>

      {/* Responsive show on desktop */}
      <style>{`
        @media (min-width: 768px) {
          .sidebar { transform: translateX(0) !important; }
          .sidebar-toggle { display: none; }
        }
      `}</style>
    </>
  );
};

export default Navbar;
