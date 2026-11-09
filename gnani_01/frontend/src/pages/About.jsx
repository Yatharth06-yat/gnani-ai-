const About = () => {
  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>🌟 About SwachhMap</h1>
        <p style={styles.subtitle}>
          Empowering citizens to create cleaner, better communities through technology
        </p>
      </div>

      <div style={styles.content}>
        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>Our Mission</h2>
          <p style={styles.text}>
            SwachhMap is dedicated to creating a cleaner, more sustainable India by empowering 
            citizens to report and track civic issues in their communities. We believe that 
            technology can bridge the gap between citizens and local authorities, making our 
            cities more responsive and livable.
          </p>
        </div>

        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>What We Do</h2>
          <div style={styles.featureGrid}>
            <div style={styles.feature}>
              <div style={styles.featureIcon}>📱</div>
              <h3 style={styles.featureTitle}>Easy Reporting</h3>
              <p style={styles.featureText}>
                Report civic issues with just a few taps. Take a photo, add location, 
                and submit your report instantly.
              </p>
            </div>
            <div style={styles.feature}>
              <div style={styles.featureIcon}>🗺️</div>
              <h3 style={styles.featureTitle}>Interactive Maps</h3>
              <p style={styles.featureText}>
                Visualize all reported issues on interactive maps with real-time 
                status updates and progress tracking.
              </p>
            </div>
            <div style={styles.feature}>
              <div style={styles.featureIcon}>🤝</div>
              <h3 style={styles.featureTitle}>Community Engagement</h3>
              <p style={styles.featureText}>
                Connect with fellow citizens, vote on issues, and work together 
                to improve your neighborhood.
              </p>
            </div>
            <div style={styles.feature}>
              <div style={styles.featureIcon}>📊</div>
              <h3 style={styles.featureTitle}>Data-Driven Insights</h3>
              <p style={styles.featureText}>
                Provide authorities with actionable data and analytics to 
                prioritize and resolve issues efficiently.
              </p>
            </div>
          </div>
        </div>

        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>Our Impact</h2>
          <div style={styles.statsGrid}>
            <div style={styles.stat}>
              <div style={styles.statNumber}>10,000+</div>
              <div style={styles.statLabel}>Issues Reported</div>
            </div>
            <div style={styles.stat}>
              <div style={styles.statNumber}>7,500+</div>
              <div style={styles.statLabel}>Issues Resolved</div>
            </div>
            <div style={styles.stat}>
              <div style={styles.statNumber}>50+</div>
              <div style={styles.statLabel}>Cities Covered</div>
            </div>
            <div style={styles.stat}>
              <div style={styles.statNumber}>25,000+</div>
              <div style={styles.statLabel}>Active Users</div>
            </div>
          </div>
        </div>

        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>Join Our Movement</h2>
          <p style={styles.text}>
            Every report matters. Every voice counts. Join thousands of citizens who are 
            already making a difference in their communities. Together, we can build a 
            cleaner, more sustainable future for India.
          </p>
          <div style={styles.ctaSection}>
            <a href="/register" style={styles.ctaButton}>
              🚀 Get Started Today
            </a>
            <a href="/map" style={styles.ctaButtonSecondary}>
              🗺️ Explore Issues
            </a>
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
    display: 'flex',
    flexDirection: 'column',
    gap: '60px'
  },
  section: {
    textAlign: 'center'
  },
  sectionTitle: {
    fontSize: '32px',
    fontWeight: 'bold',
    color: '#2d3748',
    marginBottom: '24px'
  },
  text: {
    fontSize: '18px',
    lineHeight: '1.6',
    color: '#4a5568',
    maxWidth: '800px',
    margin: '0 auto'
  },
  featureGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
    gap: '40px',
    marginTop: '40px'
  },
  feature: {
    padding: '30px',
    backgroundColor: '#f7fafc',
    borderRadius: '16px',
    border: '1px solid #e2e8f0'
  },
  featureIcon: {
    fontSize: '48px',
    marginBottom: '16px'
  },
  featureTitle: {
    fontSize: '20px',
    fontWeight: '600',
    color: '#2d3748',
    marginBottom: '12px'
  },
  featureText: {
    fontSize: '16px',
    color: '#718096',
    lineHeight: '1.5'
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '30px',
    marginTop: '40px'
  },
  stat: {
    padding: '20px',
    backgroundColor: '#edf2f7',
    borderRadius: '12px'
  },
  statNumber: {
    fontSize: '36px',
    fontWeight: 'bold',
    color: '#10b981',
    marginBottom: '8px'
  },
  statLabel: {
    fontSize: '16px',
    color: '#4a5568'
  },
  ctaSection: {
    display: 'flex',
    gap: '20px',
    justifyContent: 'center',
    marginTop: '40px',
    flexWrap: 'wrap'
  },
  ctaButton: {
    backgroundColor: '#10b981',
    color: 'white',
    padding: '16px 32px',
    borderRadius: '12px',
    textDecoration: 'none',
    fontSize: '18px',
    fontWeight: '600',
    transition: 'all 0.2s'
  },
  ctaButtonSecondary: {
    backgroundColor: 'transparent',
    color: '#10b981',
    padding: '16px 32px',
    borderRadius: '12px',
    textDecoration: 'none',
    fontSize: '18px',
    fontWeight: '600',
    border: '2px solid #10b981',
    transition: 'all 0.2s'
  }
};

export default About;