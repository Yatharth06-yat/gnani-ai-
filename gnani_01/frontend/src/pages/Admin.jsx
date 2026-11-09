
import { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import api from '../utils/api';
import AdminIssueCard from '../components/AdminIssueCard';
import MapComponent from '../components/MapComponent';
import AIIntelligenceCenter from '../components/AIIntelligenceCenter';
import ResolutionVerificationModal from '../components/ResolutionVerificationModal';

const Admin = () => {
  const [issues, setIssues] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('table'); // 'table', 'map', or 'ai-center'
  const [filter, setFilter] = useState('all');
  const [verifyingIssue, setVerifyingIssue] = useState(null);

  useEffect(() => {
    fetchData();
    // Auto-refresh every 5 seconds
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      console.log('🔄 Admin: Fetching data from API...');
      console.log('🌐 API Base URL:', api.defaults.baseURL);

      const [issuesResponse, statsResponse] = await Promise.all([
        api.get('/api/issues'),
        api.get('/api/issues/admin/stats')
      ]);

      console.log('✅ Admin: Issues response:', issuesResponse.data);
      console.log('✅ Admin: Stats response:', statsResponse.data);

      // Safely extract issues data
      let issuesData = [];
      if (issuesResponse.data.success && Array.isArray(issuesResponse.data.data)) {
        issuesData = issuesResponse.data.data;
      } else if (Array.isArray(issuesResponse.data)) {
        issuesData = issuesResponse.data;
      }

      console.log('📋 Admin: Processed issues count:', issuesData.length);
      console.log('📋 Admin: Issues data:', issuesData);
      setIssues(issuesData);
      setStats(statsResponse.data.data);

      if (issuesData.length > 0) {
        console.log('🎉 Successfully loaded', issuesData.length, 'issues');
      } else {
        console.warn('⚠️ No issues found in response');
      }
    } catch (error) {
      console.error('❌ Fetch data error:', error);
      console.error('❌ Error details:', error.response?.data || error.message);
      toast.error(`Failed to fetch admin data: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (issueId, newStatus) => {
    try {
      await api.patch(`/api/admin/complaints/${issueId}/status`, { status: newStatus });

      // Update the issue in the list
      setIssues(prevIssues =>
        prevIssues.map(issue =>
          issue._id === issueId ? { ...issue, status: newStatus } : issue
        )
      );

      toast.success(`✅ Issue status updated to ${newStatus}`);
      fetchData();
    } catch (error) {
      console.error('Status update error:', error);
      toast.error(error.response?.data?.message || 'Failed to update issue status');
    }
  };

  const handleDelete = async (issueId) => {
    try {
      await api.delete(`/api/issues/${issueId}`);

      // Remove the issue from the list
      setIssues(prevIssues => prevIssues.filter(issue => issue._id !== issueId));

      toast.success('🗑️ Issue deleted successfully');

      // Refresh stats
      fetchStats();
    } catch (error) {
      console.error('Delete error:', error);
      toast.error('Failed to delete issue');
    }
  };

  const fetchStats = async () => {
    try {
      const statsResponse = await api.get('/api/issues/admin/stats');
      setStats(statsResponse.data.data);
    } catch (error) {
      console.error('Stats fetch error:', error);
    }
  };

  const filteredIssues = filter === 'all'
    ? issues
    : issues.filter(issue => issue.status === filter);

  if (loading) {
    return <div className="loading">Loading admin dashboard...</div>;
  }

  return (
    <div className="admin-page">
      <div className="container">
        <div className="page-header">
          <h1>👨‍💼 Admin Dashboard</h1>
          <p>Manage and track all civic issues</p>
        </div>

        {stats && (
          <div className="admin-stats">
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-icon">📊</div>
                <div className="stat-content">
                  <h3>{stats.totalIssues}</h3>
                  <p>Total Issues</p>
                </div>
              </div>

              <div className="stat-card reported">
                <div className="stat-icon">🔴</div>
                <div className="stat-content">
                  <h3>{stats.reportedIssues}</h3>
                  <p>Reported</p>
                </div>
              </div>

              <div className="stat-card in-progress">
                <div className="stat-icon">🟡</div>
                <div className="stat-content">
                  <h3>{stats.inProgressIssues}</h3>
                  <p>In Progress</p>
                </div>
              </div>

              <div className="stat-card resolved">
                <div className="stat-icon">🟢</div>
                <div className="stat-content">
                  <h3>{stats.resolvedIssues}</h3>
                  <p>Resolved</p>
                </div>
              </div>
            </div>

            <div className="category-stats">
              <h3>Issues by Category</h3>
              <div className="category-grid">
                {stats.categoryStats.map((category) => (
                  <div key={category._id} className="category-stat">
                    <span className="category-name">{category._id}</span>
                    <span className="category-count">{category.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="admin-controls">
          <div className="view-controls">
            <button
              className={`btn ${view === 'table' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setView('table')}
            >
              📋 Table View
            </button>
            <button
              className={`btn ${view === 'ai-center' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setView('ai-center')}
              style={{ backgroundColor: view === 'ai-center' ? '#1b5e20' : undefined, color: view === 'ai-center' ? '#fff' : undefined }}
            >
              🧠 AI Intelligence Center
            </button>
            <button
              className={`btn ${view === 'map' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setView('map')}
            >
              🗺️ Map View
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => {
                setLoading(true);
                fetchData();
              }}
              style={{ marginLeft: '10px' }}
            >
              🔄 Refresh Data
            </button>
            <button
              className="btn btn-success"
              onClick={() => window.location.href = '/report'}
              style={{ marginLeft: '10px' }}
            >
              📝 Report New Issue
            </button>
          </div>

          <div className="filter-controls">
            <label htmlFor="admin-filter">Filter by Status:</label>
            <select
              id="admin-filter"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="filter-select"
            >
              <option value="all">All Issues ({issues.length})</option>
              <option value="Reported">
                🔴 Reported ({issues.filter(i => i.status === 'Reported').length})
              </option>
              <option value="In-progress">
                🟡 In Progress ({issues.filter(i => i.status === 'In-progress').length})
              </option>
              <option value="Resolved">
                🟢 Resolved ({issues.filter(i => i.status === 'Resolved').length})
              </option>
            </select>
          </div>
        </div>

        {view === 'ai-center' ? (
          <AIIntelligenceCenter
            issues={issues}
            onVerifyClick={(issue) => setVerifyingIssue(issue)}
          />
        ) : view === 'map' ? (
          <div className="admin-map">
            <MapComponent issues={filteredIssues} />
          </div>
        ) : (
          <div className="admin-issues">
            {filteredIssues.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">📭</div>
                <h3>No issues found</h3>
                <p>
                  {filter === 'all'
                    ? "No issues have been reported yet."
                    : `No ${filter.toLowerCase()} issues found.`
                  }
                </p>
              </div>
            ) : (
              <div className="admin-issues-list">
                {filteredIssues.map((issue, index) => (
                  <AdminIssueCard
                    key={`admin-issue-${issue._id || index}`}
                    issue={issue}
                    onStatusUpdate={handleStatusUpdate}
                    onDelete={handleDelete}
                    onVerifyClick={(targetIssue) => setVerifyingIssue(targetIssue)}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Resolution Verification Modal */}
      <ResolutionVerificationModal
        isOpen={!!verifyingIssue}
        issue={verifyingIssue}
        onClose={() => setVerifyingIssue(null)}
        onVerificationComplete={() => {
          setVerifyingIssue(null);
          fetchData();
        }}
      />
    </div>
  );
};

export default Admin;