/**
 * Haversine formula to compute great-circle distance between two GPS points in meters.
 */
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Earth radius in meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c); // Distance in meters
}

/**
 * Tokenize and calculate Jaccard word similarity between two texts.
 */
function textSimilarity(str1 = '', str2 = '') {
  const tokenize = (s) =>
    new Set(
      s
        .toLowerCase()
        .replace(/[^\w\s\u0900-\u097F]/gi, '')
        .split(/\s+/)
        .filter((w) => w.length > 2)
    );

  const set1 = tokenize(str1);
  const set2 = tokenize(str2);

  if (set1.size === 0 || set2.size === 0) return 0.0;

  const intersection = new Set([...set1].filter((x) => set2.has(x)));
  const union = new Set([...set1, ...set2]);

  return intersection.size / union.size;
}

/**
 * Searches an array of existing issues for potential duplicates near the target report.
 * Works seamlessly whether issues are fetched from MongoDB or from in-memory issues.
 */
function findPotentialDuplicates(targetIssue, existingIssues = [], maxRadiusMeters = 150) {
  const targetLat = targetIssue.location?.lat || targetIssue.location?.coordinates?.[1];
  const targetLng = targetIssue.location?.lng || targetIssue.location?.coordinates?.[0];

  if (!targetLat || !targetLng) {
    return {
      isSuspectedDuplicate: false,
      duplicateCount: 0,
      candidates: []
    };
  }

  const targetText = `${targetIssue.title || ''} ${targetIssue.description || ''} ${targetIssue.voiceTranscript || ''}`;
  const candidates = [];

  for (const issue of existingIssues) {
    // Skip comparing with itself
    const issueId = String(issue._id || issue.id);
    const targetId = String(targetIssue._id || targetIssue.id || '');
    if (targetId && issueId === targetId) continue;

    // Only compare against active/reported issues
    if (issue.status === 'Resolved' || issue.status === 'Rejected') continue;

    const lat = issue.location?.lat || (Array.isArray(issue.location?.coordinates) ? issue.location.coordinates[1] : null);
    const lng = issue.location?.lng || (Array.isArray(issue.location?.coordinates) ? issue.location.coordinates[0] : null);

    if (!lat || !lng) continue;

    const distance = haversineDistance(targetLat, targetLng, lat, lng);
    if (distance <= maxRadiusMeters) {
      const otherText = `${issue.title || ''} ${issue.description || ''} ${issue.voiceTranscript || ''}`;
      const sim = textSimilarity(targetText, otherText);
      const categoryMatch = issue.category === targetIssue.category;

      // Combined similarity indicator
      let duplicateScore = 0.5 * (1 - distance / maxRadiusMeters) + 0.3 * sim + (categoryMatch ? 0.2 : 0);
      duplicateScore = Math.min(1.0, Math.max(0.0, duplicateScore));

      if (distance <= 40 || sim >= 0.4 || duplicateScore >= 0.55) {
        candidates.push({
          issueId: issue._id,
          title: issue.title,
          category: issue.category,
          status: issue.status,
          distanceMeters: distance,
          textSimilarity: Math.round(sim * 100),
          duplicateScore: Math.round(duplicateScore * 100),
          createdAt: issue.createdAt,
          reason: `Located ${distance}m away; ${categoryMatch ? 'same category; ' : ''}${Math.round(sim * 100)}% description overlap.`
        });
      }
    }
  }

  candidates.sort((a, b) => b.duplicateScore - a.duplicateScore);

  return {
    isSuspectedDuplicate: candidates.length > 0,
    duplicateCount: candidates.length,
    candidates: candidates.slice(0, 5),
    explanation:
      candidates.length > 0
        ? `${candidates.length} active complaint(s) identified within ${maxRadiusMeters}m describing similar waste accumulation.`
        : 'No immediate duplicate complaints found within the geographic radius.'
  };
}

module.exports = {
  haversineDistance,
  textSimilarity,
  findPotentialDuplicates
};

