const mongoose = require('mongoose');

/**
 * ConversationSession - Multi-turn AI conversation session for SwachhMap AI 2.0
 * Fully tracks conversation history, civic complaint context, GPS location state,
 * image verification, and language preferences.
 */

const messageSchema = new mongoose.Schema({
  role: {
    type: String,
    enum: ['user', 'assistant', 'system'],
    required: true
  },
  content: {
    type: String,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  messageId: {
    type: String,
    default: () => `msg_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`
  },
  source: {
    type: String,
    default: 'text' // 'voice', 'text', 'gemini', 'rule_based', 'system'
  },
  audioDataUrl: {
    type: String,
    default: null
  }
}, { _id: false });

const complaintContextSchema = new mongoose.Schema({
  // Core complaint details
  title: { type: String, default: '' },
  waste_category: { type: String, default: '' },
  wasteTypes: { type: [String], default: [] },
  waste_composition: { type: String, default: '' },
  problem_description: { type: String, default: '' },
  citizen_description: { type: String, default: '' },
  area_type: { type: String, default: '' },
  site_details: { type: String, default: '' },
  duration: { type: String, default: '' },
  frequency: { type: String, default: '' },
  severity: { type: String, default: '' },
  odour_hazard: { type: String, default: '' },
  previously_reported: { type: String, default: '' },
  accumulation_size: { type: String, default: '' },

  // Location details
  is_at_location: { type: Boolean, default: null },
  locationPermissionStatus: {
    type: String,
    enum: ['not_asked', 'asked', 'granted', 'denied', 'not_at_location'],
    default: 'not_asked'
  },
  locationSource: {
    type: String,
    enum: ['gps', 'manual', 'map_pin', 'none'],
    default: 'none'
  },
  latitude: { type: Number, default: null },
  longitude: { type: Number, default: null },
  confirmedAddress: { type: String, default: '' },
  locationVerified: { type: Boolean, default: false }, // true only for GPS / map-pin; typed addresses are unverified
  photoSkipped: { type: Boolean, default: false },
  submitting: { type: Boolean, default: false },
  landmark: { type: String, default: '' },

  // Image & YOLO11n verification
  imageUrl: { type: String, default: '' },
  imageVerificationStatus: {
    type: String,
    enum: ['none', 'pending', 'verified', 'rejected'],
    default: 'none'
  },
  yoloDetections: { type: Array, default: [] },
  annotatedImageUrl: { type: String, default: '' },

  // Submission state
  stage: {
    type: String,
    enum: [
      'greeting',
      'problem_discovery',
      'waste_composition',
      'area_type',
      'site_details',
      'duration',
      'duration_clarification',
      'frequency',
      'odour_hazard',
      'previously_reported',
      'details',
      'location_query',
      'location_permission',
      'landmark',
      'camera_request',
      'image_request',
      'image_verifying',
      'summary_confirmation',
      'submitted',
      'cancelled'
    ],
    default: 'greeting'
  },
  cameraCaptured: { type: Boolean, default: false },
  is_confirmed_by_user: { type: Boolean, default: false },
  is_complete: { type: Boolean, default: false },
  currentQuestionKey: { type: String, default: 'problem_discovery' },
  askedQuestions: { type: [String], default: [] },
  additionalRemarks: { type: [String], default: [] },
  complaintId: { type: String, default: '' },
  summary: { type: String, default: '' },
  missing_information: { type: [String], default: [] }
}, { _id: false });

const conversationSessionSchema = new mongoose.Schema({
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
    default: null
  },
  languageHistory: { type: [String], default: [] },
  status: {
    type: String,
    enum: ['active', 'completed', 'reset'],
    default: 'active'
  },
  turnCount: {
    type: Number,
    default: 0
  },
  messages: [messageSchema],
  complaintContext: {
    type: complaintContextSchema,
    default: () => ({})
  },
  pendingQuestions: {
    type: [String],
    default: []
  },
  // Compressed context summary for sessions exceeding 15+ turns
  contextSummary: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

// TTL index: automatically delete completed sessions after 48 hours
conversationSessionSchema.index(
  { updatedAt: 1 },
  {
    expireAfterSeconds: 172800,
    partialFilterExpression: { status: 'completed' }
  }
);

const RealConversationSession = mongoose.model('ConversationSession', conversationSessionSchema);

// ── In-Memory Session Store (used when MongoDB is disconnected or in memory-mode) ──
const inMemorySessions = [];

function getNested(obj, path) {
  return path.split('.').reduce((acc, part) => (acc == null ? acc : acc[part]), obj);
}

function setNested(obj, path, val) {
  const parts = path.split('.');
  let curr = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    curr[parts[i]] = curr[parts[i]] || {};
    curr = curr[parts[i]];
  }
  curr[parts[parts.length - 1]] = val;
}

function matchesQuery(doc, query) {
  return Object.entries(query).every(([k, v]) => {
    const val = getNested(doc, k);
    if (v && typeof v === 'object' && '$ne' in v) {
      return val !== v.$ne;
    }
    return val === v;
  });
}

class InMemoryConversationSession {
  constructor(data = {}) {
    Object.assign(this, {
      status: 'active',
      turnCount: 0,
      messages: [],
      languageHistory: [],
      ...data
    });
    this.complaintContext = {
      stage: 'problem_discovery',
      currentQuestionKey: 'problem',
      askedQuestions: [],
      additionalRemarks: [],
      ...(data.complaintContext || {})
    };
    if (!this._id) {
      this._id = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    }
  }

  async save() {
    const idx = inMemorySessions.findIndex(s => s.sessionId === this.sessionId);
    if (idx >= 0) {
      inMemorySessions[idx] = this;
    } else {
      inMemorySessions.push(this);
    }
    return this;
  }

  toObject() {
    return JSON.parse(JSON.stringify(this));
  }

  static async findOne(query) {
    const found = inMemorySessions.find(s => matchesQuery(s, query));
    return found ? Object.assign(new InMemoryConversationSession(), found) : null;
  }

  static async findOneAndUpdate(query, update, options) {
    const found = inMemorySessions.find(s => matchesQuery(s, query));
    if (!found) return null;
    if (update.$set) {
      Object.entries(update.$set).forEach(([k, v]) => setNested(found, k, v));
    }
    return Object.assign(new InMemoryConversationSession(), found);
  }

  static async updateOne(query, update) {
    const found = inMemorySessions.find(s => matchesQuery(s, query));
    if (!found) return { matchedCount: 0, modifiedCount: 0 };
    if (update.$set) {
      Object.entries(update.$set).forEach(([k, v]) => setNested(found, k, v));
    }
    if (update.$push) {
      Object.entries(update.$push).forEach(([k, v]) => {
        const arr = getNested(found, k) || [];
        arr.push(v);
        setNested(found, k, arr);
      });
    }
    if (update.$inc) {
      Object.entries(update.$inc).forEach(([k, v]) => {
        setNested(found, k, (getNested(found, k) || 0) + v);
      });
    }
    return { matchedCount: 1, modifiedCount: 1 };
  }
}

const isDbConnected = () => Boolean(mongoose.connection && mongoose.connection.readyState === 1);

function ConversationSessionProxy(data) {
  if (isDbConnected()) {
    try {
      return new RealConversationSession(data);
    } catch (_) {}
  }
  return new InMemoryConversationSession(data);
}

// Attach prototype so instanceof checks succeed
ConversationSessionProxy.prototype = RealConversationSession.prototype;

// Static methods with transparent fallback
ConversationSessionProxy.findOne = async function(...args) {
  if (isDbConnected()) {
    try {
      return await RealConversationSession.findOne(...args);
    } catch (_) {}
  }
  return InMemoryConversationSession.findOne(...args);
};

ConversationSessionProxy.findOneAndUpdate = async function(...args) {
  if (isDbConnected()) {
    try {
      return await RealConversationSession.findOneAndUpdate(...args);
    } catch (_) {}
  }
  return InMemoryConversationSession.findOneAndUpdate(...args);
};

ConversationSessionProxy.updateOne = async function(...args) {
  if (isDbConnected()) {
    try {
      return await RealConversationSession.updateOne(...args);
    } catch (_) {}
  }
  return InMemoryConversationSession.updateOne(...args);
};

ConversationSessionProxy.schema = conversationSessionSchema;

module.exports = ConversationSessionProxy;
