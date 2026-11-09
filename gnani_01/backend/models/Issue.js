const mongoose = require('mongoose');

const issueSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Title is required'],
    trim: true,
    maxlength: [100, 'Title cannot be more than 100 characters']
  },
  description: {
    type: String,
    required: [true, 'Description is required'],
    trim: true,
    maxlength: [1000, 'Description cannot be more than 1000 characters']
  },
  category: {
    type: String,
    required: [true, 'Category is required'],
    enum: ['Infrastructure', 'Sanitation', 'Garbage', 'Water', 'Electricity', 'Roads', 'Other'],
    default: 'Other'
  },
  status: {
    type: String,
    enum: [
      'Reported',
      'Pending',
      'Under Review',
      'In-progress',
      'Awaiting Verification',
      'Resolved',
      'Rejected',
      'Verification Rejected'
    ],
    default: 'Reported'
  },
  priority: {
    type: String,
    enum: ['Low', 'Medium', 'High', 'Critical', 'Needs Review'],
    default: 'Medium'
  },
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      required: [true, 'Location coordinates are required']
    },
    address: {
      type: String,
      trim: true
    }
  },
  reportedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  imageUrl: {
    type: String,
    default: ''
  },
  complaintId: {
    type: String,
    trim: true,
    index: true
  },
  voiceTranscript: {
    type: String,
    default: ''
  },
  voiceSessionId: {
    type: String,
    default: ''
  },
  aiAnalysis: {
    cnnPrediction: { type: String, default: 'pending' },
    cnnProbability: { type: Number, default: 0 },
    cnnThreshold: { type: Number, default: 0.67 },
    yoloDetections: [{
      class: String,
      confidence: Number,
      bbox: [Number]
    }],
    totalObjects: { type: Number, default: 0 },
    modelAgreement: { type: String, default: 'pending' },
    evidenceSummary: [String],
    uncertainties: [String],
    requiresHumanReview: { type: Boolean, default: false },
    analyzedAt: { type: Date }
  },
  duplicateInfo: {
    isSuspectedDuplicate: { type: Boolean, default: false },
    linkedReportIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Issue' }],
    duplicateReasons: [String],
    confirmedByAdmin: { type: Boolean, default: false }
  },
  priorityExplanation: {
    score: { type: Number, default: 50 },
    recommendedPriority: { type: String, enum: ['Low', 'Medium', 'High', 'Critical', 'Needs Review'], default: 'Medium' },
    factors: [String]
  },
  resolutionVerification: {
    status: { type: String, enum: ['Not Submitted', 'Awaiting Verification', 'Verified', 'Rejected'], default: 'Not Submitted' },
    afterImageUrl: { type: String, default: '' },
    cnnProbability: { type: Number, default: 0 },
    yoloDetections: [{
      class: String,
      confidence: Number,
      bbox: [Number]
    }],
    residualWasteDetected: { type: Boolean, default: false },
    verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    verifiedAt: { type: Date, default: null },
    adminDecision: { type: String, enum: ['Approved', 'Rejected', 'Pending', 'None'], default: 'None' },
    notes: { type: String, default: '' }
  },
  resolvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  resolutionImage: {
    type: String,
    default: ''
  },
  resolutionNotes: {
    type: String,
    default: ''
  },
  verificationHistory: [{
    attemptId: { type: String, required: true },
    imageUrl: { type: String, default: '' },
    imageHash: { type: String, default: '' },
    garbageDetected: { type: Boolean, default: false },
    detections: [{
      class: String,
      confidence: Number,
      bbox: [Number]
    }],
    totalObjects: { type: Number, default: 0 },
    verificationPassed: { type: Boolean, default: false },
    modelVersion: { type: String, default: 'YOLO11n-Ultralytics' },
    verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    verifiedByName: { type: String, default: 'Administrator' },
    verifiedAt: { type: Date, default: Date.now },
    notes: { type: String, default: '' }
  }],
  images: [{
    url: String,
    publicId: String,
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  comments: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    text: {
      type: String,
      required: true,
      maxlength: [500, 'Comment cannot be more than 500 characters']
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  votes: {
    upvotes: [{
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      createdAt: {
        type: Date,
        default: Date.now
      }
    }],
    downvotes: [{
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      createdAt: {
        type: Date,
        default: Date.now
      }
    }]
  },
  resolvedAt: {
    type: Date,
    default: null
  },
  estimatedResolutionTime: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// Create geospatial index for location-based queries
issueSchema.index({ location: '2dsphere' });

// Index for efficient queries
issueSchema.index({ status: 1, createdAt: -1 });
issueSchema.index({ reportedBy: 1, createdAt: -1 });
issueSchema.index({ category: 1, status: 1 });

// Virtual for upvote count
issueSchema.virtual('upvoteCount').get(function() {
  return this.votes.upvotes.length;
});

// Virtual for downvote count
issueSchema.virtual('downvoteCount').get(function() {
  return this.votes.downvotes.length;
});

// Virtual for net votes
issueSchema.virtual('netVotes').get(function() {
  return this.votes.upvotes.length - this.votes.downvotes.length;
});

// Ensure virtual fields are serialized
issueSchema.set('toJSON', { virtuals: true });

const RealIssue = mongoose.model('Issue', issueSchema);

// ── In-Memory Issues Store (fallback when MongoDB is disconnected) ──
const inMemoryIssues = [];

class InMemoryIssue {
  constructor(data = {}) {
    Object.assign(this, {
      status: 'Reported',
      priority: 'Medium',
      category: 'Garbage',
      votes: { upvotes: [], downvotes: [] },
      ...data
    });
    if (!this._id) {
      this._id = `issue_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    }
  }

  async save() {
    const idx = inMemoryIssues.findIndex(i => (this.complaintId && i.complaintId === this.complaintId) || i._id === this._id);
    if (idx >= 0) inMemoryIssues[idx] = this;
    else inMemoryIssues.unshift(this);
    return this;
  }

  toObject() { return JSON.parse(JSON.stringify(this)); }
  toJSON() { return JSON.parse(JSON.stringify(this)); }
}

function makeIssueQuery(result) {
  return {
    select() { return this; },
    populate() { return this; },
    sort() { return this; },
    limit() { return this; },
    lean() { return this; },
    then(resolve, reject) { return Promise.resolve(result).then(resolve, reject); },
    catch(reject) { return Promise.resolve(result).catch(reject); }
  };
}

const isDbConnected = () => Boolean(mongoose.connection && mongoose.connection.readyState === 1);

function IssueProxy(data) {
  if (isDbConnected()) {
    try {
      return new RealIssue(data);
    } catch (_) {}
  }
  return new InMemoryIssue(data);
}

IssueProxy.prototype = RealIssue.prototype;

IssueProxy.findOne = function(query = {}) {
  if (isDbConnected()) {
    try {
      return RealIssue.findOne(query);
    } catch (_) {}
  }
  const found = inMemoryIssues.find(i => {
    if (query.complaintId && i.complaintId === query.complaintId) return true;
    if (query._id && String(i._id) === String(query._id)) return true;
    return false;
  });
  return makeIssueQuery(found ? Object.assign(new InMemoryIssue(), found) : null);
};

IssueProxy.findById = function(id) {
  return IssueProxy.findOne({ _id: id });
};

IssueProxy.find = function(query) {
  if (isDbConnected()) {
    try {
      return RealIssue.find(query);
    } catch (_) {}
  }
  return makeIssueQuery(inMemoryIssues);
};

IssueProxy.countDocuments = async function(query) {
  if (isDbConnected()) {
    try {
      return await RealIssue.countDocuments(query);
    } catch (_) {}
  }
  return inMemoryIssues.length;
};

IssueProxy.exists = async function(query) {
  if (isDbConnected()) {
    try {
      return await RealIssue.exists(query);
    } catch (_) {}
  }
  const found = inMemoryIssues.find(i => i.complaintId === query.complaintId);
  return found ? { _id: found._id } : null;
};

IssueProxy.schema = issueSchema;

module.exports = IssueProxy;