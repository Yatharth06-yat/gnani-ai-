/**
 * Computes an auditable, explainable civic priority score.
 * Factors:
 *  - Evidence Quality (CNN confidence + YOLO object count)
 *  - Issue Age / Pending Duration
 *  - Duplicate / Cluster Concentration (number of independent citizen voices)
 *  - Waste Category and Critical Landmark Impact
 */
function calculateExplainablePriority(issue, duplicateCount = 0) {
  let score = 30; // Baseline
  const factors = [];

  // 1. Evidence Quality
  const cnnProb = issue.aiAnalysis?.cnnProbability || 0;
  const yoloCount = issue.aiAnalysis?.totalObjects || 0;

  if (cnnProb >= 0.85 && yoloCount >= 3) {
    score += 25;
    factors.push(`Strong visual confirmation: CNN confidence ${(cnnProb * 100).toFixed(0)}% and ${yoloCount} localized waste objects.`);
  } else if (cnnProb >= 0.67 || yoloCount > 0) {
    score += 15;
    factors.push(`Verified waste presence: CNN ${(cnnProb * 100).toFixed(0)}%, ${yoloCount} object(s).`);
  } else if (issue.aiAnalysis?.modelAgreement === 'conflicting') {
    factors.push('Model disagreement between CNN and YOLO requires human inspection.');
  }

  // 2. Citizen Density & Cluster Duplicates
  if (duplicateCount >= 3) {
    score += 25;
    factors.push(`High civic density: ${duplicateCount} multiple independent citizens reported this spot.`);
  } else if (duplicateCount >= 1) {
    score += 15;
    factors.push(`Corroborated by ${duplicateCount} nearby citizen report(s).`);
  }

  // 3. Problem Duration / Age
  const createdDate = new Date(issue.createdAt || Date.now());
  const hoursPending = Math.round((Date.now() - createdDate.getTime()) / (1000 * 60 * 60));
  if (hoursPending > 72) {
    score += 20;
    factors.push(`Extended unresolved duration: pending for ${Math.round(hoursPending / 24)} days.`);
  } else if (hoursPending > 24) {
    score += 10;
    factors.push(`Pending over ${hoursPending} hours.`);
  }

  // 4. Critical Category / Sensitive Locations
  const text = `${issue.title || ''} ${issue.description || ''} ${issue.category || ''}`.toLowerCase();
  if (text.includes('hospital') || text.includes('school') || text.includes('road block') || text.includes('highway')) {
    score += 15;
    factors.push('Public accessibility hazard: sensitive landmark or thoroughfare identified.');
  }
  if (issue.category === 'Sanitation' || text.includes('drain') || text.includes('nali') || text.includes('overflow')) {
    score += 10;
    factors.push('Sanitation/drainage overflow with public hygiene risk.');
  }

  score = Math.min(100, Math.max(0, score));

  let recommendedPriority = 'Medium';
  if (issue.aiAnalysis?.requiresHumanReview) {
    recommendedPriority = 'Needs Review';
  } else if (score >= 75) {
    recommendedPriority = 'Critical';
  } else if (score >= 60) {
    recommendedPriority = 'High';
  } else if (score < 40) {
    recommendedPriority = 'Low';
  }

  return {
    score,
    recommendedPriority,
    factors: factors.length > 0 ? factors : ['Standard routine civic priority queue.']
  };
}

module.exports = {
  calculateExplainablePriority
};

