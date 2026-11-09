import { useState } from 'react';
import { toast } from 'react-toastify';

const Contact = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: ''
  });
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    // Simulate form submission
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    toast.success('🎉 Message sent successfully! We\'ll get back to you soon.');
    setFormData({ name: '', email: '', subject: '', message: '' });
    setLoading(false);
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>📞 Contact Us</h1>
        <p style={styles.subtitle}>
          Have questions, suggestions, or need help? We'd love to hear from you!
        </p>
      </div>

      <div style={styles.content}>
        {/* Contact Form */}
        <div style={styles.formSection}>
          <h2 style={styles.sectionTitle}>Send us a Message</h2>
          <form onSubmit={handleSubmit} style={styles.form}>
            <div style={styles.formRow}>
              <div style={styles.formGroup}>
                <label style={styles.label}>Your Name *</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  placeholder="Enter your full name"
                  style={styles.input}
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
                  placeholder="Enter your email"
                  style={styles.input}
                />
              </div>
            </div>
            
            <div style={styles.formGroup}>
              <label style={styles.label}>Subject *</label>
              <input
                type="text"
                name="subject"
                value={formData.subject}
                onChange={handleChange}
                required
                placeholder="What's this about?"
                style={styles.input}
              />
            </div>
            
            <div style={styles.formGroup}>
              <label style={styles.label}>Message *</label>
              <textarea
                name="message"
                value={formData.message}
                onChange={handleChange}
                required
                placeholder="Tell us more about your inquiry..."
                style={styles.textarea}
                rows="6"
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
              {loading ? '📤 Sending...' : '🚀 Send Message'}
            </button>
          </form>
        </div>

        {/* Contact Information */}
        <div style={styles.infoSection}>
          <h2 style={styles.sectionTitle}>Get in Touch</h2>
          
          <div style={styles.contactCards}>
            <div style={styles.contactCard}>
              <div style={styles.contactIcon}>📧</div>
              <h3 style={styles.contactTitle}>Email Us</h3>
              <p style={styles.contactText}>support@swachhmap.com</p>
              <p style={styles.contactSubtext}>We typically respond within 24 hours</p>
            </div>
            
            <div style={styles.contactCard}>
              <div style={styles.contactIcon}>📞</div>
              <h3 style={styles.contactTitle}>Call Us</h3>
              <p style={styles.contactText}>+91 98765 43210</p>
              <p style={styles.contactSubtext}>Mon-Fri, 9 AM - 6 PM IST</p>
            </div>
            
            <div style={styles.contactCard}>
              <div style={styles.contactIcon}>📍</div>
              <h3 style={styles.contactTitle}>Visit Us</h3>
              <p style={styles.contactText}>New Delhi, India</p>
              <p style={styles.contactSubtext}>By appointment only</p>
            </div>
            
            <div style={styles.contactCard}>
              <div style={styles.contactIcon}>💬</div>
              <h3 style={styles.contactTitle}>Live Chat</h3>
              <p style={styles.contactText}>Available 24/7</p>
              <p style={styles.contactSubtext}>Click the chat icon below</p>
            </div>
          </div>

          <div style={styles.faqSection}>
            <h3 style={styles.faqTitle}>Frequently Asked Questions</h3>
            <div style={styles.faqList}>
              <div style={styles.faqItem}>
                <strong>How do I report an issue?</strong>
                <p>Simply click on "Report Issue" in the navigation, fill out the form with details and location, and submit!</p>
              </div>
              <div style={styles.faqItem}>
                <strong>Is SwachhMap free to use?</strong>
                <p>Yes! SwachhMap is completely free for all citizens to report and track civic issues.</p>
              </div>
              <div style={styles.faqItem}>
                <strong>How long does it take to resolve issues?</strong>
                <p>Resolution time varies by issue type and local authority response. You can track progress on the map.</p>
              </div>
              <div style={styles.faqItem}>
                <strong>Can I report issues anonymously?</strong>
                <p>While we encourage users to create accounts for better tracking, anonymous reporting may be available in some areas.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const styles = {
  container: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '40px 20px'
  },
  header: {
    textAlign: 'center',
    marginBottom: '60px'
  },
  title: {
    fontSize: '48px',
    fontWeight: 'bold',
    color: '#2d3748',
    margin: '0 0 16px 0'
  },
  subtitle: {
    fontSize: '20px',
    color: '#718096',
    maxWidth: '600px',
    margin: '0 auto'
  },
  content: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '60px',
    alignItems: 'start'
  },
  formSection: {
    backgroundColor: '#f7fafc',
    padding: '40px',
    borderRadius: '16px',
    border: '1px solid #e2e8f0'
  },
  infoSection: {
    padding: '20px'
  },
  sectionTitle: {
    fontSize: '28px',
    fontWeight: 'bold',
    color: '#2d3748',
    marginBottom: '30px',
    textAlign: 'center'
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px'
  },
  formRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '20px'
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column'
  },
  label: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#374151',
    marginBottom: '8px'
  },
  input: {
    padding: '12px 16px',
    border: '2px solid #e2e8f0',
    borderRadius: '8px',
    fontSize: '16px',
    transition: 'border-color 0.2s',
    outline: 'none'
  },
  textarea: {
    padding: '12px 16px',
    border: '2px solid #e2e8f0',
    borderRadius: '8px',
    fontSize: '16px',
    transition: 'border-color 0.2s',
    outline: 'none',
    resize: 'vertical',
    fontFamily: 'inherit'
  },
  submitButton: {
    padding: '16px 32px',
    backgroundColor: '#10b981',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s',
    marginTop: '10px'
  },
  contactCards: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '20px',
    marginBottom: '40px'
  },
  contactCard: {
    padding: '24px',
    backgroundColor: '#f7fafc',
    borderRadius: '12px',
    textAlign: 'center',
    border: '1px solid #e2e8f0'
  },
  contactIcon: {
    fontSize: '32px',
    marginBottom: '12px'
  },
  contactTitle: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#2d3748',
    marginBottom: '8px'
  },
  contactText: {
    fontSize: '16px',
    color: '#4a5568',
    fontWeight: '500',
    marginBottom: '4px'
  },
  contactSubtext: {
    fontSize: '14px',
    color: '#718096'
  },
  faqSection: {
    marginTop: '40px'
  },
  faqTitle: {
    fontSize: '20px',
    fontWeight: '600',
    color: '#2d3748',
    marginBottom: '20px'
  },
  faqList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px'
  },
  faqItem: {
    padding: '16px',
    backgroundColor: '#edf2f7',
    borderRadius: '8px'
  }
};

// Responsive styles
const mediaQuery = window.matchMedia('(max-width: 768px)');
if (mediaQuery.matches) {
  styles.content.gridTemplateColumns = '1fr';
  styles.formRow.gridTemplateColumns = '1fr';
  styles.contactCards.gridTemplateColumns = '1fr';
}

export default Contact;