import React, { useState } from 'react';
import api from '../utils/api';
import { toast } from 'react-toastify';

const ResolutionVerificationModal = ({ isOpen, onClose, issue, onVerificationComplete }) => {
  const [afterImage, setAfterImage] = useState(null);
  const [preview, setPreview] = useState(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [verificationData, setVerificationData] = useState(null);
  const [showAnnotatedImage, setShowAnnotatedImage] = useState(false);
  const [adminNotes, setAdminNotes] = useState('');

  if (!isOpen || !issue) return null;

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setAfterImage(file);
      setPreview(URL.createObjectURL(file));
      setVerificationData(null);
      setShowAnnotatedImage(false);
    }
  };

  const handleResetImage = () => {
    setAfterImage(null);
    setPreview(null);
    setVerificationData(null);
    setShowAnnotatedImage(false);
  };

  // Step 1: Run YOLO11n Analysis on After-Cleaning Image
  const handleRunVerification = async () => {
    if (!afterImage) {
      toast.error('Please upload an after-cleaning photograph first.');
      return;
    }

    setIsVerifying(true);
    setVerificationData(null);

    try {
      const formData = new FormData();
      formData.append('after_image', afterImage);
      formData.append('notes', adminNotes);

      console.log('🤖 Sending after-cleaning image to YOLO11n resolution verification API...');
      const res = await api.post(`/api/admin/complaints/${issue._id || issue.complaintId}/verify-resolution`, formData);

      console.log('📊 YOLO11n Resolution Verification Result:', res.data);
      setVerificationData(res.data);

      if (res.data.verificationPassed) {
        toast.success('🎉 AI Verification Passed! Zero supported garbage objects detected. You may now confirm resolution.');
      } else {
        toast.warn('⚠️ Garbage still detected in after-cleaning photo. Complaint resolution is blocked.');
      }
    } catch (err) {
      console.error('Resolution verification error:', err);
      toast.error(err.response?.data?.message || 'Resolution verification failed. Please try again.');
    } finally {
      setIsVerifying(false);
    }
  };

  // Step 2: Final Resolution Confirmation with Server Token
  const handleConfirmResolution = async () => {
    if (!verificationData?.verificationToken) {
      toast.error('Valid verification token required. Please run image verification first.');
      return;
    }

    setIsConfirming(true);
    try {
      console.log('🛡️ Submitting final administrative resolution confirmation...');
      const res = await api.post(`/api/admin/complaints/${issue._id || issue.complaintId}/confirm-resolution`, {
        verificationToken: verificationData.verificationToken,
        resolutionNotes: adminNotes
      });

      if (res.data.success) {
        toast.success('🎉 Complaint successfully MARKED AS RESOLVED!');
        if (onVerificationComplete) {
          onVerificationComplete(res.data.data);
        }
        onClose();
      }
    } catch (err) {
      console.error('Confirmation error:', err);
      toast.error(err.response?.data?.message || 'Failed to confirm resolution.');
    } finally {
      setIsConfirming(false);
    }
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        {/* Header */}
        <div style={styles.header}>
          <div>
            <h3 style={{ margin: 0, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
              🧹 YOLO11n Resolution Verification
            </h3>
            <span style={{ fontSize: '0.82rem', color: '#64748b' }}>
              Complaint ID: <strong>{issue.complaintId || issue._id}</strong> | {issue.title}
            </span>
          </div>
          <button onClick={onClose} style={styles.closeBtn}>×</button>
        </div>

        <div style={styles.body}>
          {/* Side-by-side Evidence Grid */}
          <div style={styles.comparisonGrid}>
            {/* Box 1: Original Citizen Evidence */}
            <div style={styles.imageBox}>
              <div style={styles.boxTitle}>📸 Original Citizen Complaint</div>
              <img
                src={issue.imageUrl || 'https://via.placeholder.com/300x200?text=No+Original+Photo'}
                alt="Original Complaint"
                style={styles.img}
              />
              <div style={styles.metaText}>
                Category: <strong>{issue.category}</strong>
                <br />
                Initial Status: <strong>{issue.status}</strong>
                {issue.aiAnalysis?.totalObjects != null && (
                  <div>Original Objects: {issue.aiAnalysis.totalObjects} detected</div>
                )}
              </div>
            </div>

            {/* Box 2: After-Cleaning Photo */}
            <div style={styles.imageBox}>
              <div style={styles.boxTitle}>✨ Fresh After-Cleaning Photo *</div>
              {preview ? (
                <div>
                  <img
                    src={showAnnotatedImage && verificationData?.annotatedImage ? verificationData.annotatedImage : preview}
                    alt="After Cleaning Preview"
                    style={styles.img}
                  />
                  <div style={{ marginTop: '6px', display: 'flex', gap: '6px', justifyContent: 'center' }}>
                    {verificationData?.annotatedImage && (
                      <button
                        type="button"
                        onClick={() => setShowAnnotatedImage(!showAnnotatedImage)}
                        style={styles.toggleBtn}
                      >
                        {showAnnotatedImage ? 'Original After' : '🎯 Show Bounding Boxes'}
                      </button>
                    )}
                    <button type="button" onClick={handleResetImage} style={styles.changeBtn}>
                      Change Photo
                    </button>
                  </div>
                </div>
              ) : (
                <div style={styles.uploadPlaceholder}>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    style={{ fontSize: '0.85rem' }}
                  />
                  <span style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '6px' }}>
                    Upload fresh photograph of the cleaned area (Mandatory)
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Admin Notes */}
          <div style={{ marginTop: '16px' }}>
            <label style={styles.label}>Administrative Resolution Notes:</label>
            <input
              type="text"
              style={styles.input}
              placeholder="e.g. Cleared by Municipal Ward 7 Sanitation Crew; 100% waste removed."
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
            />
          </div>

          {/* Verification Status Cards */}
          {verificationData && (
            <div style={{
              ...styles.resultCard,
              backgroundColor: verificationData.verificationPassed ? '#f0fdf4' : '#fef2f2',
              borderColor: verificationData.verificationPassed ? '#86efac' : '#fca5a5'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <h4 style={{
                  margin: 0,
                  color: verificationData.verificationPassed ? '#166534' : '#991b1b',
                  fontSize: '0.95rem'
                }}>
                  {verificationData.verificationPassed
                    ? '✅ AI Verification Passed (Zero Garbage Detected)'
                    : '⚠️ Residual Garbage Detected (Resolution Blocked)'}
                </h4>
                {verificationData.verificationPassed && (
                  <span style={styles.tokenBadge}>Token Generated (15m TTL)</span>
                )}
              </div>

              <p style={{ margin: '0 0 6px 0', fontSize: '0.88rem', color: '#334155' }}>
                {verificationData.message}
              </p>

              {/* Show remaining garbage objects if detected */}
              {!verificationData.verificationPassed && verificationData.detections?.length > 0 && (
                <div style={{ marginTop: '8px' }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#991b1b', marginBottom: '4px' }}>
                    Detected Remaining Waste Objects:
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {verificationData.detections.map((det, i) => (
                      <span key={i} style={styles.wastePill}>
                        🏷️ {det.class_name || det.class}: {(det.confidence * 100).toFixed(0)}%
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Dual Workflow Action Buttons */}
          <div style={{ marginTop: '20px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            {/* Action 1: Run AI Analysis */}
            <button
              type="button"
              onClick={handleRunVerification}
              disabled={isVerifying || !afterImage || verificationData?.verificationPassed}
              style={{
                ...styles.btn,
                backgroundColor: !afterImage || verificationData?.verificationPassed ? '#94a3b8' : '#2563eb',
                cursor: !afterImage || verificationData?.verificationPassed ? 'not-allowed' : 'pointer'
              }}
            >
              {isVerifying ? '⏳ YOLO11n Analyzing Site...' : '🔍 Step 1: Run YOLO11n Clean Verification'}
            </button>

            {/* Action 2: Final Resolution Confirmation (Locked until Clean Verification Passes) */}
            <button
              type="button"
              onClick={handleConfirmResolution}
              disabled={isConfirming || !verificationData?.verificationPassed}
              style={{
                ...styles.btn,
                backgroundColor: verificationData?.verificationPassed ? '#16a34a' : '#cbd5e1',
                color: verificationData?.verificationPassed ? '#ffffff' : '#64748b',
                cursor: verificationData?.verificationPassed ? 'pointer' : 'not-allowed',
                boxShadow: verificationData?.verificationPassed ? '0 4px 14px rgba(22, 163, 74, 0.35)' : 'none'
              }}
            >
              {isConfirming
                ? 'Saving Resolution...'
                : (verificationData?.verificationPassed
                    ? '✅ Step 2: Confirm & Mark Complaint RESOLVED'
                    : '🔒 Confirm Resolution (Requires Clean Verification)')
              }
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const styles = {
  overlay: {
    position: 'fixed',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    display: 'flex', justifyContent: 'center', alignItems: 'center',
    zIndex: 9999,
    padding: '16px'
  },
  modal: {
    backgroundColor: '#ffffff',
    borderRadius: '16px',
    width: '100%', maxWidth: '720px',
    maxHeight: '92vh', overflowY: 'auto',
    padding: '24px',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
    border: '1px solid #e2e8f0'
  },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    borderBottom: '1px solid #e2e8f0', paddingBottom: '14px', marginBottom: '16px'
  },
  closeBtn: {
    background: 'none', border: 'none', fontSize: '26px', cursor: 'pointer', color: '#94a3b8', lineHeight: 1
  },
  comparisonGrid: {
    display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px'
  },
  imageBox: {
    border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px', textAlign: 'center', backgroundColor: '#f8fafc'
  },
  boxTitle: {
    fontWeight: '700', fontSize: '0.85rem', marginBottom: '8px', color: '#334155'
  },
  img: {
    width: '100%', height: '175px', objectFit: 'contain', borderRadius: '8px', backgroundColor: '#000'
  },
  metaText: {
    fontSize: '0.78rem', color: '#64748b', marginTop: '8px', textAlign: 'left', lineHeight: 1.4
  },
  uploadPlaceholder: {
    height: '175px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
    border: '2px dashed #cbd5e1', borderRadius: '8px', padding: '12px', boxSizing: 'border-box', backgroundColor: '#ffffff'
  },
  toggleBtn: {
    padding: '4px 10px', fontSize: '0.74rem', cursor: 'pointer', background: '#0284c7', color: '#fff', border: 'none', borderRadius: '4px'
  },
  changeBtn: {
    padding: '4px 10px', fontSize: '0.74rem', cursor: 'pointer', background: '#e2e8f0', color: '#334155', border: 'none', borderRadius: '4px'
  },
  label: {
    display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#334155', marginBottom: '6px'
  },
  input: {
    width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1.5px solid #cbd5e1', boxSizing: 'border-box', fontSize: '0.9rem'
  },
  resultCard: {
    marginTop: '16px', padding: '14px', borderRadius: '10px', border: '1.5px solid'
  },
  tokenBadge: {
    fontSize: '0.72rem', backgroundColor: '#dcfce7', color: '#15803d', padding: '2px 8px', borderRadius: '12px', fontWeight: 'bold'
  },
  wastePill: {
    fontSize: '0.74rem', backgroundColor: '#fee2e2', color: '#b91c1c', padding: '3px 8px', borderRadius: '12px', fontWeight: '600'
  },
  btn: {
    flex: 1, minWidth: '240px', padding: '13px 18px', border: 'none', borderRadius: '8px',
    fontSize: '0.92rem', fontWeight: '700', transition: 'all 0.2s'
  }
};

export default ResolutionVerificationModal;
