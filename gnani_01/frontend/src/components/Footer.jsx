import { Link } from 'react-router-dom';

const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer style={styles.footer}>
      <div style={styles.container}>
        {/* Main Footer Content */}
        <div style={styles.mainContent}>
          <div style={styles.brandSection}>
            <div style={styles.logo}>
              🗺️ SwachhMap
            </div>
            <p style={styles.brandDescription}>
              Making our cities cleaner, one report at a time. Join the community 
              of citizens working together to improve civic infrastructure and sanitation.
            </p>
          </div>

          {/* Quick Links */}
          <div style={styles.linkSection}>
            <h4 style={styles.sectionTitle}>Quick Links</h4>
            <div style={styles.linkList}>
              <Link to="/" style={styles.footerLink}>🏠 Home</Link>
              <Link to="/map" style={styles.footerLink}>🗺️ Issue Map</Link>
              <Link to="/report" style={styles.footerLink}>📝 Report Issue</Link>
              <Link to="/login" style={styles.footerLink}>🔐 Login</Link>
              <Link to="/register" style={styles.footerLink}>📝 Register</Link>
            </div>
          </div>

          {/* Categories */}
          <div style={styles.linkSection}>
            <h4 style={styles.sectionTitle}>Issue Categories</h4>
            <div style={styles.linkList}>
              <span style={styles.categoryItem}>🗑️ Garbage & Waste</span>
              <span style={styles.categoryItem}>🕳️ Potholes & Roads</span>
              <span style={styles.categoryItem}>💧 Water & Drainage</span>
              <span style={styles.categoryItem}>🚿 Sanitation</span>
              <span style={styles.categoryItem}>💡 Street Lighting</span>
            </div>
          </div>

          {/* Contact Info */}
          <div style={styles.linkSection}>
            <h4 style={styles.sectionTitle}>Get in Touch</h4>
            <div style={styles.contactInfo}>
              <div style={styles.contactItem}>
                <span style={styles.contactIcon}>📧</span>
                <span style={styles.contactText}>guptayatharth@swachhmap.com</span>
              </div>
              <div style={styles.contactItem}>
                <span style={styles.contactIcon}>📞</span>
                <span style={styles.contactText}>+91 7999117324</span>
              </div>
              <div style={styles.contactItem}>
                <span style={styles.contactIcon}>📍</span>
                <span style={styles.contactText}>Gwalior, India</span>
              </div>
              <div style={styles.contactItem}>
                <span style={styles.contactIcon}>🕒</span>
                <span style={styles.contactText}>24/7 Support</span>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Section */}
        <div style={styles.statsSection}>
          <div style={styles.stat}>
            <div style={styles.statNumber}>6</div>
            <div style={styles.statLabel}>Issues Reported</div>
          </div>
          <div style={styles.stat}>
            <div style={styles.statNumber}>3</div>
            <div style={styles.statLabel}>Issues Resolved</div>
          </div>
          <div style={styles.stat}>
            <div style={styles.statNumber}>5</div>
            <div style={styles.statLabel}>Active Citizens</div>
          </div>
          <div style={styles.stat}>
            <div style={styles.statNumber}>45</div>
            <div style={styles.statLabel}>Cities Covered</div>
          </div>
        </div>

        {/* Bottom Section */}
        <div style={styles.bottomSection}>
          <div style={styles.bottomLeft}>
            <p style={styles.copyright}>
              © {currentYear} SwachhMap. All rights reserved. Made with ❤️ for a cleaner India.
            </p>
          </div>
          <div style={styles.bottomRight}>
            <Link to="/privacy" style={styles.bottomLink}>Privacy Policy</Link>
            <span style={styles.separator}>•</span>
            <Link to="/terms" style={styles.bottomLink}>Terms of Service</Link>
            <span style={styles.separator}>•</span>
            <Link to="/about" style={styles.bottomLink}>About Us</Link>
            <span style={styles.separator}>•</span>
            <Link to="/contact" style={styles.bottomLink}>Contact</Link>
            <span style={styles.separator}>•</span>
            <Link to="/developer" style={styles.developerLink}>👨‍💻 Developer</Link>
          </div>
        </div>
      </div>
    </footer>
  );
};

const styles = {
  footer: {
    backgroundColor: '#1f2937',
    color: '#f9fafb',
    marginTop: 'auto'
  },
  container: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '60px 20px 20px'
  },
  mainContent: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
    gap: '40px',
    marginBottom: '40px'
  },
  brandSection: {
    maxWidth: '300px'
  },
  logo: {
    fontSize: '28px',
    fontWeight: 'bold',
    color: '#10b981',
    marginBottom: '16px'
  },
  brandDescription: {
    fontSize: '14px',
    lineHeight: '1.6',
    color: '#d1d5db',
    marginBottom: '20px'
  },
  socialLinks: {
    display: 'flex',
    gap: '12px'
  },
  socialLink: {
    display: 'inline-block',
    fontSize: '20px',
    padding: '8px',
    borderRadius: '8px',
    backgroundColor: '#374151',
    textDecoration: 'none',
    transition: 'all 0.2s',
    cursor: 'pointer'
  },
  linkSection: {
    minWidth: '200px'
  },
  sectionTitle: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#f9fafb',
    marginBottom: '16px',
    margin: '0 0 16px 0'
  },
  linkList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  },
  footerLink: {
    color: '#d1d5db',
    textDecoration: 'none',
    fontSize: '14px',
    transition: 'color 0.2s',
    padding: '4px 0'
  },
  categoryItem: {
    color: '#d1d5db',
    fontSize: '14px',
    padding: '4px 0',
    display: 'block'
  },
  contactInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },
  contactItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  contactIcon: {
    fontSize: '16px',
    width: '20px'
  },
  contactText: {
    fontSize: '14px',
    color: '#d1d5db'
  },
  statsSection: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
    gap: '20px',
    padding: '30px 0',
    borderTop: '1px solid #374151',
    borderBottom: '1px solid #374151',
    marginBottom: '30px'
  },
  stat: {
    textAlign: 'center'
  },
  statNumber: {
    fontSize: '32px',
    fontWeight: 'bold',
    color: '#10b981',
    marginBottom: '4px'
  },
  statLabel: {
    fontSize: '14px',
    color: '#9ca3af'
  },
  bottomSection: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '20px',
    paddingBottom: '20px'
  },
  bottomLeft: {
    flex: 1
  },
  copyright: {
    fontSize: '14px',
    color: '#9ca3af',
    margin: 0
  },
  bottomRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap'
  },
  bottomLink: {
    color: '#d1d5db',
    textDecoration: 'none',
    fontSize: '14px',
    transition: 'color 0.2s'
  },
  developerLink: {
    color: '#10b981',
    textDecoration: 'none',
    fontSize: '14px',
    fontWeight: '600',
    transition: 'color 0.2s',
    backgroundColor: '#065f46',
    padding: '4px 8px',
    borderRadius: '4px'
  },
  separator: {
    color: '#6b7280',
    fontSize: '14px'
  },
  demoBadge: {
    textAlign: 'center',
    padding: '12px',
    backgroundColor: '#065f46',
    borderRadius: '8px',
    marginTop: '20px'
  },
  demoText: {
    fontSize: '14px',
    color: '#d1fae5',
    fontWeight: '600'
  }
};

// Add hover effects
if (typeof window !== 'undefined') {
  const addHoverStyles = () => {
    const style = document.createElement('style');
    style.textContent = `
      .footer-link:hover { color: #10b981 !important; }
      .social-link:hover { background-color: #10b981 !important; transform: translateY(-2px); }
      .bottom-link:hover { color: #10b981 !important; }
    `;
    document.head.appendChild(style);
  };
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', addHoverStyles);
  } else {
    addHoverStyles();
  }
}

export default Footer;