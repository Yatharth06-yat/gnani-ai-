import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useAuth } from '../context/AuthContext';

const Register = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'citizen'
  });
  const [loading, setLoading] = useState(false);

  const { register } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (formData.password !== formData.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    if (formData.password.length < 3) {
      toast.error('Password must be at least 3 characters long');
      return;
    }

    if (!formData.name.trim()) {
      toast.error('Please enter your full name');
      return;
    }

    setLoading(true);

    try {
      const result = await register(
        formData.name,
        formData.email,
        formData.password,
        formData.role
      );

      if (result.success) {
        toast.success('🎉 Registration successful! Welcome to SwachhMap!');
        navigate('/');
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      toast.error('Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const fillDemoData = () => {
    setFormData({
      name: 'New User',
      email: 'newuser@example.com',
      password: 'demo123',
      confirmPassword: 'demo123',
      role: 'citizen'
    });
    toast.info('Demo data filled! You can modify and submit.');
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.header}>
          <h2 style={styles.title}>📝 Join SwachhMap</h2>
          <p style={styles.subtitle}>Create your account and start making a difference</p>
        </div>

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.formGroup}>
            <label style={styles.label}>Full Name *</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              placeholder="Enter your full name"
              style={styles.input}
              autoComplete="name"
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Email Address *</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              placeholder="Enter your email address"
              style={styles.input}
              autoComplete="username"
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Password * (min 3 characters)</label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              required
              placeholder="Create a password"
              style={styles.input}
              autoComplete="new-password"
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Confirm Password *</label>
            <input
              type="password"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              required
              placeholder="Confirm your password"
              style={styles.input}
              autoComplete="new-password"
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Account Type</label>
            <select
              name="role"
              value={formData.role}
              onChange={handleChange}
              style={styles.select}
            >
              <option value="citizen">👤 Citizen - Report civic issues</option>
              <option value="admin">👨‍💼 Admin - Manage all issues</option>
              <option value="official">🏛️ Official - Handle assigned issues</option>
            </select>
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
            {loading ? '🔄 Creating Account...' : '🚀 Create Account'}
          </button>
        </form>

        <div style={styles.divider}>
          <span style={styles.dividerText}>OR</span>
        </div>

        <div style={styles.demoSection}>
          <button
            type="button"
            onClick={fillDemoData}
            style={styles.demoButton}
            disabled={loading}
          >
            🎯 Fill Demo Data
          </button>
        </div>

        <div style={styles.footer}>
          <p style={styles.footerText}>
            Already have an account? 
            <Link to="/login" style={styles.link}> Sign in here</Link>
          </p>
        </div>

        <div style={styles.infoBox}>
          <h4 style={styles.infoTitle}>ℹ️ Demo Mode</h4>
          <p style={styles.infoText}>
            This is a demo application. You can create any account with any email. 
            No real email verification is required.
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
    maxWidth: '450px',
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
  select: {
    width: '100%',
    padding: '12px 16px',
    border: '2px solid #e2e8f0',
    borderRadius: '8px',
    fontSize: '16px',
    backgroundColor: 'white',
    outline: 'none',
    boxSizing: 'border-box'
  },
  submitButton: {
    width: '100%',
    padding: '14px',
    backgroundColor: '#10b981',
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
    fontSize: '14px'
  },
  demoSection: {
    textAlign: 'center',
    marginBottom: '20px'
  },
  demoButton: {
    padding: '12px 24px',
    backgroundColor: '#f59e0b',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
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

export default Register;
