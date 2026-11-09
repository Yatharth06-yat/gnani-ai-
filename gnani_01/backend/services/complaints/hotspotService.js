const { haversineDistance } = require('./duplicateService');

/**
 * Aggregates a list of issues into dynamic geographic hotspot clusters.
 * Produces points ready for Leaflet heatmap ([lat, lng, intensity]) as well as rich cluster cards.
 */
function generateHotspotIntelligence(issues = [], options = {}) {
  const {
    timeRange = 'all', // '24h', '7d', '30d', 'all'
    status = 'all',
    category = 'all',
    clusterRadiusMeters = 120
  } = options;

  const now = Date.now();
  let timeThresholdMs = 0;
  if (timeRange === '24h') timeThresholdMs = now - 24 * 60 * 60 * 1000;
  else if (timeRange === '7d') timeThresholdMs = now - 7 * 24 * 60 * 60 * 1000;
  else if (timeRange === '30d') timeThresholdMs = now - 30 * 24 * 60 * 60 * 1000;

  // Filter issues
  const filtered = issues.filter((issue) => {
    if (timeThresholdMs > 0) {
      const created = new Date(issue.createdAt || now).getTime();
      if (created < timeThresholdMs) return false;
    }
    if (status !== 'all' && issue.status !== status) return false;
    if (category !== 'all' && issue.category !== category) return false;

    const lat = issue.location?.lat || (Array.isArray(issue.location?.coordinates) ? issue.location.coordinates[1] : null);
    const lng = issue.location?.lng || (Array.isArray(issue.location?.coordinates) ? issue.location.coordinates[0] : null);
    return lat != null && lng != null && !isNaN(lat) && !isNaN(lng);
  });

  // Cluster spatially
  const clusters = [];

  for (const issue of filtered) {
    const lat = Number(issue.location?.lat || issue.location.coordinates[1]);
    const lng = Number(issue.location?.lng || issue.location.coordinates[0]);

    let matchedCluster = null;
    for (const cluster of clusters) {
      const dist = haversineDistance(lat, lng, cluster.centerLat, cluster.centerLng);
      if (dist <= clusterRadiusMeters) {
        matchedCluster = cluster;
        break;
      }
    }

    if (matchedCluster) {
      matchedCluster.issues.push(issue);
      // Recalculate centroid
      const n = matchedCluster.issues.length;
      matchedCluster.centerLat = (matchedCluster.centerLat * (n - 1) + lat) / n;
      matchedCluster.centerLng = (matchedCluster.centerLng * (n - 1) + lng) / n;
      if (issue.status === 'Reported' || issue.status === 'In-progress') matchedCluster.pendingCount++;
      if (issue.status === 'Resolved') matchedCluster.resolvedCount++;
    } else {
      clusters.push({
        id: `HOTSPOT-${clusters.length + 1}`,
        centerLat: lat,
        centerLng: lng,
        issues: [issue],
        pendingCount: (issue.status === 'Reported' || issue.status === 'In-progress') ? 1 : 0,
        resolvedCount: issue.status === 'Resolved' ? 1 : 0,
        createdAt: issue.createdAt
      });
    }
  }

  // Generate heatmap points [lat, lng, intensity]
  const heatmapPoints = clusters.map((c) => {
    // Intensity formula based on total complaints, pending ratio, and recurrence
    const total = c.issues.length;
    const pendingRatio = total > 0 ? c.pendingCount / total : 0.5;
    const intensity = Math.min(1.0, Math.max(0.2, (total * 0.25) + (pendingRatio * 0.4)));

    return {
      lat: Number(c.centerLat.toFixed(5)),
      lng: Number(c.centerLng.toFixed(5)),
      intensity: Number(intensity.toFixed(2)),
      reportCount: total,
      pendingCount: c.pendingCount,
      resolvedCount: c.resolvedCount,
      clusterId: c.id
    };
  });

  // Top high-priority hotspots
  const topHotspots = clusters
    .map((c) => ({
      clusterId: c.id,
      center: { lat: c.centerLat, lng: c.centerLng },
      totalReports: c.issues.length,
      pendingReports: c.pendingCount,
      resolvedReports: c.resolvedCount,
      recurrenceScore: c.issues.length > 2 ? 'High Recurrence' : (c.issues.length === 2 ? 'Moderate Recurrence' : 'Single Report'),
      sampleTitle: c.issues[0]?.title || 'Civic Issue',
      latestReportDate: c.issues.reduce((latest, i) => {
        const d = new Date(i.createdAt || 0);
        return d > latest ? d : latest;
      }, new Date(0))
    }))
    .sort((a, b) => b.totalReports - a.totalReports)
    .slice(0, 10);

  return {
    timeRange,
    totalIssuesFiltered: filtered.length,
    totalClusters: clusters.length,
    heatmapPoints,
    topHotspots
  };
}

module.exports = {
  generateHotspotIntelligence
};

