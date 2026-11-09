import React, { useState } from 'react';
import { toast } from 'react-toastify';

const AdminIssueCard = ({ issue, onStatusUpdate, onDelete, onVerifyClick }) => {
  const [isUpdating, setIsUpdating] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState(issue.status);

  if (!issue) return null;

  const handleStatusUpdate = async () => {
    if (selectedStatus === 'Resolved') {
      toast.warn('⚠️ Direct resolution is locked! Please click "🧹 Verify & Resolve" to upload an after-cleaning photo.');
      if (onVerifyClick) onVerifyClick(issue);
      return;
    }

    if (selectedStatus === issue.status) {
      toast.info('Status is already set to ' + selectedStatus);
      return;
    }

    setIsUpdating(true);
    try {
      await onStatusUpdate(issue._id, selectedStatus);
    } catch (error) {
      toast.error('Failed to update status');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to delete this issue?')) {
      try {
        await onDelete(issue._id);
      } catch (error) {
        toast.error('Failed to delete issue');
      }
    }
  };

  const statusColors = {
    'Reported': '#f44336',
    'In-progress': '#ff9800', 
    'Resolved': '#4caf50'
  };

  const statusColor = statusColors[issue.status] || '#9e9e9e';
  const imageUrl = issue.imageUrl || 'https://via.placeholder.com/300x200?text=No+Image';

  return (
    <div className="admin-issue-card" style={{
      border: '1px solid #ddd',
      borderRadius: '8px',
      padding: '16px',
      margin: '10px 0',
      backgroundColor: '#fff',
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
    }}>
      {/* Issue Image */}
      <div style={{ marginBottom: '12px' }}>
        <img 
          src={imageUrl}
          alt={issue.title}
          style={{
            width: '100%',
            height: '200px',
            objectFit: 'cover',
            borderRadius: '6px'
          }}
          onError={(e) => {
            e.target.src = 'https://via.placeholder.com/300x200?text=Image';
          }}
        />
      </div>

      {/* Issue Details */}
      <div style={{ marginBottom: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
          <span style={{ fontFamily: 'monospace', fontWeight: 'bold', fontSize: '11px', background: '#f0f0f0', padding: '2px 6px', borderRadius: '4px' }}>
            {issue.complaintId || `#${issue._id}`}
          </span>
          {issue.priorityExplanation && (
            <span style={{ fontSize: '11px', fontWeight: 'bold', color: issue.priorityExplanation.score >= 70 ? '#d32f2f' : '#2e7d32' }}>
              Priority Score: {issue.priorityExplanation.score}/100
            </span>
          )}
        </div>

        <h3 style={{ margin: '0 0 8px 0', color: '#333' }}>
          {String(issue.title || 'Untitled')}
        </h3>
        
        <p style={{ margin: '0 0 8px 0', color: '#666', fontSize: '14px' }}>
          {String(issue.description || 'No description')}
        </p>

        {/* AI Evidence Badges */}
        {issue.aiAnalysis && (
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '8px' }}>
            <span style={{ fontSize: '11px', background: '#e3f2fd', color: '#1565c0', padding: '2px 6px', borderRadius: '4px' }}>
              CNN: {issue.aiAnalysis.cnnProbability ? `${(issue.aiAnalysis.cnnProbability * 100).toFixed(0)}%` : 'Pending'}
            </span>
            <span style={{ fontSize: '11px', background: '#f3e5f5', color: '#7b1fa2', padding: '2px 6px', borderRadius: '4px' }}>
              YOLO: {issue.aiAnalysis.totalObjects || 0} objects
            </span>
            <span style={{ fontSize: '11px', background: '#e8f5e9', color: '#2e7d32', padding: '2px 6px', borderRadius: '4px' }}>
              Agreement: {issue.aiAnalysis.modelAgreement || 'N/A'}
            </span>
          </div>
        )}

        <div style={{ fontSize: '12px', color: '#888' }}>
          <p style={{ margin: '4px 0' }}>
            📍 <strong>Location:</strong> {
              issue.location?.lat && issue.location?.lng 
                ? `${Number(issue.location.lat).toFixed(4)}, ${Number(issue.location.lng).toFixed(4)}`
                : 'Location not available'
            }
          </p>
          <p style={{ margin: '4px 0' }}>
            <strong>Category:</strong> {String(issue.category || 'Other')}
          </p>
          <p style={{ margin: '4px 0' }}>
            <strong>Reported by:</strong> {issue.reportedBy?.name || 'Unknown'}
          </p>
          <p style={{ margin: '4px 0' }}>
            <strong>Date:</strong> {new Date(issue.createdAt).toLocaleDateString()}
          </p>
        </div>
      </div>

      {/* Current Status */}
      <div style={{ marginBottom: '12px' }}>
        <span 
          style={{
            padding: '4px 12px',
            borderRadius: '20px',
            fontSize: '12px',
            fontWeight: 'bold',
            color: 'white',
            backgroundColor: statusColor
          }}
        >
          {issue.status}
        </span>
      </div>

      {/* Admin Controls */}
      <div style={{ 
        display: 'flex', 
        gap: '8px', 
        alignItems: 'center',
        flexWrap: 'wrap'
      }}>
        {/* Status Update (Non-resolved states) */}
        {issue.status !== 'Resolved' ? (
          <>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              style={{
                padding: '6px 8px',
                borderRadius: '4px',
                border: '1px solid #ddd',
                fontSize: '12px'
              }}
            >
              <option value="Reported">🔴 Reported</option>
              <option value="Under Review">🔍 Under Review</option>
              <option value="In-progress">🟡 In Progress</option>
              <option value="Awaiting Verification">⏳ Awaiting Verification</option>
              <option value="Rejected">❌ Rejected</option>
            </select>

            <button
              onClick={handleStatusUpdate}
              disabled={isUpdating || selectedStatus === issue.status}
              style={{
                padding: '6px 12px',
                backgroundColor: selectedStatus === issue.status ? '#ccc' : '#475569',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: selectedStatus === issue.status ? 'not-allowed' : 'pointer',
                fontSize: '12px'
              }}
            >
              {isUpdating ? '⏳...' : 'Update Status'}
            </button>

            {/* Mandatory YOLO11n Resolution Verification Button */}
            <button
              type="button"
              onClick={() => onVerifyClick && onVerifyClick(issue)}
              style={{
                padding: '7px 14px',
                backgroundColor: '#16a34a',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: 'bold',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                boxShadow: '0 2px 6px rgba(22, 163, 74, 0.3)'
              }}
            >
              🧹 AI Verify & Resolve
            </button>
          </>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{
              backgroundColor: '#dcfce7',
              color: '#166534',
              padding: '5px 12px',
              borderRadius: '20px',
              fontWeight: 'bold',
              fontSize: '12px',
              border: '1px solid #86efac'
            }}>
              ✅ Resolved & Verified by YOLO11n
            </span>
            <button
              type="button"
              onClick={() => onVerifyClick && onVerifyClick(issue)}
              style={{
                padding: '5px 10px',
                backgroundColor: '#f1f5f9',
                border: '1px solid #cbd5e1',
                borderRadius: '4px',
                fontSize: '11px',
                cursor: 'pointer'
              }}
            >
              👁️ View Verification Record
            </button>
          </div>
        )}

        {issue.status === 'Resolved' && (
          <button
            onClick={() => {
              // Pre-fill report form with similar issue data
              const reportUrl = `/report?prefill=${encodeURIComponent(JSON.stringify({
                title: `Similar to: ${issue.title}`,
                description: `Similar issue to the resolved one: ${issue.description}`,
                category: issue.category,
                location: issue.location
              }))}`;
              window.location.href = reportUrl;
            }}
            style={{
              padding: '6px 12px',
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            📝 Report Similar
          </button>
        )}

        <button
          onClick={handleDelete}
          style={{
            padding: '6px 12px',
            backgroundColor: issue.status === 'Resolved' ? '#28a745' : '#dc3545',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}
        >
          🗑️ {issue.status === 'Resolved' ? 'Delete Resolved' : 'Delete'}
        </button>
      </div>

      {/* Delete notice for resolved issues */}
      {issue.status === 'Resolved' && (
        <div style={{
          marginTop: '8px',
          padding: '8px',
          backgroundColor: '#d4edda',
          border: '1px solid #c3e6cb',
          borderRadius: '4px',
          fontSize: '12px',
          color: '#155724'
        }}>
          ✅ Issue is resolved! Click "Delete Resolved" to remove it from the system.
        </div>
      )}
    </div>
  );
};

export default AdminIssueCard;