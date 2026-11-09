import React, { useState, useEffect } from 'react';
import api from '../utils/api';

const AIIntelligenceCenter = ({ issues, onVerifyClick, onSelectLocation }) => {
  const [activeTab, setActiveTab] = useState('prioritization'); // 'prioritization' | 'duplicates' | 'hotspots' | 'models'
  const [hotspotData, setHotspotData] = useState(null);
  const [hotspotFilter, setHotspotFilter] = useState('all');

  useEffect(() => {
    fetchHotspots();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hotspotFilter]);

  const fetchHotspots = async () => {
    try {
      const res = await api.get(`/api/analytics/hotspots?timeRange=${hotspotFilter}`);
      if (res.data.success) {
        setHotspotData(res.data.data);
      }
    } catch (e) {
      console.warn('Hotspot fetch error:', e);
    }
  };

  // Duplicate candidates across all issues
  const duplicateIssues = issues.filter(i => i.duplicateInfo?.isSuspectedDuplicate);

  // Sorted issues by explainable priority score
  const prioritySortedIssues = [...issues].sort((a, b) => {
    const scoreA = a.priorityExplanation?.score || (a.priority === 'Critical' ? 90 : (a.priority === 'High' ? 75 : 50));
    const scoreB = b.priorityExplanation?.score || (b.priority === 'Critical' ? 90 : (b.priority === 'High' ? 75 : 50));
    return scoreB - scoreA;
  });

  return (
    <div style={styles.container}>
      {/* Sub-tabs header */}
      <div style={styles.tabBar}>
        <button
          onClick={() => setActiveTab('prioritization')}
          style={{ ...styles.tabBtn, borderBottom: activeTab === 'prioritization' ? '3px solid #2e7d32' : 'none' }}
        >
          ⚖️ Explainable Priority Queue ({issues.length})
        </button>
        <button
          onClick={() => setActiveTab('duplicates')}
          style={{ ...styles.tabBtn, borderBottom: activeTab === 'duplicates' ? '3px solid #2e7d32' : 'none' }}
        >
          🔍 Potential Duplicates ({duplicateIssues.length})
        </button>
        <button
          onClick={() => setActiveTab('hotspots')}
          style={{ ...styles.tabBtn, borderBottom: activeTab === 'hotspots' ? '3px solid #2e7d32' : 'none' }}
        >
          🔥 Hotspot Clusters ({hotspotData?.totalClusters || 0})
        </button>
        <button
          onClick={() => setActiveTab('models')}
          style={{ ...styles.tabBtn, borderBottom: activeTab === 'models' ? '3px solid #2e7d32' : 'none' }}
        >
          🤖 Models & System Status
        </button>
      </div>

      {/* Tab 1: Explainable Prioritization */}
      {activeTab === 'prioritization' && (
        <div>
          <p style={styles.subtext}>
            Automated ranking based on verified computer vision evidence, citizen complaint density, problem duration, and sensitive landmark proximity.
          </p>
          <div style={styles.queueGrid}>
            {prioritySortedIssues.map((issue) => {
              const score = issue.priorityExplanation?.score || 50;
              const factors = issue.priorityExplanation?.factors || ['Standard civic reporting queue'];
              const isResolved = issue.status === 'Resolved';

              return (
                <div key={issue._id} style={styles.priorityCard}>
                  <div style={styles.cardHeader}>
                    <div>
                      <span style={styles.complaintId}>{issue.complaintId || issue._id}</span>
                      <strong style={{ marginLeft: '8px', fontSize: '1rem' }}>{issue.title}</strong>
                    </div>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      <span style={{
                        ...styles.scoreBadge,
                        backgroundColor: score >= 80 ? '#d32f2f' : (score >= 60 ? '#f57c00' : '#388e3c')
                      }}>
                        Score: {score}/100
                      </span>
                      <span style={{
                        ...styles.statusBadge,
                        backgroundColor: isResolved ? '#e8f5e9' : '#fff3e0',
                        color: isResolved ? '#2e7d32' : '#e65100'
                      }}>
                        {issue.status}
                      </span>
                    </div>
                  </div>

                  <p style={{ margin: '8px 0', fontSize: '0.9rem', color: '#444' }}>
                    {issue.description}
                  </p>

                  {/* AI Evidence Metrics */}
                  <div style={styles.evidencePills}>
                    <span style={styles.pill}>
                      CNN: {issue.aiAnalysis?.cnnProbability ? `${(issue.aiAnalysis.cnnProbability * 100).toFixed(0)}%` : 'Pending'}
                    </span>
                    <span style={styles.pill}>
                      YOLO: {issue.aiAnalysis?.totalObjects || 0} objects
                    </span>
                    <span style={styles.pill}>
                      Agreement: {issue.aiAnalysis?.modelAgreement || 'N/A'}
                    </span>
                    <span style={styles.pill}>
                      Category: {issue.category}
                    </span>
                  </div>

                  {/* Explainability Breakdown */}
                  <div style={styles.factorsBox}>
                    <strong>Reason for Ranking:</strong>
                    <ul style={{ margin: '4px 0 0 0', paddingLeft: '18px', fontSize: '0.85rem' }}>
                      {factors.map((f, i) => (
                        <li key={i}>{f}</li>
                      ))}
                    </ul>
                  </div>

                  {/* Action button */}
                  <div style={{ marginTop: '10px', display: 'flex', gap: '8px' }}>
                    {issue.status !== 'Resolved' && (
                      <button onClick={() => onVerifyClick(issue)} style={styles.verifyActionBtn}>
                        🧹 Verify Resolution with Photo
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab 2: Semantic Duplicate Detection */}
      {activeTab === 'duplicates' && (
        <div>
          <p style={styles.subtext}>
            Nearby complaints within 150m describing the same waste accumulation. Original citizen complaints are always preserved.
          </p>
          {duplicateIssues.length === 0 ? (
            <div style={styles.emptyState}>No overlapping duplicate complaints flagged.</div>
          ) : (
            <div style={styles.queueGrid}>
              {duplicateIssues.map((issue) => (
                <div key={issue._id} style={styles.duplicateCard}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <strong>{issue.complaintId || issue._id} — {issue.title}</strong>
                    <span style={styles.alertPill}>Potential Duplicate</span>
                  </div>
                  <p style={{ margin: '6px 0', fontSize: '0.85rem' }}>
                    {issue.description}
                  </p>
                  <div style={{ fontSize: '0.85rem', color: '#c2185b', backgroundColor: '#fce4ec', padding: '8px', borderRadius: '4px' }}>
                    <strong>Duplicate Indicators:</strong>
                    {(issue.duplicateInfo?.duplicateReasons || []).map((r, i) => (
                      <div key={i}>• {r}</div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Hotspot Intelligence */}
      {activeTab === 'hotspots' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={styles.subtext}>
              Dynamic garbage accumulation clusters aggregated from real geospatial complaint reports.
            </span>
            <select
              value={hotspotFilter}
              onChange={(e) => setHotspotFilter(e.target.value)}
              style={styles.select}
            >
              <option value="all">All Time</option>
              <option value="30d">Last 30 Days</option>
              <option value="7d">Last 7 Days</option>
              <option value="24h">Last 24 Hours</option>
            </select>
          </div>

          <div style={styles.hotspotGrid}>
            {(hotspotData?.topHotspots || []).map((spot) => (
              <div key={spot.clusterId} style={styles.hotspotCard}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h4 style={{ margin: 0, color: '#e65100' }}>🔥 {spot.clusterId}</h4>
                  <span style={styles.recurrenceBadge}>{spot.recurrenceScore}</span>
                </div>
                <div style={{ fontSize: '0.85rem', margin: '8px 0' }}>
                  Center: {spot.center.lat.toFixed(4)}, {spot.center.lng.toFixed(4)}
                  <br />
                  Total Reports: <strong>{spot.totalReports}</strong> (Pending: {spot.pendingReports}, Resolved: {spot.resolvedReports})
                </div>
                <div style={{ fontSize: '0.8rem', color: '#666' }}>
                  Sample: "{spot.sampleTitle}"
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 4: AI Models & Health */}
      {activeTab === 'models' && (
        <div style={styles.modelBox}>
          <h3>🤖 AI Service Integrations & Diagnostics</h3>
          <div style={styles.modelGrid}>
            <div style={styles.modelStatusCard}>
              <h4>Custom CNN Classifier</h4>
              <p>Model: <code>swachhmap_cnn_v2.keras</code> (MobileNetV2 backbone)</p>
              <p>Input Size: 224 × 224 | Threshold: 0.67</p>
              <p>Status: <span style={{ color: '#2e7d32', fontWeight: 'bold' }}>Active in Python FastAPI</span></p>
            </div>

            <div style={styles.modelStatusCard}>
              <h4>Ultralytics YOLO11n Object Detector</h4>
              <p>Model: <code>yolo11n.pt</code></p>
              <p>Classes: Plastic bottles, bags, cardboard, food waste, mixed debris</p>
              <p>Status: <span style={{ color: '#2e7d32', fontWeight: 'bold' }}>Active with Bounding Box Annotations</span></p>
            </div>

            <div style={styles.modelStatusCard}>
              <h4>Gnani AI Primary Conversational Layer</h4>
              <p>Prisma (STT) + Evon 30B (NLU) + Timbre (TTS)</p>
              <p>Languages: Hindi, English, Hinglish</p>
              <p>Status: <span style={{ color: '#e65100', fontWeight: 'bold' }}>Configurable via GNANI_API_KEY with Offline Fallback</span></p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const styles = {
  container: {
    backgroundColor: '#fff',
    borderRadius: '8px',
    padding: '16px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
    marginTop: '20px'
  },
  tabBar: {
    display: 'flex',
    gap: '12px',
    borderBottom: '1px solid #ddd',
    marginBottom: '16px',
    overflowX: 'auto'
  },
  tabBtn: {
    padding: '10px 16px',
    background: 'none',
    border: 'none',
    fontSize: '0.95rem',
    fontWeight: 'bold',
    cursor: 'pointer',
    color: '#333'
  },
  subtext: {
    fontSize: '0.85rem',
    color: '#666',
    margin: '0 0 12px 0'
  },
  queueGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },
  priorityCard: {
    border: '1px solid #e0e0e0',
    borderRadius: '8px',
    padding: '14px',
    backgroundColor: '#fafafa'
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  complaintId: {
    fontFamily: 'monospace',
    fontWeight: 'bold',
    backgroundColor: '#eee',
    padding: '2px 6px',
    borderRadius: '4px',
    fontSize: '0.85rem'
  },
  scoreBadge: {
    color: '#fff',
    padding: '3px 8px',
    borderRadius: '12px',
    fontSize: '0.8rem',
    fontWeight: 'bold'
  },
  statusBadge: {
    padding: '3px 8px',
    borderRadius: '12px',
    fontSize: '0.8rem',
    fontWeight: 'bold'
  },
  evidencePills: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
    margin: '8px 0'
  },
  pill: {
    backgroundColor: '#e3f2fd',
    color: '#1565c0',
    padding: '2px 8px',
    borderRadius: '10px',
    fontSize: '0.75rem',
    fontWeight: 'bold'
  },
  factorsBox: {
    backgroundColor: '#fff',
    border: '1px solid #e8e8e8',
    borderRadius: '6px',
    padding: '8px 12px',
    fontSize: '0.85rem'
  },
  verifyActionBtn: {
    padding: '8px 14px',
    backgroundColor: '#1565c0',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    fontSize: '0.85rem',
    cursor: 'pointer',
    fontWeight: 'bold'
  },
  duplicateCard: {
    border: '1px solid #f8bbd0',
    borderRadius: '8px',
    padding: '12px',
    backgroundColor: '#fff'
  },
  alertPill: {
    backgroundColor: '#e91e63',
    color: '#fff',
    padding: '2px 8px',
    borderRadius: '10px',
    fontSize: '0.75rem',
    fontWeight: 'bold'
  },
  select: {
    padding: '6px 12px',
    borderRadius: '6px',
    border: '1px solid #ccc'
  },
  hotspotGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
    gap: '12px'
  },
  hotspotCard: {
    border: '1px solid #ffe0b2',
    backgroundColor: '#fff3e0',
    borderRadius: '8px',
    padding: '12px'
  },
  recurrenceBadge: {
    backgroundColor: '#ff9800',
    color: '#fff',
    padding: '2px 8px',
    borderRadius: '10px',
    fontSize: '0.75rem',
    fontWeight: 'bold'
  },
  modelBox: {
    padding: '10px 0'
  },
  modelGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: '14px'
  },
  modelStatusCard: {
    border: '1px solid #e0e0e0',
    borderRadius: '8px',
    padding: '14px',
    backgroundColor: '#f9f9f9'
  },
  emptyState: {
    padding: '20px',
    textAlign: 'center',
    color: '#777',
    backgroundColor: '#f5f5f5',
    borderRadius: '6px'
  }
};

export default AIIntelligenceCenter;
