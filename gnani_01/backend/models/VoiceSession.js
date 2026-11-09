const mongoose = require('mongoose');

const clarificationItemSchema = new mongoose.Schema({
  question: { type: String, required: true },
  answer: { type: String, default: '' },
  timestamp: { type: Date, default: Date.now }
}, { _id: false });

const voiceSessionSchema = new mongoose.Schema({
  sessionId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  citizenId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  language: {
    type: String,
    default: 'hi-IN'
  },
  rawAudioMime: {
    type: String,
    default: 'audio/webm'
  },
  transcript: {
    type: String,
    default: ''
  },
  extractedInformation: {
    summary: { type: String, default: '' },
    waste_category: { type: String, default: 'mixed_waste' },
    location_description: { type: String, default: '' },
    severity: { type: String, default: 'medium' },
    duration: { type: String, default: 'unknown' },
    missing_information: [String],
    clarification_required: { type: Boolean, default: false },
    uncertainties: [String],
    confidence: { type: Number, default: 0.0 }
  },
  clarificationHistory: [clarificationItemSchema],
  confirmationStatus: {
    type: String,
    enum: ['in_progress', 'awaiting_clarification', 'clarified', 'confirmed', 'cancelled', 'submitted'],
    default: 'in_progress'
  },
  associatedComplaintId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Issue',
    default: null
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('VoiceSession', voiceSessionSchema);

