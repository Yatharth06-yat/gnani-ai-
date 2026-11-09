import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useVoiceActivation } from '../context/VoiceActivationContext';
import { toast } from 'react-toastify';
import logo from '../styles/sm.png';

const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const {
    wakeWordEnabled,
    toggleWakeWord,
    openAssistant,
    wakeState,
    isSupported
  } = useVoiceActivation();

  const handleLogout = () => {
    logout();
    toast.success('👋 Logged out successfully!');
    navigate('/');
    setMobileMenuOpen(false);
  };

  const closeMenu = () => setMobileMenuOpen(false);

  return (
    <nav style={styles.navbar}>
      <div style={styles.container}>
        {/* ✅ Logo + Title */}
        <Link to="/" style={styles.logo} onClick={closeMenu}>
          <img
            src={logo}
            alt="SwachhMap Logo"
            style={{
              width: '35px',
              height: '35px',
              marginRight: '10px',
              borderRadius: '6px',
              objectFit: 'cover',
            }}
          />
          SwachhMap
        </Link>

        {/* Mobile Hamburger Button */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          style={styles.hamburgerBtn}
          aria-label="Toggle navigation menu"
        >
          {mobileMenuOpen ? '✕' : '☰'}
        </button>

        <div
          className={`navbar-menu ${mobileMenuOpen ? 'mobile-open' : 'mobile-closed'}`}
          style={{
            ...styles.menu,
            ...(mobileMenuOpen ? styles.mobileMenuOpen : styles.mobileMenuClosed)
          }}
        >
          <Link to="/" style={styles.link} onClick={closeMenu}>🏠 Home</Link>
          <Link to="/map" style={styles.link} onClick={closeMenu}>🗺️ Map</Link>
          <Link to="/report" style={styles.link} onClick={closeMenu}>📷 Report Garbage</Link>
          <Link to="/my-reports" style={styles.link} onClick={closeMenu}>📋 My Reports</Link>

          {/* Siri-style Voice Activation Status & Quick Trigger */}
          <div style={styles.voiceSection} className="voice-section-mobile">
            <button
              onClick={() => {
                openAssistant('Hey Swachh Saathi');
                closeMenu();
              }}
              title="Click to talk to Swachh Saathi or say 'Hey Swachh Saathi'"
              style={{
                ...styles.voiceAssistantBtn,
                borderColor: wakeWordEnabled ? '#10b981' : '#cbd5e1'
              }}
            >
              <span style={{
                display: 'inline-block',
                width: 8,
                height: 8,
                borderRadius: '50%',
                backgroundColor: wakeWordEnabled ? '#10b981' : '#94a3b8',
                boxShadow: wakeWordEnabled ? '0 0 6px #10b981' : 'none'
              }} />
              <span style={{ fontWeight: 600 }}>Swachh Saathi</span>
            </button>

            <button
              onClick={toggleWakeWord}
              title={
                !isSupported
                  ? 'Voice recognition not supported in this browser'
                  : wakeWordEnabled
                    ? "Wake word 'Hey Swachh Saathi' is ON. Click to pause."
                    : "Click to enable wake word 'Hey Swachh Saathi'"
              }
              style={{
                ...styles.wakeWordToggleBtn,
                backgroundColor: wakeWordEnabled ? '#ecfdf5' : '#f1f5f9',
                color: wakeWordEnabled ? '#065f46' : '#64748b'
              }}
            >
              {wakeWordEnabled ? '🎙️ "Hey Swachh Saathi" ON' : '🎙️ Wake Word Off'}
            </button>
          </div>


          {user ? (
            <div style={styles.userSection}>
              <span style={user.role === 'admin' ? styles.adminBadge : styles.userBadge}>
                {user.role === 'admin' ? '🛡️ Admin' : '👤 Citizen'}: {user.name?.split(' ')[0]}
              </span>
              <button onClick={handleLogout} style={styles.logoutButton}>
                🚪 Logout
              </button>
            </div>
          ) : (
            <div style={styles.authSection}>
              <Link to="/login" style={styles.loginButton} onClick={closeMenu}>🔐 Login</Link>
              <Link to="/register" style={styles.registerButton} onClick={closeMenu}>📝 Register</Link>
              <Link to="/admin/login" style={styles.adminNavBtn} onClick={closeMenu}>🛡️ Admin Login</Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};

const styles = {
  navbar: {
    backgroundColor: '#ffffff',
    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
    position: 'sticky',
    top: 0,
    zIndex: 1000,
    borderBottom: '1px solid #e2e8f0',
    width: '100%'
  },
  container: {
    maxWidth: '1440px',
    margin: '0 auto',
    padding: '0 24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: '64px',
    position: 'relative'
  },
  hamburgerBtn: {
    display: 'none',
    background: 'transparent',
    border: 'none',
    fontSize: '22px',
    cursor: 'pointer',
    color: '#334155',
    padding: '6px'
  },
  logo: {
    fontSize: '20px',
    fontWeight: '700',
    color: '#4f46e5',
    textDecoration: 'none',
    display: 'flex',
    alignItems: 'center',
    flexShrink: 0
  },
  menu: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    flexWrap: 'nowrap'
  },
  mobileMenuClosed: {},
  mobileMenuOpen: {},
  link: {
    color: '#475569',
    textDecoration: 'none',
    padding: '6px 10px',
    borderRadius: '6px',
    fontWeight: '500',
    transition: 'all 0.15s ease',
    fontSize: '14px',
    whiteSpace: 'nowrap'
  },
  developerLink: {
    color: '#10b981',
    textDecoration: 'none',
    padding: '6px 10px',
    borderRadius: '6px',
    fontWeight: '600',
    fontSize: '14px',
    whiteSpace: 'nowrap'
  },
  adminLink: {
    color: '#dc2626',
    textDecoration: 'none',
    padding: '6px 10px',
    borderRadius: '6px',
    fontWeight: '600',
    fontSize: '14px',
    backgroundColor: '#fef2f2',
    whiteSpace: 'nowrap'
  },
  userSection: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginLeft: '6px'
  },
  welcomeText: {
    fontSize: '13px',
    color: '#374151',
    fontWeight: '500'
  },
  logoutButton: {
    backgroundColor: '#64748b',
    color: 'white',
    border: 'none',
    padding: '6px 12px',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: '500',
    transition: 'background-color 0.15s ease',
    whiteSpace: 'nowrap'
  },
  authSection: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center'
  },
  loginButton: {
    color: '#4f46e5',
    border: '1.5px solid #4f46e5',
    backgroundColor: 'transparent',
    padding: '5px 12px',
    borderRadius: '6px',
    textDecoration: 'none',
    fontWeight: '600',
    fontSize: '13px',
    whiteSpace: 'nowrap'
  },
  registerButton: {
    backgroundColor: '#10b981',
    color: 'white',
    padding: '6px 12px',
    borderRadius: '6px',
    textDecoration: 'none',
    fontWeight: '600',
    fontSize: '13px',
    whiteSpace: 'nowrap'
  },
  adminNavBtn: {
    backgroundColor: '#0f172a',
    color: '#ffffff',
    padding: '6px 12px',
    borderRadius: '6px',
    textDecoration: 'none',
    fontWeight: '700',
    fontSize: '12px',
    border: '1px solid #334155',
    whiteSpace: 'nowrap'
  },
  adminBadge: {
    backgroundColor: '#fee2e2',
    color: '#991b1b',
    padding: '4px 10px',
    borderRadius: '16px',
    fontWeight: '700',
    fontSize: '11px',
    border: '1px solid #f87171',
    whiteSpace: 'nowrap'
  },
  userBadge: {
    backgroundColor: '#e0f2fe',
    color: '#0369a1',
    padding: '4px 10px',
    borderRadius: '16px',
    fontWeight: '600',
    fontSize: '11px',
    whiteSpace: 'nowrap'
  },
  voiceSection: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '3px 6px',
    background: '#f8fafc',
    borderRadius: '20px',
    border: '1px solid #e2e8f0',
    whiteSpace: 'nowrap'
  },
  voiceAssistantBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '5px',
    padding: '5px 10px',
    borderRadius: '16px',
    border: '1px solid #cbd5e1',
    background: '#ffffff',
    color: '#0f172a',
    fontSize: '12px',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    whiteSpace: 'nowrap'
  },
  wakeWordToggleBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '5px 8px',
    borderRadius: '16px',
    border: 'none',
    fontSize: '11px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    whiteSpace: 'nowrap'
  }
};

// Inject responsive CSS for mobile & laptop navbar
if (typeof document !== 'undefined') {
  const navResponsiveStyle = document.createElement('style');
  navResponsiveStyle.textContent = `
    /* Laptop / Desktop styling */
    @media (min-width: 992px) {
      nav button[aria-label="Toggle navigation menu"] {
        display: none !important;
      }
      nav .navbar-menu {
        display: flex !important;
        flex-direction: row !important;
        position: static !important;
        background: transparent !important;
        padding: 0 !important;
        box-shadow: none !important;
        border: none !important;
      }
      nav .link:hover {
        color: #4f46e5 !important;
        background-color: #f8fafc !important;
      }
    }

    /* Mobile / Tablet Drawer */
    @media (max-width: 991px) {
      nav button[aria-label="Toggle navigation menu"] {
        display: block !important;
      }
      nav .mobile-closed {
        display: none !important;
      }
      nav .mobile-open {
        display: flex !important;
        flex-direction: column !important;
        align-items: stretch !important;
        position: absolute;
        top: 100%;
        left: 0;
        right: 0;
        background: #ffffff;
        padding: 16px 20px;
        box-shadow: 0 12px 28px rgba(0,0,0,0.12);
        border-bottom: 1px solid #e2e8f0;
        gap: 10px !important;
        z-index: 9999;
      }
      nav .mobile-open > a,
      nav .mobile-open button {
        width: 100%;
        text-align: center;
        justify-content: center;
      }
      nav .mobile-open .voice-section-mobile {
        flex-direction: column !important;
        width: 100%;
      }
    }
  `;
  document.head.appendChild(navResponsiveStyle);
}

export default Navbar;
