import { useState, useEffect } from 'react';
import MapComponent from '../components/MapComponent';
import api from '../utils/api';
import { toast } from 'react-toastify';

const Map = () => {
  const [issues, setIssues] = useState([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [newIssuesCount, setNewIssuesCount] = useState(0);

  useEffect(() => {
    // Initial fetch
    fetchIssues();
    
    // Auto-refresh every 3 seconds to show new issues quickly
    const interval = setInterval(() => {
      fetchIssues(true); // Silent refresh
    }, 3000);
    
    // Also refresh when page becomes visible
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        console.log('🔄 Page visible, refreshing map');
        fetchIssues(true);
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty deps is intentional - we want this to run once on mount

  const fetchIssues = async (silent = false) => {
    try {
      const res = await api.get('/api/issues');
      console.log('🗺️ Map API response:', res.data);
      
      // Handle different response structures
      let data = [];
      if (res.data.success && Array.isArray(res.data.data)) {
        data = res.data.data;
      } else if (Array.isArray(res.data)) {
        data = res.data;
      }

      console.log('📊 Raw data count:', data.length);

      const parsed = data.map((issue, index) => {
        const parsedIssue = {
          ...issue,
          location: typeof issue.location === 'string' 
            ? JSON.parse(issue.location) 
            : issue.location || { lat: 28.6139, lng: 77.2090 }
        };
        
        // Log first 3 issues for debugging
        if (index < 3) {
          console.log(`📍 Issue ${index + 1}: ${parsedIssue.title} at`, parsedIssue.location);
        }
        
        return parsedIssue;
      });

      // Check for new issues
      if (issues.length > 0 && parsed.length > issues.length) {
        const newCount = parsed.length - issues.length;
        setNewIssuesCount(newCount);
        if (!silent) {
          toast.success(`🎉 ${newCount} new issue(s) added to map!`, {
            position: 'top-center',
            autoClose: 3000
          });
        }
      }

      setIssues(parsed);
      setLastUpdate(new Date());
      console.log('✅ Parsed issues for map:', parsed.length);
    } catch (err) {
      console.error('❌ Map fetch error:', err);
      if (!silent) {
        toast.error('Failed to fetch issues');
      }
    } finally {
      setLoading(false);
    }
  };

  const filteredIssues = filter === 'all'
    ? issues
    : issues.filter(issue => issue.status === filter);

  return (
    <div style={styles.container}>
      {/* Live Status Banner */}
      <div style={styles.liveBanner} className="live-banner-mobile">
        <div style={styles.liveIndicator}>
          <span style={styles.liveDot}></span>
          <span style={styles.liveText}>LIVE MAP</span>
        </div>
        <div style={styles.updateInfo}>
          Last updated: {lastUpdate.toLocaleTimeString()}
          {newIssuesCount > 0 && (
            <span style={styles.newBadge}>
              +{newIssuesCount} new
            </span>
          )}
        </div>
      </div>

      {/* Header */}
      <div style={styles.header}>
        <h1 style={styles.title}>🗺️ Live Issues Map</h1>
        <p style={styles.subtitle}>
          Real-time view of all reported civic issues • Auto-updates every 5 seconds
        </p>
      </div>

      {/* Stats Bar */}
      <div style={styles.statsBar}>
        <div style={styles.statCard}>
          <div style={styles.statNumber}>{issues.length}</div>
          <div style={styles.statLabel}>Total Issues</div>
        </div>
        <div style={styles.statCard}>
          <div style={{...styles.statNumber, color: '#ff4444'}}>
            {issues.filter(i => i.status === 'Reported').length}
          </div>
          <div style={styles.statLabel}>🔴 Reported</div>
        </div>
        <div style={styles.statCard}>
          <div style={{...styles.statNumber, color: '#ffaa00'}}>
            {issues.filter(i => i.status === 'In-progress').length}
          </div>
          <div style={styles.statLabel}>🟡 In Progress</div>
        </div>
        <div style={styles.statCard}>
          <div style={{...styles.statNumber, color: '#44ff44'}}>
            {issues.filter(i => i.status === 'Resolved').length}
          </div>
          <div style={styles.statLabel}>🟢 Resolved</div>
        </div>
      </div>

      {/* Controls */}
      <div style={styles.controls} className="map-controls-mobile">
        <div style={styles.filterSection}>
          <label style={styles.label}>Filter by Status:</label>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            style={styles.select}
          >
            <option value="all">All Issues ({issues.length})</option>
            <option value="Reported">🔴 Reported ({issues.filter(i => i.status === 'Reported').length})</option>
            <option value="In-progress">🟡 In Progress ({issues.filter(i => i.status === 'In-progress').length})</option>
            <option value="Resolved">🟢 Resolved ({issues.filter(i => i.status === 'Resolved').length})</option>
          </select>
        </div>
        
        <button 
          onClick={() => {
            setLoading(true);
            fetchIssues();
            toast.info('🔄 Refreshing map data...');
          }}
          style={styles.refreshButton}
        >
          🔄 Refresh Now
        </button>
      </div>

      {/* Map */}
      <div style={styles.mapWrapper}>
        {!loading && filteredIssues.length > 0 && (
          <div style={styles.mapInfo} className="map-info-mobile">
            <strong>📍 Showing {filteredIssues.length} issue(s) on map</strong>
            <span style={styles.mapHint}>Click any marker to view details</span>
          </div>
        )}
        
        {!loading && filteredIssues.length === 0 && (
          <div style={styles.emptyState}>
            <div style={styles.emptyIcon}>🗺️</div>
            <h3>No Issues Found</h3>
            <p>No issues match the selected filter. Try changing the filter or report a new issue!</p>
          </div>
        )}
        
        {!loading && filteredIssues.length > 0 && (
          <MapComponent issues={filteredIssues} />
        )}
        
        {loading && (
          <div style={styles.loadingState}>
            <div style={styles.spinner}></div>
            <p>Loading live map data...</p>
          </div>
        )}
      </div>

      {/* Instructions */}
      <div style={styles.instructions}>
        <h3 style={styles.instructionsTitle}>📖 How to Use the Live Map</h3>
        <div style={styles.instructionsGrid}>
          <div style={styles.instructionCard}>
            <div style={styles.instructionIcon}>🔴</div>
            <h4>Red Markers</h4>
            <p>Newly reported issues waiting for action</p>
          </div>
          <div style={styles.instructionCard}>
            <div style={styles.instructionIcon}>🟡</div>
            <h4>Yellow Markers</h4>
            <p>Issues currently being addressed</p>
          </div>
          <div style={styles.instructionCard}>
            <div style={styles.instructionIcon}>🟢</div>
            <h4>Green Markers</h4>
            <p>Successfully resolved issues</p>
          </div>
          <div style={styles.instructionCard}>
            <div style={styles.instructionIcon}>📍</div>
            <h4>Click Markers</h4>
            <p>View full details, location, and photos</p>
          </div>
        </div>
      </div>
    </div>
  );
};

const styles = {
  container: {
    maxWidth: '1400px',
    margin: '0 auto',
    padding: '20px'
  },
  liveBanner: {
    backgroundColor: '#1e293b',
    color: 'white',
    padding: '12px 20px',
    borderRadius: '8px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
  },
  liveIndicator: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  liveDot: {
    width: '12px',
    height: '12px',
    backgroundColor: '#10b981',
    borderRadius: '50%',
    animation: 'pulse 2s infinite'
  },
  liveText: {
    fontWeight: 'bold',
    fontSize: '14px',
    letterSpacing: '1px'
  },
  updateInfo: {
    fontSize: '14px',
    display: 'flex',
    alignItems: 'center',
    gap: '10px'
  },
  newBadge: {
    backgroundColor: '#10b981',
    padding: '4px 8px',
    borderRadius: '12px',
    fontSize: '12px',
    fontWeight: 'bold'
  },
  header: {
    textAlign: 'center',
    marginBottom: '30px'
  },
  title: {
    fontSize: '36px',
    fontWeight: 'bold',
    color: '#2d3748',
    margin: '0 0 10px 0'
  },
  subtitle: {
    fontSize: '16px',
    color: '#718096',
    margin: 0
  },
  statsBar: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
    gap: '15px',
    marginBottom: '20px'
  },
  statCard: {
    backgroundColor: '#f7fafc',
    padding: '20px',
    borderRadius: '12px',
    textAlign: 'center',
    border: '1px solid #e2e8f0'
  },
  statNumber: {
    fontSize: '32px',
    fontWeight: 'bold',
    color: '#2d3748',
    marginBottom: '5px'
  },
  statLabel: {
    fontSize: '14px',
    color: '#718096'
  },
  controls: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
    padding: '15px',
    backgroundColor: 'white',
    borderRadius: '8px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
  },
  filterSection: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px'
  },
  label: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#374151'
  },
  select: {
    padding: '8px 12px',
    border: '2px solid #e2e8f0',
    borderRadius: '6px',
    fontSize: '14px',
    outline: 'none'
  },
  refreshButton: {
    padding: '10px 20px',
    backgroundColor: '#10b981',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s'
  },
  mapWrapper: {
    backgroundColor: 'white',
    borderRadius: '12px',
    padding: '20px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
    marginBottom: '30px',
    minHeight: '500px'
  },
  mapInfo: {
    backgroundColor: '#eff6ff',
    padding: '12px 16px',
    borderRadius: '8px',
    marginBottom: '15px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    border: '1px solid #bfdbfe'
  },
  mapHint: {
    fontSize: '13px',
    color: '#1e40af'
  },
  emptyState: {
    textAlign: 'center',
    padding: '60px 20px',
    color: '#718096'
  },
  emptyIcon: {
    fontSize: '64px',
    marginBottom: '20px'
  },
  loadingState: {
    textAlign: 'center',
    padding: '60px 20px'
  },
  spinner: {
    width: '40px',
    height: '40px',
    border: '4px solid #e2e8f0',
    borderTop: '4px solid #10b981',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
    margin: '0 auto 20px'
  },
  instructions: {
    backgroundColor: 'white',
    padding: '30px',
    borderRadius: '12px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
  },
  instructionsTitle: {
    fontSize: '24px',
    fontWeight: 'bold',
    color: '#2d3748',
    marginBottom: '20px',
    textAlign: 'center'
  },
  instructionsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '20px'
  },
  instructionCard: {
    textAlign: 'center',
    padding: '20px',
    backgroundColor: '#f7fafc',
    borderRadius: '8px'
  },
  instructionIcon: {
    fontSize: '32px',
    marginBottom: '10px'
  }
};

// Add CSS animations and mobile responsiveness
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = `
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }

    @media (max-width: 768px) {
      .map-controls-mobile {
        flex-direction: column !important;
        align-items: stretch !important;
        gap: 12px !important;
      }
      .map-controls-mobile select,
      .map-controls-mobile button {
        width: 100% !important;
      }
      .map-info-mobile {
        flex-direction: column !important;
        align-items: flex-start !important;
        gap: 6px !important;
      }
      .live-banner-mobile {
        flex-direction: column !important;
        gap: 8px !important;
        align-items: flex-start !important;
      }
    }
  `;
  document.head.appendChild(style);
}

export default Map;
