const VALID_WASTE_CATEGORIES = [
  'plastic_waste',
  'food_waste',
  'paper_cardboard',
  'construction_debris',
  'mixed_waste',
  'hazardous_waste',
  'sanitation_overflow',
  'other'
];

const VALID_SEVERITIES = ['low', 'medium', 'high', 'critical'];

function validateStructuredComplaint(raw) {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Complaint extraction output must be a valid JSON object');
  }

  const sanitized = {
    summary: typeof raw.summary === 'string' && raw.summary.trim() ? raw.summary.trim() : 'Garbage accumulation reported',
    waste_category: VALID_WASTE_CATEGORIES.includes(raw.waste_category) ? raw.waste_category : 'mixed_waste',
    location_description: typeof raw.location_description === 'string' ? raw.location_description.trim() : '',
    duration: typeof raw.duration === 'string' ? raw.duration.trim() : 'unknown',
    severity: VALID_SEVERITIES.includes(raw.severity) ? raw.severity : 'medium',
    missing_information: Array.isArray(raw.missing_information) ? raw.missing_information.map(String) : [],
    clarification_required: Boolean(raw.clarification_required),
    clarification_question: typeof raw.clarification_question === 'string' ? raw.clarification_question.trim() : '',
    evidence_summary: Array.isArray(raw.evidence_summary) ? raw.evidence_summary.map(String) : [],
    uncertainties: Array.isArray(raw.uncertainties) ? raw.uncertainties.map(String) : [],
    suggested_priority_factors: Array.isArray(raw.suggested_priority_factors) ? raw.suggested_priority_factors.map(String) : []
  };

  return sanitized;
}

module.exports = {
  VALID_WASTE_CATEGORIES,
  VALID_SEVERITIES,
  validateStructuredComplaint
};

