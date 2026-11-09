import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useAuth } from '../context/AuthContext';

const Login = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [loading, setLoading] = useState(false);
  
  const { login, demoUsers = [] } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const result = await login(formData.email, formData.password);
      
      if (result.success) {
        toast.success('🎉 Login successful! Welcome back!');
        navigate('/');
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      toast.error('Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async (email, password) => {
    setLoading(true);
    try {
      const result = await login(email, password);
      if (result.success) {
        toast.success('🎉 Demo login successful!');
        navigate('/');
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      toast.error('Demo login failed.');
    } finally {
      setLoading(false);
    }
  };

  const fillCredentials = (email, password) => {
    setFormData({ email, password });
    toast.info('Demo credentials filled! Click Sign In to login.');
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.header}>
          <h2 style={styles.title}>🔐 Login to SwachhMap</h2>
          <p style={styles.subtitle}>Welcome back! Please sign in to your account.</p>
        </div>
        
        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.formGroup}>
            <label style={styles.label}>Email Address</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              placeholder="Enter your email"
              style={styles.input}
              autoComplete="username"
            />
          </div>
          
          <div style={styles.formGroup}>
            <label style={styles.label}>Password</label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              required
              placeholder="Enter your password"
              style={styles.input}
              autoComplete="current-password"
            />
          </div>
          
          <button 
            type="submit" 
            disabled={loading}
            style={{
              ...styles.submitButton,
              opacity: loading ? 0.7 : 1,
              cursor: loading ? 'not-allowed' : 'pointer'
            }}
          >
            {loading ? '🔄 Signing in...' : '🚀 Sign In'}
          </button>
        </form>
        
        <div style={styles.divider}>
          <span style={styles.dividerText}>OR TRY DEMO ACCOUNTS</span>
        </div>
        
        <div style={styles.demoSection}>
          <h4 style={styles.demoTitle}>🎯 Quick Demo Login</h4>
          <div style={styles.demoGrid}>
            {(demoUsers || []).map((user, index) => (
              <div key={index} style={styles.demoCard}>
                <div style={styles.demoInfo}>
                  <strong>{user.name}</strong>
                  <div style={styles.demoRole}>{user.role}</div>
                  <div style={styles.demoEmail}>{user.email}</div>
                </div>
                <div style={styles.demoActions}>
                  <button
                    type="button"
                    onClick={() => fillCredentials(user.email, user.password)}
                    style={styles.fillButton}
                    disabled={loading}
                  >
                    📝 Fill
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDemoLogin(user.email, user.password)}
                    style={styles.loginButton}
                    disabled={loading}
                  >
                    🚀 Login
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
        
        <div style={styles.footer}>
          <p style={styles.footerText}>
            Don't have an account? 
            <Link to="/register" style={styles.link}> Create one here</Link>
          </p>
        </div>
        
        <div style={styles.infoBox}>
          <h4 style={styles.infoTitle}>ℹ️ Demo Mode</h4>
          <p style={styles.infoText}>
            This is a demo application. No real authentication is required. 
            Use any of the demo accounts above or create a new account.
          </p>
        </div>
      </div>
    </div>
  );
};

const styles = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    padding: '20px'
  },
  card: {
    backgroundColor: 'white',
    borderRadius: '16px',
    boxShadow: '0 20px 40px rgba(0,0,0,0.1)',
    padding: '40px',
    width: '100%',
    maxWidth: '500px',
    border: '1px solid #e1e5e9'
  },
  header: {
    textAlign: 'center',
    marginBottom: '30px'
  },
  title: {
    fontSize: '28px',
    fontWeight: 'bold',
    color: '#2d3748',
    margin: '0 0 8px 0'
  },
  subtitle: {
    fontSize: '16px',
    color: '#718096',
    margin: 0
  },
  form: {
    marginBottom: '20px'
  },
  formGroup: {
    marginBottom: '20px'
  },
  label: {
    display: 'block',
    fontSize: '14px',
    fontWeight: '600',
    color: '#374151',
    marginBottom: '8px'
  },
  input: {
    width: '100%',
    padding: '12px 16px',
    border: '2px solid #e2e8f0',
    borderRadius: '8px',
    fontSize: '16px',
    transition: 'border-color 0.2s',
    outline: 'none',
    boxSizing: 'border-box'
  },
  submitButton: {
    width: '100%',
    padding: '14px',
    backgroundColor: '#4f46e5',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
    marginTop: '10px'
  },
  divider: {
    textAlign: 'center',
    margin: '20px 0',
    position: 'relative'
  },
  dividerText: {
    backgroundColor: 'white',
    padding: '0 15px',
    color: '#9ca3af',
    fontSize: '12px',
    fontWeight: '600'
  },
  demoSection: {
    backgroundColor: '#f8fafc',
    padding: '20px',
    borderRadius: '12px',
    marginBottom: '20px'
  },
  demoTitle: {
    margin: '0 0 15px 0',
    fontSize: '16px',
    color: '#374151',
    textAlign: 'center'
  },
  demoGrid: {
    display: 'grid',
    gap: '12px'
  },
  demoCard: {
    backgroundColor: 'white',
    padding: '15px',
    borderRadius: '8px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    border: '1px solid #e2e8f0'
  },
  demoInfo: {
    flex: 1
  },
  demoRole: {
    fontSize: '12px',
    color: '#10b981',
    fontWeight: '600',
    textTransform: 'uppercase'
  },
  demoEmail: {
    fontSize: '13px',
    color: '#6b7280'
  },
  demoActions: {
    display: 'flex',
    gap: '8px'
  },
  fillButton: {
    padding: '6px 12px',
    backgroundColor: '#f59e0b',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    fontSize: '12px',
    cursor: 'pointer',
    fontWeight: '600'
  },
  loginButton: {
    padding: '6px 12px',
    backgroundColor: '#10b981',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    fontSize: '12px',
    cursor: 'pointer',
    fontWeight: '600'
  },
  footer: {
    textAlign: 'center',
    marginBottom: '20px'
  },
  footerText: {
    fontSize: '14px',
    color: '#6b7280',
    margin: 0
  },
  link: {
    color: '#4f46e5',
    textDecoration: 'none',
    fontWeight: '600'
  },
  infoBox: {
    backgroundColor: '#eff6ff',
    padding: '15px',
    borderRadius: '8px',
    border: '1px solid #bfdbfe'
  },
  infoTitle: {
    margin: '0 0 8px 0',
    fontSize: '14px',
    color: '#1e40af',
    fontWeight: '600'
  },
  infoText: {
    margin: 0,
    fontSize: '13px',
    color: '#1e40af',
    lineHeight: '1.4'
  }
};

export default Login;