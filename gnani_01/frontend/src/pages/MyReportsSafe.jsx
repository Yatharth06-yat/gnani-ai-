import { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import api from '../utils/api';

const MyReportsSafe = () => {
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchMyReports();
    const interval = setInterval(fetchMyReports, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchMyReports = async () => {
    try {
      setError(null);
      const response = await api.get('/api/issues/my-reports');
      
      // Extract data safely
      let rawData = [];
      if (response.data && response.data.success && Array.isArray(response.data.data)) {
        rawData = response.data.data;
      } else if (Array.isArray(response.data)) {
        rawData = response.data;
      }

      // Convert everything to safe strings
      const safeIssues = rawData.map((item, index) => {
        const safeItem = {
          id: String(item._id || item.id || index),
          complaintId: String(item.complaintId || item._id || `#${index + 1}`),
          title: String(item.title || 'Untitled Issue'),
          description: String(item.description || 'No description provided'),
          category: String(item.category || 'Other'),
          status: String(item.status || 'Reported'),
          imageUrl: item.imageUrl || '',
          resolutionImage: item.resolutionImage || item.resolutionVerification?.afterImageUrl || '',
          resolutionNotes: item.resolutionNotes || item.resolutionVerification?.notes || '',
          resolvedAt: item.resolvedAt || null,
          aiAnalysis: item.aiAnalysis || null,
          resolutionVerification: item.resolutionVerification || null,
          createdAt: String(item.createdAt || new Date().toISOString()),
          location: 'Location not available'
        };

        // Handle location safely
        try {
          if (item.location && typeof item.location === 'object') {
            const lat = Number(item.location.lat);
            const lng = Number(item.location.lng);
            if (!isNaN(lat) && !isNaN(lng)) {
              safeItem.location = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
            }
          }
        } catch (e) {
          // Keep default location text
        }

        return safeItem;
      });

      setIssues(safeIssues);
    } catch (error) {
      console.error('Fetch error:', error);
      setError(error.message);
      toast.error('Failed to fetch reports');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <h2>📋 My Reports</h2>
        <p>Loading your reports...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <h2>📋 My Reports</h2>
        <p style={{ color: 'red' }}>Error: {error}</p>
        <button onClick={fetchMyReports} style={{ padding: '10px 20px', marginTop: '10px' }}>
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '20px' }}>
        <h1 style={{ fontSize: '1.6rem', margin: 0 }}>📋 My Reports ({issues.length})</h1>
        <button 
          onClick={fetchMyReports}
          style={{
            padding: '8px 18px',
            backgroundColor: '#059669',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: '600',
            fontSize: '14px'
          }}
        >
          🔄 Refresh
        </button>
      </div>

      {issues.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 16px', background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
          <p style={{ fontSize: '1.2rem', marginBottom: '8px' }}>📭 No reports found</p>
          <p style={{ color: '#64748b' }}>Submit your first report or talk to Swachh Saathi to see it here!</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '16px' }}>
          {issues.map((issue, index) => (
            <div 
              key={`issue-${index}-${issue.id}`}
              style={{
                border: '1px solid #ddd',
                borderRadius: '8px',
                padding: '20px',
                backgroundColor: '#f9f9f9'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <h3 style={{ margin: 0, color: '#333' }}>{issue.title}</h3>
                <span style={{ fontFamily: 'monospace', fontWeight: 'bold', background: '#eee', padding: '2px 8px', borderRadius: '4px', fontSize: '0.85rem' }}>
                  {issue.complaintId}
                </span>
              </div>
              
              <p style={{ margin: '0 0 10px 0', color: '#666' }}>
                {issue.description}
              </p>

              {issue.imageUrl && (
                <div style={{ marginBottom: '10px' }}>
                  <img
                    src={issue.imageUrl}
                    alt="Evidence"
                    style={{ maxHeight: '160px', borderRadius: '6px', objectFit: 'cover' }}
                  />
                </div>
              )}

              {/* AI Verification Profile */}
              {issue.aiAnalysis && (
                <div style={{ backgroundColor: '#e8f5e9', padding: '8px 12px', borderRadius: '6px', marginBottom: '10px', fontSize: '13px' }}>
                  <strong>🤖 AI Multimodal Verification:</strong>
                  <div>CNN Probability: {issue.aiAnalysis.cnnProbability ? `${(issue.aiAnalysis.cnnProbability * 100).toFixed(0)}%` : 'Pending'}</div>
                  <div>YOLO Objects: {issue.aiAnalysis.totalObjects || 0} localized</div>
                  <div>Model Agreement: {issue.aiAnalysis.modelAgreement || 'N/A'}</div>
                </div>
              )}

              {/* Resolution Verification Evidence for Citizens */}
              {issue.status === 'Resolved' && (
                <div style={{
                  backgroundColor: '#f0fdf4',
                  border: '1.5px solid #86efac',
                  borderRadius: '8px',
                  padding: '12px 14px',
                  marginBottom: '12px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#166534', fontWeight: 'bold', fontSize: '0.95rem' }}>
                    <span>🎉 Site Cleaned & Resolved</span>
                    <span style={{ fontSize: '0.75rem', backgroundColor: '#dcfce7', padding: '2px 8px', borderRadius: '12px', border: '1px solid #bbf7d0' }}>
                      AI Verified by YOLO11n
                    </span>
                  </div>

                  <p style={{ margin: '4px 0 10px 0', fontSize: '0.85rem', color: '#15803d' }}>
                    Municipal sanitation team cleaned this area. The uploaded after-cleaning photograph was analyzed by YOLO11n AI and verified to have zero residual garbage.
                  </p>

                  {(issue.resolutionImage || issue.resolutionVerification?.afterImageUrl) && (
                    <div style={{ marginBottom: '8px' }}>
                      <div style={{ fontSize: '0.78rem', fontWeight: 'bold', color: '#334155', marginBottom: '4px' }}>
                        📸 After-Cleaning Verified Photograph:
                      </div>
                      <img
                        src={issue.resolutionImage || issue.resolutionVerification?.afterImageUrl}
                        alt="Cleaned Site Verification"
                        style={{ maxHeight: '160px', maxWidth: '100%', borderRadius: '6px', objectFit: 'contain', backgroundColor: '#000' }}
                      />
                    </div>
                  )}

                  {issue.resolutionNotes && (
                    <div style={{ fontSize: '0.82rem', color: '#334155', marginTop: '4px' }}>
                      <strong>Administrative Note:</strong> "{issue.resolutionNotes}"
                    </div>
                  )}
                  {issue.resolvedAt && (
                    <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px' }}>
                      Resolved on: {new Date(issue.resolvedAt).toLocaleString()}
                    </div>
                  )}
                </div>
              )}

              {/* Resolution Verification Status (Non-resolved awaiting states) */}
              {issue.status !== 'Resolved' && issue.resolutionVerification && issue.resolutionVerification.status !== 'Not Submitted' && (
                <div style={{ backgroundColor: '#fff3e0', border: '1px solid #ffe0b2', padding: '8px 12px', borderRadius: '6px', marginBottom: '10px', fontSize: '13px' }}>
                  <strong>🧹 Resolution Verification:</strong>
                  <div>Status: <strong>{issue.resolutionVerification.status}</strong></div>
                  {issue.resolutionVerification.notes && <div>Notes: {issue.resolutionVerification.notes}</div>}
                </div>
              )}
              
              <div style={{ fontSize: '14px', color: '#888' }}>
                <p><strong>Category:</strong> {issue.category}</p>
                <p><strong>Status:</strong> 
                  <span style={{
                    padding: '2px 8px',
                    borderRadius: '4px',
                    backgroundColor: issue.status === 'Reported' ? '#ffebee' : 
                                   issue.status === 'In-progress' ? '#fff3e0' : '#e8f5e8',
                    color: issue.status === 'Reported' ? '#c62828' : 
                           issue.status === 'In-progress' ? '#ef6c00' : '#2e7d32',
                    marginLeft: '5px'
                  }}>
                    {issue.status}
                  </span>
                </p>
                <p><strong>Location:</strong> {issue.location}</p>
                <p><strong>Reported:</strong> {new Date(issue.createdAt).toLocaleDateString()}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MyReportsSafe;