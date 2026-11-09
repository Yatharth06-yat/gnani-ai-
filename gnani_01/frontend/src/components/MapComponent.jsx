
import { useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { reverseGeocode, buildLocationAnnouncement } from '../services/wakeWord/locationService';

// Fix for default markers
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom icons for statuses
const createIcon = (color) =>
  L.divIcon({
    className: 'custom-div-icon',
    html: `<div style="background-color:${color};width:20px;height:20px;border-radius:50%;border:2px solid white;box-shadow: 0 2px 6px rgba(0,0,0,0.3);"></div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });

const selectedIcon = L.divIcon({
  className: 'custom-div-icon',
  html: `<div style="background-color:#059669;width:24px;height:24px;border-radius:50%;border:3px solid white;box-shadow: 0 0 10px #059669;"></div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12]
});

const statusIcons = {
  Reported: createIcon('#ff4444'),
  'In-progress': createIcon('#ffaa00'),
  Resolved: createIcon('#44ff44'),
};

// Map click & selection handler sub-component
function LocationPickerEvents({ onSelectLocation }) {
  useMapEvents({
    click(e) {
      if (onSelectLocation) {
        onSelectLocation(e.latlng);
      }
    }
  });
  return null;
}

const MapComponent = ({ issues, center = [28.6139, 77.2090], zoom = 12, onLocationSelected }) => {
  const [selectedPoint, setSelectedPoint] = useState(null);
  const [selectedLocationInfo, setSelectedLocationInfo] = useState(null);
  const [resolving, setResolving] = useState(false);

  const safeIssues = Array.isArray(issues) ? issues : [];

  const handleMapClick = async (latlng) => {
    setSelectedPoint(latlng);
    setResolving(true);
    try {
      const geo = await reverseGeocode(latlng.lat, latlng.lng);
      setSelectedLocationInfo(geo);
      if (onLocationSelected) {
        onLocationSelected({
          coords: latlng,
          locationInfo: geo
        });
      }
    } catch (_) {
      setSelectedLocationInfo(null);
    } finally {
      setResolving(false);
    }
  };

  const handleMarkerDragEnd = async (e) => {
    const newPos = e.target.getLatLng();
    setSelectedPoint(newPos);
    setResolving(true);
    try {
      const geo = await reverseGeocode(newPos.lat, newPos.lng);
      setSelectedLocationInfo(geo);
      if (onLocationSelected) {
        onLocationSelected({
          coords: newPos,
          locationInfo: geo
        });
      }
    } catch (_) {
      setSelectedLocationInfo(null);
    } finally {
      setResolving(false);
    }
  };

  return (
    <div>
      <div style={{ padding: '10px 14px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', marginBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
        <div>
          <strong>🗺️ Live Map:</strong> Showing {safeIssues.length} issues
          <span style={{ marginLeft: '12px', fontSize: '13px', color: '#64748b' }}>
            🔴 Reported • 🟡 In Progress • 🟢 Resolved
          </span>
        </div>
        {selectedPoint && (
          <div style={{ fontSize: '13px', color: '#065f46', background: '#ecfdf5', padding: '4px 10px', borderRadius: '6px', border: '1px solid #a7f3d0' }}>
            {resolving ? '⏳ Resolving location...' : (
              selectedLocationInfo
                ? `📍 Selected: ${selectedLocationInfo.spokenLocation || selectedLocationInfo.formattedSummary}`
                : `📍 Selected: ${selectedPoint.lat.toFixed(4)}, ${selectedPoint.lng.toFixed(4)}`
            )}
          </div>
        )}
      </div>
      
      <MapContainer center={center} zoom={zoom} style={{ height: '520px', width: '100%', borderRadius: '12px' }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <LocationPickerEvents onSelectLocation={handleMapClick} />

        {selectedPoint && (
          <Marker
            position={[selectedPoint.lat, selectedPoint.lng]}
            icon={selectedIcon}
            draggable={true}
            eventHandlers={{
              dragend: handleMarkerDragEnd
            }}
          >
            <Popup>
              <div style={{ padding: '4px' }}>
                <h4 style={{ margin: '0 0 4px 0', color: '#059669' }}>📍 Selected Garbage Point</h4>
                <p style={{ margin: '0 0 6px 0', fontSize: '12px' }}>
                  {selectedLocationInfo ? selectedLocationInfo.formattedSummary : `${selectedPoint.lat.toFixed(4)}, ${selectedPoint.lng.toFixed(4)}`}
                </p>
                <small style={{ color: '#6b7280' }}>Drag marker to adjust exact garbage location</small>
              </div>
            </Popup>
          </Marker>
        )}

        {safeIssues.map((issue, index) => {
          console.log(`🗺️ Rendering marker ${index}:`, issue);

          if (!issue.location || !issue.location.lat || !issue.location.lng) {
            console.warn('⚠️ Issue missing location:', issue);
            return null;
          }

          // ✅ RETURN Marker properly
          return (
            <Marker
              key={issue._id || `marker-${index}`}
              position={[Number(issue.location.lat), Number(issue.location.lng)]}
              icon={statusIcons[issue.status] || statusIcons.Reported}
            >
              <Popup>
                <div className="popup-content" style={{ maxWidth: '240px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontFamily: 'monospace', fontWeight: 'bold', fontSize: '11px', background: '#eee', padding: '1px 5px', borderRadius: '3px' }}>
                      {issue.complaintId || `#${issue._id}`}
                    </span>
                    {issue.priority && (
                      <span style={{ fontSize: '11px', fontWeight: 'bold', color: issue.priority === 'High' || issue.priority === 'Critical' ? '#d32f2f' : '#2e7d32' }}>
                        {issue.priority} Priority
                      </span>
                    )}
                  </div>
                  <h4 style={{ margin: '4px 0 6px 0', fontSize: '14px' }}>{String(issue.title || 'Untitled')}</h4>
                  <p style={{ margin: '2px 0', fontSize: '12px' }}><strong>Category:</strong> {String(issue.category || 'Other')}</p>
                  <p style={{ margin: '2px 0', fontSize: '12px' }}>
                    <strong>Status:</strong>{' '}
                    <span className={`status-badge status-${(issue.status || 'reported').toLowerCase()}`}>
                      {issue.status || 'Reported'}
                    </span>
                  </p>
                  <p style={{ margin: '4px 0', fontSize: '12px', color: '#555' }}>
                    {String(issue.description || 'No description')}
                  </p>

                  {/* AI Evidence Badges */}
                  {issue.aiAnalysis && (
                    <div style={{ margin: '6px 0', padding: '4px 6px', background: '#e8f5e9', borderRadius: '4px', fontSize: '11px' }}>
                      🤖 <strong>AI Verification:</strong>
                      <div>CNN: {issue.aiAnalysis.cnnProbability ? `${(issue.aiAnalysis.cnnProbability * 100).toFixed(0)}%` : 'Pending'}</div>
                      <div>YOLO: {issue.aiAnalysis.totalObjects || 0} objects</div>
                      <div>Agreement: {issue.aiAnalysis.modelAgreement || 'N/A'}</div>
                    </div>
                  )}

                  {issue.imageUrl && (
                    <img
                      src={issue.imageUrl}
                      alt="Issue"
                      style={{ width: '100%', maxWidth: '200px', height: 'auto', borderRadius: '4px', margin: '4px 0' }}
                    />
                  )}

                  <p style={{ margin: '2px 0', fontSize: '11px', color: '#888' }}>
                    <strong>Reported:</strong> {new Date(issue.createdAt || Date.now()).toLocaleDateString()}
                  </p>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
};

export default MapComponent;
