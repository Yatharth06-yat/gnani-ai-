const { haversineDistance } = require('./duplicateService');

/**
 * Historical Garbage Recurrence & Predictive Analytics Module
 * Strictly conforms to Section 13: Never fabricates predictions without sufficient data.
 */
function analyzeLocationRecurrence(targetLat, targetLng, allHistoricalIssues = [], radiusMeters = 100) {
  if (!targetLat || !targetLng) {
    return {
      status: 'error',
      message: 'Valid coordinates required for recurrence analysis'
    };
  }

  // Filter reports within zone
  const nearbyReports = allHistoricalIssues.filter((issue) => {
    const lat = issue.location?.lat || (Array.isArray(issue.location?.coordinates) ? issue.location.coordinates[1] : null);
    const lng = issue.location?.lng || (Array.isArray(issue.location?.coordinates) ? issue.location.coordinates[0] : null);
    if (!lat || !lng) return false;
    return haversineDistance(targetLat, targetLng, lat, lng) <= radiusMeters;
  });

  // Sort chronologically
  nearbyReports.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  const sampleSize = nearbyReports.length;

  // Threshold rule: Requires at least 3 historical complaints to compute meaningful recurrence
  if (sampleSize < 3) {
    return {
      status: 'insufficient_data',
      sampleSize,
      message: 'Insufficient historical data for a reliable recurrence estimate (minimum 3 records required).',
      recurrenceRisk: 'Unknown / Insufficient Data',
      confidence: 0.0,
      historicalCount: sampleSize
    };
  }

  // Calculate inter-arrival times between complaints
  const intervalsDays = [];
  for (let i = 1; i < nearbyReports.length; i++) {
    const prevTime = new Date(nearbyReports[i - 1].createdAt).getTime();
    const currTime = new Date(nearbyReports[i].createdAt).getTime();
    const diffDays = Math.max(0.5, (currTime - prevTime) / (1000 * 60 * 60 * 24));
    intervalsDays.push(diffDays);
  }

  const avgIntervalDays = intervalsDays.reduce((a, b) => a + b, 0) / intervalsDays.length;
  
  // Calculate resolved and recurring complaints
  const resolvedCount = nearbyReports.filter((r) => r.status === 'Resolved').length;
  const pendingCount = nearbyReports.filter((r) => r.status !== 'Resolved').length;

  let recurrenceRisk = 'Low';
  let predictedDaysUntilNextRecurrence = Math.round(avgIntervalDays);

  if (avgIntervalDays <= 7) {
    recurrenceRisk = 'High';
  } else if (avgIntervalDays <= 21) {
    recurrenceRisk = 'Medium';
  }

  return {
    status: 'analyzed',
    sampleSize,
    radiusMeters,
    historicalCount: sampleSize,
    resolvedCount,
    pendingCount,
    averageRecurrenceIntervalDays: Number(avgIntervalDays.toFixed(1)),
    predictedDaysUntilNextRecurrence,
    recurrenceRisk,
    confidence: Math.min(0.85, 0.4 + sampleSize * 0.08),
    message: `Historical recurrence detected: Average of ${avgIntervalDays.toFixed(1)} days between complaints in this ${radiusMeters}m zone.`
  };
}

module.exports = {
  analyzeLocationRecurrence
};

