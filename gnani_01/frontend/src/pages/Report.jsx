import React, { useState, useEffect, useRef } from 'react';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import Ri from '../styles/Report.png';
import successSound from '../styles/syyy.mp3'; // ✅ Audio feedback file
import ConversationAssistant from '../components/ConversationAssistant';
import { useVoiceActivation } from '../context/VoiceActivationContext';
import { reverseGeocode } from '../services/wakeWord/locationService';
import '../styles/Report.css';

const Report = () => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'Garbage',
    location: null, // No default location - user must capture it
    voiceTranscript: ''
  });
  const [image, setImage] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);
  
  // YOLO11n AI Validation States: 'no_image' | 'analyzing' | 'garbage_detected' | 'garbage_not_detected' | 'analysis_failed'
  const [validationState, setValidationState] = useState('no_image');
  const [detectionResult, setDetectionResult] = useState(null);
  const [validationError, setValidationError] = useState('');
  const [showAnnotatedImage, setShowAnnotatedImage] = useState(false);
  const [resolvedLocationName, setResolvedLocationName] = useState('');

  const { openAssistant } = useVoiceActivation();

  const navigate = useNavigate();
  const watchIdRef = useRef(null);
  const audioRef = useRef(null); // ✅ Ref for audio element

  // Prefill handler + cleanup geolocation
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const prefillData = urlParams.get('prefill');

    if (prefillData) {
      try {
        const parsedData = JSON.parse(decodeURIComponent(prefillData));
        setFormData(prev => ({
          ...prev,
          title: parsedData.title || '',
          description: parsedData.description || '',
          category: parsedData.category || 'Garbage',
          location: parsedData.location || null // Don't prefill location
        }));
        toast.info('📝 Form pre-filled with similar issue data. Please capture your location.');
      } catch (error) {
        console.error('Error parsing prefill data:', error);
      }
    }

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  // 📍 Get current location once with human-readable reverse geocoding
  const getCurrentLocation = () => {
    setLocationLoading(true);
    if (!navigator.geolocation) {
      toast.error('Geolocation not supported');
      setLocationLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        setFormData(prev => ({
          ...prev,
          location: { lat: latitude, lng: longitude, accuracy }
        }));

        // Reverse geocode coordinates to human-readable locality
        try {
          const geo = await reverseGeocode(latitude, longitude);
          if (geo && geo.formattedSummary) {
            setResolvedLocationName(geo.formattedSummary);
            toast.success(`📍 Location: ${geo.spokenLocation || geo.formattedSummary}`);
          } else {
            toast.success(`📍 Location detected! (±${Math.round(accuracy)}m)`);
          }
        } catch (_) {
          toast.success(`📍 Location detected! (±${Math.round(accuracy)}m)`);
        }

        setLocationLoading(false);
      },
      () => {
        toast.error('Unable to get location. Using default.');
        setLocationLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  };

  // 📡 Continuous tracking
  const startLiveTracking = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation not supported');
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        setFormData(prev => ({
          ...prev,
          location: { lat: latitude, lng: longitude, accuracy }
        }));
        toast.info(`📡 Updated (±${Math.round(accuracy)}m)`, { autoClose: 1200 });
      },
      () => toast.error('Live tracking failed'),
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );
    watchIdRef.current = watchId;
  };

  // Input change
  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // Automatic YOLO11n Analysis
  const analyzeImageWithYOLO = async (file) => {
    if (!file) return;
    setValidationState('analyzing');
    setDetectionResult(null);
    setValidationError('');

    try {
      const detectForm = new FormData();
      detectForm.append('image', file);

      console.log('🤖 Invoking YOLO11n AI detection for image validation...');
      let data = null;
      try {
        const res = await api.post('/api/ai/detect?threshold=0.25', detectForm, {
          timeout: 15000
        });
        if (res.data && res.data.success !== false) {
          data = res.data;
        } else {
          throw new Error(res.data?.message || 'Node proxy returned unsuccessful');
        }
      } catch (proxyErr) {
        console.warn('⚠️ Node proxy detection warning:', proxyErr.message);
        throw proxyErr;
      }

      console.log('📊 YOLO11n detection result:', data);

      if (data && data.garbage_detected && (data.total_objects > 0 || data.detections?.length > 0)) {
        setValidationState('garbage_detected');
        setDetectionResult(data);
        toast.success(`🎉 Garbage detected (${data.total_objects || data.detections?.length} object(s)/clusters found)! You can now submit your complaint.`);
      } else {
        setValidationState('garbage_not_detected');
        setDetectionResult(data || null);
        toast.warn('⚠️ No supported garbage detected in this image.');
      }
    } catch (err) {
      console.error('❌ YOLO11n detection API error:', err);
      setValidationState('analysis_failed');
      setValidationError(err.response?.data?.message || err.message || 'Image verification failed.');
      toast.error('AI image verification failed. Please try again.');
    }
  };

  const resetImageValidation = () => {
    setImage(null);
    setPreview(null);
    setValidationState('no_image');
    setDetectionResult(null);
    setValidationError('');
    setShowAnnotatedImage(false);
    const fileInput = document.getElementById('imageUpload');
    if (fileInput) fileInput.value = '';
  };

  // Image upload handler
  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file && file.size <= 5 * 1024 * 1024) {
      setImage(file);
      setPreview(URL.createObjectURL(file));
      // Automatically trigger real YOLO11n detection
      analyzeImageWithYOLO(file);
    } else if (file) {
      toast.error('Image must be < 5MB');
      resetImageValidation();
    }
  };

  const handleVoiceComplaintExtracted = (extracted) => {
    if (extracted.complaintId) {
      toast.success(`🎉 Complaint ${extracted.complaintId} registered successfully!`);
      // If user submitted directly through voice assistant
      setTimeout(() => {
        navigate('/my-reports');
      }, 2000);
      return;
    }
    setFormData((prev) => ({
      ...prev,
      title: extracted.title || prev.title,
      description: extracted.description || prev.description,
      category: extracted.category || prev.category,
      voiceTranscript: extracted.voiceTranscript || ''
    }));
    toast.info('Voice complaint details populated into the form.');
  };

  // 📨 Submit report
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Strict Mandatory AI Image Validation Check
    if (!image || validationState !== 'garbage_detected') {
      toast.error('❌ Mandatory AI validation required! Please upload an image with verified garbage presence before submitting.');
      return;
    }

    // Validation
    if (!formData.title.trim()) {
      toast.error('❌ Please enter a title for the issue');
      return;
    }

    if (!formData.description.trim()) {
      toast.error('❌ Please enter a description for the issue');
      return;
    }

    // Require location to be captured
    if (!formData.location) {
      toast.error('📍 Please capture your GPS location before submitting!');
      return;
    }

    if (!formData.location.lat || !formData.location.lng) {
      toast.error('📍 Invalid location data. Please capture your location again.');
      return;
    }

    setLoading(true);
    console.log('📤 Submitting report with location:', formData.location);
    
    try {
      const submitData = new FormData();
      submitData.append('title', formData.title);
      submitData.append('description', formData.description);
      submitData.append('category', formData.category);
      submitData.append('voiceTranscript', formData.voiceTranscript || '');
      submitData.append('location', JSON.stringify({
        lat: formData.location.lat,
        lng: formData.location.lng
      }));
      submitData.append('image', image);

      console.log('📤 Sending verified complaint to backend...');
      const res = await api.post('/api/issues', submitData);

      console.log("✅ Server response:", res.data);

      if (res.data.success) {
        toast.success('🎉 Report submitted successfully! Redirecting to map in 12 seconds...', { 
          autoClose: 12000,
          position: 'top-center'
        });

        // Play success sound
        if (audioRef.current) {
          const playPromise = audioRef.current.play();
          if (playPromise !== undefined) {
            playPromise.catch(() => console.warn('Autoplay blocked'));
          }
        }

        // Reset form
        setFormData({
          title: '',
          description: '',
          category: 'Garbage',
          location: null // Reset to no location
        });
        setImage(null);
        setPreview(null);

        // Navigate to map after 12 seconds
        setTimeout(() => {
          navigate('/map');
        }, 11000);
      } else {
        toast.error(res.data.message || 'Unexpected response from server');
      }

    } catch (error) {
      console.error('❌ Error submitting report:', error);
      toast.error(error.response?.data?.message || 'Failed to submit report');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg">
      <div className="card">
        <div className="ri">
          <img src={Ri} alt="Report" />
        </div>
        <div className="form-side">
          <div className="report-header">
            <h1>📍 Report an Issue</h1>
            <p>Help improve your community by reporting civic problems</p>
            
            {/* Gnani AI Voice Assistant Button & Siri-Style Swachh Saathi Wake Word */}
            <div style={{ marginTop: '12px', marginBottom: '8px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => openAssistant('Report garbage')}
                style={{
                  padding: '10px 18px',
                  backgroundColor: '#059669',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '25px',
                  fontWeight: 'bold',
                  fontSize: '0.95rem',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: '0 3px 10px rgba(5,150,105,0.3)'
                }}
              >
                ✨ Hey Swachh Saathi (Voice)
              </button>

              <button
                type="button"
                onClick={() => setIsVoiceModalOpen(true)}
                style={{
                  padding: '10px 16px',
                  backgroundColor: '#1b5e20',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '25px',
                  fontWeight: '600',
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                🎙️ Gnani Form Assistant
              </button>
            </div>
            {formData.voiceTranscript && (
              <div style={{ fontSize: '0.8rem', color: '#2e7d32', marginTop: '6px' }}>
                ✓ Voice Captured: "{formData.voiceTranscript.substring(0, 50)}..."
              </div>
            )}
          </div>

          <form className="report-form" onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Issue Title *</label>
              <input
                type="text"
                name="title"
                value={formData.title}
                onChange={handleChange}
                required
                placeholder="Brief issue title"
              />
            </div>

            <div className="form-group">
              <label>Category *</label>
              <select name="category" value={formData.category} onChange={handleChange}>
                <option value="Garbage">🗑️ Garbage</option>
                <option value="Pothole">🕳️ Pothole</option>
                <option value="Waterlogging">💧 Waterlogging</option>
                <option value="Sanitation">🚿 Sanitation</option>
              </select>
            </div>

            <div className="form-group">
              <label>Description *</label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows="4"
                placeholder="Describe the issue clearly"
                required
              />
            </div>

            <div className="form-group">
              <label>Upload Photo * (Required for AI Verification)</label>
              <div
                className="upload-area"
                onClick={() => document.getElementById('imageUpload').click()}
                style={{
                  border: validationState === 'garbage_detected' ? '2px solid #2e7d32' : (
                    validationState === 'garbage_not_detected' ? '2px solid #d32f2f' : '2px dashed #ccc'
                  )
                }}
              >
                {preview ? (
                  <div style={{ textAlign: 'center' }}>
                    <img
                      src={showAnnotatedImage && detectionResult?.annotated_image_base64 ? detectionResult.annotated_image_base64 : preview}
                      alt="Uploaded garbage preview"
                      style={{
                        maxWidth: '100%',
                        maxHeight: '260px',
                        borderRadius: '10px',
                        marginBottom: '0.5rem',
                        objectFit: 'contain'
                      }}
                    />
                    <div style={{ fontSize: '0.8rem', color: '#666' }}>
                      Click to choose a different photo
                    </div>
                  </div>
                ) : (
                  <p className="upload-text">📷 Click or drag to upload a garbage image</p>
                )}
              </div>
              <input
                type="file"
                id="imageUpload"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={handleImageChange}
              />
              <small>Mandatory: Max 5MB (JPG, PNG, WEBP)</small>

              {/* AI Image Validation State Display */}
              {validationState === 'no_image' && (
                <div style={aiStyles.neutralBanner}>
                  ℹ️ Upload an image to verify garbage presence before submission.
                </div>
              )}

              {validationState === 'analyzing' && (
                <div style={aiStyles.analyzingBanner}>
                  <div style={aiStyles.spinner}></div>
                  <div>
                    <strong>YOLO11n is analyzing your image...</strong>
                    <div style={{ fontSize: '0.8rem', color: '#555' }}>
                      Scanning for supported waste categories (plastic, food, debris, etc.)
                    </div>
                  </div>
                </div>
              )}

              {validationState === 'garbage_detected' && detectionResult && (
                <div style={aiStyles.successCard}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <h4 style={{ margin: 0, color: '#1b5e20', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      ✅ Garbage Detected Successfully
                    </h4>
                    <span style={aiStyles.latencyBadge}>
                      {detectionResult.inference_time_ms}ms
                    </span>
                  </div>

                  <p style={{ margin: '0 0 8px 0', fontSize: '0.88rem', color: '#2e7d32' }}>
                    YOLO11n identified <strong>{detectionResult.total_objects}</strong> garbage object(s):
                  </p>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '10px' }}>
                    {(detectionResult.detections || []).map((det, idx) => (
                      <span key={idx} style={aiStyles.detectionPill}>
                        🏷️ {det.class_name.replace('_', ' ')}: {(det.confidence * 100).toFixed(0)}%
                      </span>
                    ))}
                  </div>

                  {detectionResult.annotated_image_base64 && (
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <button
                        type="button"
                        onClick={() => setShowAnnotatedImage(!showAnnotatedImage)}
                        style={aiStyles.toggleBtn}
                      >
                        {showAnnotatedImage ? '👁️ Show Original Photo' : '🎯 Show AI Bounding Boxes'}
                      </button>
                      <button
                        type="button"
                        onClick={resetImageValidation}
                        style={aiStyles.resetBtn}
                      >
                        Change Image
                      </button>
                    </div>
                  )}

                  <div style={{ fontSize: '0.82rem', color: '#1b5e20', marginTop: '8px', fontWeight: 'bold' }}>
                    ✓ Validation Passed: You can now submit your complaint.
                  </div>
                </div>
              )}

              {validationState === 'garbage_not_detected' && (
                <div style={aiStyles.warningCard}>
                  <h4 style={{ margin: '0 0 6px 0', color: '#b71c1c' }}>
                    ⚠️ No Garbage Detected in This Image
                  </h4>
                  <p style={{ margin: '0 0 10px 0', fontSize: '0.88rem', color: '#444' }}>
                    We couldn't identify garbage in this image. Please upload a clearer image showing the garbage.
                  </p>
                  <button
                    type="button"
                    onClick={resetImageValidation}
                    style={aiStyles.retryBtn}
                  >
                    📷 Upload Another Image
                  </button>
                </div>
              )}

              {validationState === 'analysis_failed' && (
                <div style={aiStyles.errorCard}>
                  <h4 style={{ margin: '0 0 6px 0', color: '#c62828' }}>
                    ❌ Image Verification Failed
                  </h4>
                  <p style={{ margin: '0 0 10px 0', fontSize: '0.88rem', color: '#555' }}>
                    {validationError || 'Unable to connect to the YOLO11n detection service.'}
                  </p>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {image && (
                      <button
                        type="button"
                        onClick={() => analyzeImageWithYOLO(image)}
                        style={aiStyles.retryBtn}
                      >
                        🔄 Re-analyze Image
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={resetImageValidation}
                      style={aiStyles.resetBtn}
                    >
                      Choose Different Photo
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="form-group location-area">
              {formData.location ? (
                <>
                  {resolvedLocationName && (
                    <div style={{
                      backgroundColor: '#ecfdf5',
                      border: '1px solid #a7f3d0',
                      borderRadius: '8px',
                      padding: '8px 12px',
                      marginBottom: '10px',
                      color: '#065f46',
                      fontWeight: '600',
                      fontSize: '0.9rem'
                    }}>
                      📍 <strong>Resolved Area:</strong> {resolvedLocationName}
                    </div>
                  )}
                  <p>✅ Latitude: {formData.location.lat.toFixed(6)}</p>
                  <p>✅ Longitude: {formData.location.lng.toFixed(6)}</p>
                  <p>
                    Accuracy:{' '}
                    {formData.location.accuracy
                      ? `±${Math.round(formData.location.accuracy)} m`
                      : 'N/A'}
                  </p>
                  <button
                    type="button"
                    className="submit-btn"
                    onClick={getCurrentLocation}
                    disabled={locationLoading}
                    style={{ background: '#059669', marginTop: '0.5rem' }}
                  >
                    {locationLoading ? 'Updating...' : '🔄 Update Location'}
                  </button>
                </>
              ) : (
                <>
                  <p style={{ color: '#dc2626', fontWeight: 'bold' }}>
                    ⚠️ Location not captured yet
                  </p>
                  <p style={{ fontSize: '14px', color: '#6b7280' }}>
                    Click the button below to capture your current GPS location
                  </p>
                  <button
                    type="button"
                    className="submit-btn"
                    onClick={getCurrentLocation}
                    disabled={locationLoading}
                    style={{ marginTop: '0.5rem' }}
                  >
                    {locationLoading ? 'Fetching...' : '📍 Capture My Location'}
                  </button>
                  <button
                    type="button"
                    className="submit-btn"
                    onClick={startLiveTracking}
                    style={{ background: '#059669', marginTop: '0.5rem' }}
                  >
                    🟢 Start Live Tracking
                  </button>
                </>
              )}
            </div>

            <button
              type="submit"
              className="submit-btn"
              disabled={loading || validationState !== 'garbage_detected'}
              style={{
                backgroundColor: validationState === 'garbage_detected' ? '#1b5e20' : '#9ca3af',
                cursor: validationState === 'garbage_detected' ? 'pointer' : 'not-allowed',
                boxShadow: validationState === 'garbage_detected' ? '0 4px 14px rgba(27,94,32,0.4)' : 'none',
                transition: 'all 0.2s ease-in-out'
              }}
            >
              {loading ? 'Submitting...' : (
                validationState === 'garbage_detected'
                  ? '📨 Submit Verified Report'
                  : (validationState === 'analyzing'
                      ? '⏳ YOLO11n Analyzing Image...'
                      : '🔒 Upload Image to Verify Garbage')
              )}
            </button>
          </form>
        </div>
      </div>
      {/* ✅ Success audio feedback */}
      <audio ref={audioRef} src={successSound} preload="auto"></audio>

      {/* SwachhMap Multilingual AI Voice Assistant */}
      <ConversationAssistant
        isOpen={isVoiceModalOpen}
        onClose={() => setIsVoiceModalOpen(false)}
        onComplaintConfirmed={handleVoiceComplaintExtracted}
      />
    </div>
  );
};

const aiStyles = {
  neutralBanner: {
    backgroundColor: '#f1f5f9',
    border: '1px solid #cbd5e1',
    borderRadius: '6px',
    padding: '8px 12px',
    fontSize: '0.85rem',
    color: '#475569',
    marginTop: '8px'
  },
  analyzingBanner: {
    backgroundColor: '#e0f2fe',
    border: '1px solid #7dd3fc',
    borderRadius: '8px',
    padding: '10px 14px',
    marginTop: '8px',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    color: '#0369a1'
  },
  spinner: {
    width: '20px',
    height: '20px',
    border: '3px solid #bae6fd',
    borderTopColor: '#0284c7',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite'
  },
  successCard: {
    backgroundColor: '#ecfdf5',
    border: '1px solid #6ee7b7',
    borderRadius: '8px',
    padding: '12px',
    marginTop: '8px'
  },
  warningCard: {
    backgroundColor: '#fff7ed',
    border: '1px solid #fdba74',
    borderRadius: '8px',
    padding: '12px',
    marginTop: '8px'
  },
  errorCard: {
    backgroundColor: '#fef2f2',
    border: '1px solid #fca5a5',
    borderRadius: '8px',
    padding: '12px',
    marginTop: '8px'
  },
  detectionPill: {
    backgroundColor: '#d1fae5',
    color: '#065f46',
    padding: '3px 8px',
    borderRadius: '12px',
    fontSize: '0.8rem',
    fontWeight: 'bold'
  },
  latencyBadge: {
    backgroundColor: '#a7f3d0',
    color: '#047857',
    padding: '2px 6px',
    borderRadius: '6px',
    fontSize: '0.75rem',
    fontFamily: 'monospace'
  },
  toggleBtn: {
    padding: '6px 12px',
    fontSize: '0.8rem',
    backgroundColor: '#059669',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontWeight: 'bold'
  },
  retryBtn: {
    padding: '6px 12px',
    fontSize: '0.8rem',
    backgroundColor: '#dc2626',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontWeight: 'bold'
  },
  resetBtn: {
    padding: '6px 12px',
    fontSize: '0.8rem',
    backgroundColor: '#f3f4f6',
    color: '#374151',
    border: '1px solid #d1d5db',
    borderRadius: '4px',
    cursor: 'pointer'
  }
};

export default Report;
