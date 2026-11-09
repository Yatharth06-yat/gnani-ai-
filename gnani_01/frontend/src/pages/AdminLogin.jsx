import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useAuth } from '../context/AuthContext';
import logo from '../styles/sm.png';

const AdminLogin = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const { adminLogin } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    setErrorMessage('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (!formData.email.trim() || !formData.password.trim()) {
      setErrorMessage('Please provide both administrative email and password.');
      return;
    }

    setLoading(true);

    try {
      const result = await adminLogin(formData.email.trim(), formData.password);
      if (result.success) {
        toast.success(`🛡️ Welcome Administrator ${result.admin?.name || ''}!`);
        navigate('/admin/dashboard');
      } else {
        setErrorMessage(result.message || 'Invalid administrative credentials.');
        toast.error(result.message || 'Administrative authentication failed');
      }
    } catch (err) {
      setErrorMessage(err.message || 'An error occurred during authentication.');
      toast.error('Admin authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        {/* Header with Shield Icon & Badge */}
        <div style={styles.header}>
          <img src={logo} alt="SwachhMap Logo" style={styles.logo} />
          <h2 style={styles.title}>Administrative Portal</h2>
          <div style={styles.badge}>RESTRICTED MUNICIPAL ACCESS</div>
          <p style={styles.subtitle}>
            Authorized city administrators and civic supervisors only.
          </p>
        </div>

        {errorMessage && (
          <div style={styles.errorAlert}>
            ⚠️ {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.formGroup}>
            <label style={styles.label}>Administrative Email / Username *</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="e.g. admin@swachhmap.gov.in"
              required
              style={styles.input}
              autoComplete="username"
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Password *</label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="••••••••••••"
              required
              style={styles.input}
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              ...styles.submitBtn,
              backgroundColor: loading ? '#475569' : '#0f172a',
              cursor: loading ? 'not-allowed' : 'pointer'
            }}
          >
            {loading ? '🔐 Authenticating with Security Server...' : '🛡️ Authenticate & Enter Dashboard'}
          </button>
        </form>

        <div style={styles.footerNote}>
          <span>Not an administrator?</span>{' '}
          <Link to="/login" style={styles.citizenLink}>
            Return to Citizen Login
          </Link>
          <div style={{ marginTop: '8px', fontSize: '0.75rem', color: '#94a3b8' }}>
            Default Admin: <code>admin@swachhmap.gov.in</code> / <code>admin123</code>
          </div>
        </div>
      </div>
    </div>
  );
};

const styles = {
  container: {
    minHeight: 'calc(100vh - 140px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0b1329',
    padding: '24px 16px',
    backgroundImage: 'radial-gradient(ellipse at top, #1e293b, #0b1329)'
  },
  card: {
    width: '100%',
    maxWidth: '460px',
    backgroundColor: '#ffffff',
    borderRadius: '16px',
    boxShadow: '0 20px 45px rgba(0, 0, 0, 0.4)',
    padding: '36px 32px',
    border: '1px solid #334155'
  },
  header: {
    textAlign: 'center',
    marginBottom: '24px'
  },
  logo: {
    width: '54px',
    height: '54px',
    borderRadius: '12px',
    marginBottom: '10px'
  },
  title: {
    margin: '0 0 6px 0',
    color: '#0f172a',
    fontSize: '1.6rem',
    fontWeight: '800'
  },
  badge: {
    display: 'inline-block',
    backgroundColor: '#fee2e2',
    color: '#991b1b',
    fontSize: '0.72rem',
    fontWeight: '800',
    letterSpacing: '0.08em',
    padding: '4px 10px',
    borderRadius: '20px',
    marginBottom: '8px'
  },
  subtitle: {
    margin: 0,
    fontSize: '0.88rem',
    color: '#64748b'
  },
  errorAlert: {
    backgroundColor: '#fef2f2',
    border: '1px solid #fecaca',
    color: '#b91c1c',
    padding: '10px 14px',
    borderRadius: '8px',
    fontSize: '0.88rem',
    marginBottom: '18px'
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px'
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px'
  },
  label: {
    fontSize: '0.86rem',
    fontWeight: '600',
    color: '#334155'
  },
  input: {
    padding: '12px 14px',
    borderRadius: '8px',
    border: '1.5px solid #cbd5e1',
    fontSize: '0.95rem',
    outline: 'none',
    transition: 'border 0.2s',
    backgroundColor: '#f8fafc'
  },
  submitBtn: {
    color: '#ffffff',
    border: 'none',
    borderRadius: '10px',
    padding: '14px',
    fontSize: '1rem',
    fontWeight: '700',
    marginTop: '8px',
    boxShadow: '0 4px 14px rgba(15, 23, 42, 0.3)',
    transition: 'all 0.2s'
  },
  footerNote: {
    marginTop: '24px',
    textAlign: 'center',
    fontSize: '0.88rem',
    color: '#64748b',
    borderTop: '1px solid #e2e8f0',
    paddingTop: '16px'
  },
  citizenLink: {
    color: '#2563eb',
    fontWeight: '600',
    textDecoration: 'none'
  }
};

export default AdminLogin;

