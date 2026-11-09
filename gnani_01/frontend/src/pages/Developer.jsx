import { useState } from 'react';
import { toast } from 'react-toastify';
import '../styles/developer.css';
import yg from "../styles/yg.jpeg"
const Developer = () => {
  const [showContact, setShowContact] = useState(false);

  const handleContactClick = (method, value) => {
    if (method === 'email') {
      window.location.href = `mailto:${value}`;
      toast.success('📧 Opening email client...');
    } else if (method === 'phone') {
      navigator.clipboard.writeText(value);
      toast.success('📞 Phone number copied to clipboard!');
    } else if (method === 'linkedin') {
      window.open(value, '_blank');
      toast.success(' Opening LinkedIn profile...');
    } else if (method === 'github') {
      window.open(value, '_blank');
      toast.success('Opening GitHub profile...');
    }
  };

  return (
    <div style={styles.container}>
      {/* Hero Section */}
      <div style={styles.hero}>
        <div style={styles.heroContent}>
          <div style={styles.imageContainer}>
            <div style={styles.profileImage}>
                <img
    src={yg}
    alt=""
    style={{
      width: '170px',
      height: '170px',
      borderRadius: '50%',
      objectFit: 'cover',
      border: '2px solid #ddd'
    }}
  />
              <div style={styles.statusBadge}>
                <span style={styles.statusDot}></span>
                Available for Projects
              </div>
            </div>
          </div>

          <div style={styles.heroText}>
            <h1 style={styles.name}>Yatharth Gupta</h1>
            <h2 style={styles.title}>mern Stack Developer & SwachhMap Creator</h2>
            <p style={styles.tagline}>
              Passionate about creating technology solutions that make a positive impact on society
            </p>

            <div style={styles.heroButtons}>
              <button
                onClick={() => setShowContact(!showContact)}
                style={styles.primaryButton}
              >
                {showContact ? ' Hide Contact' : ' Get in Touch'}
              </button>
              <button
                onClick={() => handleContactClick('github', 'https://github.com/Yatharth06-yat')}
                style={styles.secondaryButton}
              >
                View GitHub
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Contact Section */}
      {showContact && (
        <div style={styles.contactSection}>
          <h3 style={styles.contactTitle}>📞 Let's Connect</h3>
          <div style={styles.contactGrid}>
            <div
              style={styles.contactCard}
              onClick={() => handleContactClick('email', 'guptayatharth353@gmail.com')}
            >
              <div style={styles.contactIcon}></div>
              <div style={styles.contactInfo}>
                <h4>Email</h4>
                <p>guptayatharth353@gmail.com</p>
              </div>
            </div>

            <div
              style={styles.contactCard}
              onClick={() => handleContactClick('phone', '+91-799117324')}
            >
              <div style={styles.contactIcon}>📱</div>
              <div style={styles.contactInfo}>
                <h4>Phone</h4>
                <p>Available on Request</p>
              </div>
            </div>

            <div
              style={styles.contactCard}
              onClick={() => handleContactClick('linkedin', 'https://linkedin.com/in/yatharth-gupta-525b40306')}
            >
              <div style={styles.contactIcon}>💼</div>
              <div style={styles.contactInfo}>
                <h4>LinkedIn</h4>
                <p>Professional Network</p>
              </div>
            </div>

            <div
              style={styles.contactCard}
              onClick={() => handleContactClick('github', 'https://github.com/Yatharth06-yat')}
            >
              <div style={styles.contactIcon}></div>
              <div style={styles.contactInfo}>
                <h4>GitHub</h4>
                <p>Code Repository</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* About Section */}
      <div style={styles.aboutSection}>
        <h2 style={styles.sectionTitle}>About the Developer</h2>
        <div style={styles.aboutContent}>
          <div style={styles.aboutText}>
            <p style={styles.paragraph}>
              Hi! I'm <strong>Yatharth Gupta</strong>, a passionate full-stack developer with a mission to create
              technology solutions that address real-world problems. SwachhMap is one of my projects aimed at
              improving civic infrastructure through citizen engagement.
            </p>
            <p style={styles.paragraph}>
              I believe in the power of technology to bridge the gap between citizens and local authorities,
              making our communities more responsive, transparent, and livable. Every line of code I write
              is driven by the desire to make a positive impact on society.
            </p>
            <p style={styles.paragraph}>
              When I'm not coding, you can find me exploring new technologies, contributing to open-source
              projects, or thinking about innovative solutions to everyday problems.
            </p>
          </div>

          <div style={styles.skillsSection}>
            <h3 style={styles.skillsTitle}>🛠️ Technical Skills</h3>
            <div style={styles.skillsGrid}>
              <div style={styles.skillCategory}>
                <h4 style={styles.categoryTitle}>Frontend</h4>
                <div style={styles.skillTags}>
                  <span style={styles.skillTag}>React.js</span>
                  <span style={styles.skillTag}>JavaScript</span>
                  <span style={styles.skillTag}>HTML5</span>
                  <span style={styles.skillTag}>CSS3</span>
                  <span style={styles.skillTag}>TypeScript</span>
                </div>
              </div>

              <div style={styles.skillCategory}>
                <h4 style={styles.categoryTitle}>Backend</h4>
                <div style={styles.skillTags}>
                  <span style={styles.skillTag}>Node.js</span>
                  <span style={styles.skillTag}>Express.js</span>
                  <span style={styles.skillTag}>MongoDB</span>
                  <span style={styles.skillTag}>REST APIs</span>
                  <span style={styles.skillTag}>JWT</span>
                </div>
              </div>


            </div>
          </div>
        </div>
      </div>

      {/* Project Showcase */}
      <div style={styles.projectSection}>
        <h2 style={styles.sectionTitle}>SwachhMap Project</h2>
        <div style={styles.projectCard}>
          <div style={styles.projectHeader}>
            <h3 style={styles.projectTitle}>SwachhMap - Civic Issue Reporting Platform</h3>
            <div style={styles.projectStatus}>
              <span style={styles.statusBadgeProject}>Active Development</span>
            </div>
          </div>

          <p style={styles.projectDescription}>
            A comprehensive web application that empowers citizens to report civic issues like garbage overflow,
            potholes, sanitation problems, and infrastructure damage. The platform features real-time issue tracking,
            interactive maps, and seamless communication between citizens and local authorities.
          </p>

          <div style={styles.projectFeatures}>
            <h4 style={styles.featuresTitle}>Key Features:</h4>
            <div style={styles.featuresList}>
              <div style={styles.feature}> Easy issue reporting with photo upload</div>
              <div style={styles.feature}> Interactive map visualization</div>
              <div style={styles.feature}> User authentication and role management</div>
              <div style={styles.feature}>Admin dashboard with analytics</div>
              <div style={styles.feature}>Real-time status updates</div>
              <div style={styles.feature}>Notification system</div>
            </div>
          </div>

          <div style={styles.techStack}>
            <h4 style={styles.techTitle}>Technology Stack:</h4>
            <div style={styles.techTags}>
              <span style={styles.techTag}>React.js</span>
              <span style={styles.techTag}>Node.js</span>
              <span style={styles.techTag}>Express.js</span>
              <span style={styles.techTag}>MongoDB</span>
              <span style={styles.techTag}>JWT Auth</span>
              <span style={styles.techTag}>Leaflet Maps</span>
              <span style={styles.techTag}>Cloudinary</span>
            </div>
          </div>
        </div>
      </div>

      {/* Call to Action */}
      <div style={styles.ctaSection}>
        <h2 style={styles.ctaTitle}>🤝 Let's Build Something Amazing Together</h2>
        <p style={styles.ctaText}>
          Interested in collaborating on projects that make a difference?
          Have an idea for a civic tech solution? Let's connect and create something impactful!
        </p>
        <div style={styles.ctaButtons}>
          <button
            onClick={() => handleContactClick('email', 'guptayatharth353@gmail.com')}
            style={styles.ctaPrimary}
          >
            📧 Start a Conversation
          </button>
          <button
            onClick={() => handleContactClick('github', 'https://github.com/')}
            style={styles.ctaSecondary}
          >
            Explore My Work
          </button>
        </div>
      </div>
    </div>
  );
};

const styles = {
  container: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '0 20px'
  },
  hero: {
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    borderRadius: '20px',
    padding: '60px 40px',
    margin: '40px 0',
    color: 'white',
    textAlign: 'center'
  },
  heroContent: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '30px'
  },
  imageContainer: {
    position: 'relative'
  },
  profileImage: {
    position: 'relative',
    display: 'inline-block'
  },
  imagePlaceholder: {
    width: '150px',
    height: '150px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '4px solid white',
    boxShadow: '0 10px 30px rgba(0,0,0,0.2)'
  },
  initials: {
    fontSize: '48px',
    fontWeight: 'bold',
    color: 'white'
  },
  statusBadge: {
    position: 'absolute',
    bottom: '10px',
    right: '-10px',
    backgroundColor: '#10b981',
    color: 'white',
    padding: '6px 12px',
    borderRadius: '20px',
    fontSize: '12px',
    fontWeight: '600',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
  },
  statusDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    backgroundColor: '#34d399',
    animation: 'pulse 2s infinite'
  },
  heroText: {
    textAlign: 'center'
  },
  name: {
    fontSize: '48px',
    fontWeight: 'bold',
    margin: '0 0 10px 0',
    textShadow: '2px 2px 4px rgba(0,0,0,0.3)'
  },
  title: {
    fontSize: '24px',
    fontWeight: '300',
    margin: '0 0 20px 0',
    opacity: 0.9
  },
  tagline: {
    fontSize: '18px',
    maxWidth: '600px',
    margin: '0 auto 30px auto',
    lineHeight: '1.6',
    opacity: 0.9
  },
  heroButtons: {
    display: 'flex',
    gap: '20px',
    justifyContent: 'center',
    flexWrap: 'wrap'
  },
  primaryButton: {
    backgroundColor: 'white',
    color: '#4f46e5',
    padding: '15px 30px',
    border: 'none',
    borderRadius: '12px',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s',
    boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    color: 'white',
    padding: '15px 30px',
    border: '2px solid white',
    borderRadius: '12px',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s'
  },
  contactSection: {
    backgroundColor: '#f8fafc',
    padding: '40px',
    borderRadius: '16px',
    margin: '40px 0',
    border: '1px solid #e2e8f0'
  },
  contactTitle: {
    fontSize: '28px',
    fontWeight: 'bold',
    color: '#2d3748',
    textAlign: 'center',
    marginBottom: '30px'
  },
  contactGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
    gap: '20px'
  },
  contactCard: {
    backgroundColor: 'white',
    padding: '24px',
    borderRadius: '12px',
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    cursor: 'pointer',
    transition: 'all 0.2s',
    border: '1px solid #e2e8f0',
    boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
  },
  contactIcon: {
    fontSize: '32px',
    minWidth: '40px'
  },
  contactInfo: {
    flex: 1
  },
  aboutSection: {
    padding: '60px 0'
  },
  sectionTitle: {
    fontSize: '36px',
    fontWeight: 'bold',
    color: '#2d3748',
    textAlign: 'center',
    marginBottom: '40px'
  },
  aboutContent: {
    display: 'grid',
    gridTemplateColumns: '2fr 1fr',
    gap: '60px',
    alignItems: 'start'
  },
  aboutText: {
    fontSize: '18px',
    lineHeight: '1.7',
    color: '#4a5568'
  },
  paragraph: {
    marginBottom: '20px'
  },
  skillsSection: {
    backgroundColor: '#f7fafc',
    padding: '30px',
    borderRadius: '16px',
    border: '1px solid #e2e8f0'
  },
  skillsTitle: {
    fontSize: '24px',
    fontWeight: 'bold',
    color: '#2d3748',
    marginBottom: '20px'
  },
  skillsGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px'
  },
  skillCategory: {
    marginBottom: '10px'
  },
  categoryTitle: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#4a5568',
    marginBottom: '10px'
  },
  skillTags: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px'
  },
  skillTag: {
    backgroundColor: '#e2e8f0',
    color: '#4a5568',
    padding: '6px 12px',
    borderRadius: '20px',
    fontSize: '14px',
    fontWeight: '500'
  },
  projectSection: {
    padding: '60px 0',
    backgroundColor: '#f8fafc',
    margin: '60px -20px',
    paddingLeft: '20px',
    paddingRight: '20px'
  },
  projectCard: {
    backgroundColor: 'white',
    padding: '40px',
    borderRadius: '16px',
    border: '1px solid #e2e8f0',
    boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
  },
  projectHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
    flexWrap: 'wrap',
    gap: '10px'
  },
  projectTitle: {
    fontSize: '28px',
    fontWeight: 'bold',
    color: '#2d3748',
    margin: 0
  },
  projectStatus: {
    display: 'flex',
    alignItems: 'center'
  },
  statusBadgeProject: {
    backgroundColor: '#10b981',
    color: 'white',
    padding: '6px 12px',
    borderRadius: '20px',
    fontSize: '14px',
    fontWeight: '600'
  },
  projectDescription: {
    fontSize: '18px',
    lineHeight: '1.6',
    color: '#4a5568',
    marginBottom: '30px'
  },
  projectFeatures: {
    marginBottom: '30px'
  },
  featuresTitle: {
    fontSize: '20px',
    fontWeight: '600',
    color: '#2d3748',
    marginBottom: '15px'
  },
  featuresList: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: '10px'
  },
  feature: {
    fontSize: '16px',
    color: '#4a5568',
    padding: '8px 0'
  },
  techStack: {
    marginTop: '30px'
  },
  techTitle: {
    fontSize: '20px',
    fontWeight: '600',
    color: '#2d3748',
    marginBottom: '15px'
  },
  techTags: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '10px'
  },
  techTag: {
    backgroundColor: '#4f46e5',
    color: 'white',
    padding: '8px 16px',
    borderRadius: '20px',
    fontSize: '14px',
    fontWeight: '500'
  },
  ctaSection: {
    textAlign: 'center',
    padding: '60px 40px',
    backgroundColor: '#1f2937',
    color: 'white',
    borderRadius: '20px',
    margin: '60px 0'
  },
  ctaTitle: {
    fontSize: '36px',
    fontWeight: 'bold',
    marginBottom: '20px'
  },
  ctaText: {
    fontSize: '18px',
    lineHeight: '1.6',
    maxWidth: '600px',
    margin: '0 auto 30px auto',
    opacity: 0.9
  },
  ctaButtons: {
    display: 'flex',
    gap: '20px',
    justifyContent: 'center',
    flexWrap: 'wrap'
  },
  ctaPrimary: {
    backgroundColor: '#10b981',
    color: 'white',
    padding: '15px 30px',
    border: 'none',
    borderRadius: '12px',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s'
  },
  ctaSecondary: {
    backgroundColor: 'transparent',
    color: 'white',
    padding: '15px 30px',
    border: '2px solid white',
    borderRadius: '12px',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s'
  }
};

// Add responsive styles
const mediaQuery = window.matchMedia('(max-width: 768px)');
if (mediaQuery.matches) {
  styles.aboutContent.gridTemplateColumns = '1fr';
  styles.heroContent.flexDirection = 'column';
  styles.name.fontSize = '36px';
  styles.projectHeader.flexDirection = 'column';
  styles.projectHeader.alignItems = 'flex-start';
}

export default Developer;