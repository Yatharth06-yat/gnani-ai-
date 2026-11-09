const mongoose = require('mongoose');
const Issue = require('../models/Issue');
const { uploadToCloudinary, deleteFromCloudinary } = require('../utils/cloudinary');
const aiServiceClient = require('../services/ai/aiService');
const { findPotentialDuplicates } = require('../services/complaints/duplicateService');
const { calculateExplainablePriority } = require('../services/complaints/priorityService');

const isDbConnected = () => Boolean(mongoose.connection && mongoose.connection.readyState === 1);

// Demo issues dataset initialized with SwachhMap AI 2.0 evidence structures
const demoIssues = [
  {
    _id: '1',
    complaintId: 'SWM-2026-001',
    title: 'Plastic & Household Waste Accumulation',
    description: 'Severe accumulation of plastic bottles and mixed garbage on the roadside near Central Market.',
    category: 'Garbage',
    status: 'Reported',
    priority: 'High',
    location: {
      address: 'Central Market Road, Sector 4',
      coordinates: [77.2090, 28.6139],
      lat: 28.6139,
      lng: 77.2090
    },
    imageUrl: 'https://images.unsplash.com/photo-1532996122724-e3c354a0b15b?w=500',
    reportedBy: {
      _id: '1',
      name: 'Yatharth Gupta',
      email: 'yatharth@swachhmap.org'
    },
    aiAnalysis: {
      cnnPrediction: 'garbage_present',
      cnnProbability: 0.94,
      cnnThreshold: 0.67,
      yoloDetections: [
        { class_name: 'plastic_bottle', confidence: 0.92, bbox: [120, 80, 240, 290] },
        { class_name: 'plastic_bag', confidence: 0.88, bbox: [260, 140, 420, 310] }
      ],
      totalObjects: 2,
      modelAgreement: 'supporting',
      evidenceSummary: [
        'CNN confirms garbage accumulation (p=0.94 >= 0.67).',
        'YOLO localized 2 plastic waste objects with high confidence.'
      ],
      uncertainties: [],
      requiresHumanReview: false,
      analyzedAt: new Date('2026-11-01T10:00:00Z')
    },
    duplicateInfo: {
      isSuspectedDuplicate: false,
      linkedReportIds: [],
      duplicateReasons: []
    },
    priorityExplanation: {
      score: 85,
      recommendedPriority: 'High',
      factors: [
        'Strong visual confirmation by CNN (94%) and YOLO object localization.',
        'Located near high-traffic public commercial market zone.'
      ]
    },
    resolutionVerification: {
      status: 'Not Submitted',
      afterImageUrl: '',
      residualWasteDetected: false
    },
    createdAt: new Date('2026-11-01T09:30:00Z'),
    updatedAt: new Date('2026-11-01T09:30:00Z')
  },
  {
    _id: '2',
    complaintId: 'SWM-2026-002',
    title: 'Garbage Bin Overflow Near Public School',
    description: 'Municipal garbage bin overflowing into sidewalk opposite Government Primary School.',
    category: 'Sanitation',
    status: 'In-progress',
    priority: 'Critical',
    location: {
      address: 'Opposite Government Primary School, Block B',
      coordinates: [77.2100, 28.6150],
      lat: 28.6150,
      lng: 77.2100
    },
    imageUrl: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=500',
    reportedBy: {
      _id: '2',
      name: 'Rohan Sharma',
      email: 'rohan@example.com'
    },
    aiAnalysis: {
      cnnPrediction: 'garbage_present',
      cnnProbability: 0.89,
      cnnThreshold: 0.67,
      yoloDetections: [
        { class_name: 'food_waste', confidence: 0.85, bbox: [90, 110, 200, 240] },
        { class_name: 'mixed_garbage', confidence: 0.79, bbox: [210, 160, 380, 320] }
      ],
      totalObjects: 2,
      modelAgreement: 'supporting',
      evidenceSummary: [
        'CNN confirmed waste presence (p=0.89).',
        'YOLO detected organic and mixed garbage candidates.'
      ],
      uncertainties: [],
      requiresHumanReview: false,
      analyzedAt: new Date('2026-11-02T11:15:00Z')
    },
    duplicateInfo: {
      isSuspectedDuplicate: true,
      linkedReportIds: ['1'],
      duplicateReasons: ['Located within 140m of SWM-2026-001']
    },
    priorityExplanation: {
      score: 92,
      recommendedPriority: 'Critical',
      factors: [
        'Sensitive educational landmark: Directly opposite Government Primary School.',
        'High organic waste content with public health risk.'
      ]
    },
    resolutionVerification: {
      status: 'Awaiting Verification',
      afterImageUrl: '',
      residualWasteDetected: false
    },
    createdAt: new Date('2026-11-02T10:45:00Z'),
    updatedAt: new Date('2026-11-02T14:20:00Z')
  },
  {
    _id: '3',
    complaintId: 'SWM-2026-003',
    title: 'Construction Debris & Broken Masonry on Highway',
    description: 'Piles of cement blocks, bricks, and plaster dumped along Highway service road.',
    category: 'Infrastructure',
    status: 'Resolved',
    priority: 'Medium',
    location: {
      address: 'National Highway Service Lane, Mile 14',
      coordinates: [77.2080, 28.6120],
      lat: 28.6120,
      lng: 77.2080
    },
    imageUrl: 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=500',
    reportedBy: {
      _id: '1',
      name: 'Yatharth Gupta',
      email: 'yatharth@swachhmap.org'
    },
    aiAnalysis: {
      cnnPrediction: 'garbage_present',
      cnnProbability: 0.78,
      cnnThreshold: 0.67,
      yoloDetections: [
        { class_name: 'construction_debris', confidence: 0.84, bbox: [100, 100, 350, 300] }
      ],
      totalObjects: 1,
      modelAgreement: 'supporting',
      evidenceSummary: ['Construction debris localized and classified.'],
      uncertainties: [],
      requiresHumanReview: false
    },
    duplicateInfo: {
      isSuspectedDuplicate: false,
      linkedReportIds: [],
      duplicateReasons: []
    },
    priorityExplanation: {
      score: 55,
      recommendedPriority: 'Medium',
      factors: ['Construction debris causing partial shoulder obstruction.']
    },
    resolutionVerification: {
      status: 'Verified',
      afterImageUrl: 'https://images.unsplash.com/photo-1517649763962-0c623266ddc0?w=500',
      cnnProbability: 0.12,
      yoloDetections: [],
      residualWasteDetected: false,
      adminDecision: 'Approved',
      verifiedAt: new Date('2026-11-03T16:00:00Z'),
      notes: 'Debris completely cleared by municipal road team.'
    },
    createdAt: new Date('2026-10-28T08:00:00Z'),
    updatedAt: new Date('2026-11-03T16:00:00Z')
  }
];

function getDemoIssues() {
  return demoIssues;
}

function generateComplaintId() {
  const year = new Date().getFullYear();
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `SWM-${year}-${rand}`;
}

// Get all issues
const getAllIssues = async (req, res) => {
  try {
    let issues = demoIssues;
    if (isDbConnected()) {
      try {
        const found = await Issue.find()
          .populate('reportedBy', 'name email')
          .populate('assignedTo', 'name email')
          .sort({ createdAt: -1 })
          .lean();

        if (found && found.length > 0) {
          issues = found;
        }
      } catch (dbError) {
        issues = demoIssues;
      }
    }

    // Harmonize location object coordinates for Leaflet
    const harmonized = issues.map((issue) => {
      let lat = 28.6139;
      let lng = 77.2090;
      if (issue.location) {
        if (issue.location.lat != null && issue.location.lng != null) {
          lat = Number(issue.location.lat);
          lng = Number(issue.location.lng);
        } else if (Array.isArray(issue.location.coordinates)) {
          lng = Number(issue.location.coordinates[0]);
          lat = Number(issue.location.coordinates[1]);
        }
      }
      return {
        ...issue,
        location: {
          lat,
          lng,
          address: issue.location?.address || 'Reported Location'
        }
      };
    });

    res.json({
      success: true,
      count: harmonized.length,
      data: harmonized
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get user's reports
const getMyReports = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id || '1';
    let userIssues = demoIssues.filter(i => String(i.reportedBy?._id) === String(userId) || i.reportedBy?.name === 'Yatharth Gupta');

    if (isDbConnected()) {
      try {
        const found = await Issue.find({ reportedBy: userId })
          .populate('reportedBy', 'name email')
          .sort({ createdAt: -1 })
          .lean();

        if (req.user) {
          userIssues = found || [];
        } else if (found && found.length > 0) {
          userIssues = found;
        }
      } catch (dbError) {
        // Fall back to filtered demoIssues
      }
    }

    // Harmonize location
    const harmonized = userIssues.map((issue) => {
      let lat = 28.6139;
      let lng = 77.2090;
      if (issue.location) {
        if (issue.location.lat != null && issue.location.lng != null) {
          lat = Number(issue.location.lat);
          lng = Number(issue.location.lng);
        } else if (Array.isArray(issue.location.coordinates)) {
          lng = Number(issue.location.coordinates[0]);
          lat = Number(issue.location.coordinates[1]);
        }
      }
      return {
        ...issue,
        location: {
          lat,
          lng,
          coordinates: [lng, lat],
          type: 'Point',
          address: issue.location?.address || 'Reported Location'
        }
      };
    });

    res.json({
      success: true,
      count: harmonized.length,
      data: harmonized
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Create new issue with multimodal AI analysis
const createIssue = async (req, res) => {
  try {
    console.log('📝 POST /api/issues - Processing new complaint submission...');
    const { title, description, category, voiceTranscript, voiceSessionId } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, message: 'Title is required' });
    }
    if (!description || !description.trim()) {
      return res.status(400).json({ success: false, message: 'Description is required' });
    }

    // Parse location
    let locationData = { lat: 28.6139, lng: 77.2090, address: '' };
    try {
      if (typeof req.body.location === 'string') {
        locationData = JSON.parse(req.body.location);
      } else if (req.body.location && typeof req.body.location === 'object') {
        locationData = req.body.location;
      }
    } catch (e) {
      return res.status(400).json({ success: false, message: 'Invalid location JSON' });
    }

    const lat = Number(locationData.lat || locationData.latitude);
    const lng = Number(locationData.lng || locationData.longitude);

    if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return res.status(400).json({ success: false, message: 'Valid GPS latitude and longitude are required' });
    }

    const complaintId = generateComplaintId();

    // Image handling & MANDATORY SERVER-SIDE YOLO11n VALIDATION
    const imageBuffer = req.file?.buffer;
    if (!imageBuffer) {
      return res.status(400).json({
        success: false,
        error: 'IMAGE_REQUIRED',
        message: 'Image upload is mandatory. An image of the garbage must be provided and verified before submitting.'
      });
    }

    // Run independent fresh YOLO11n validation on the exact submitted image
    console.log('🤖 Running server-side YOLO11n validation on submitted image...');
    const yoloValidation = await aiServiceClient.detectObjects(imageBuffer, null, 0.25);
    
    if (!yoloValidation.garbage_detected || !yoloValidation.total_objects || yoloValidation.total_objects === 0) {
      console.warn('❌ Server-side YOLO11n validation rejected: No supported garbage detected.');
      return res.status(400).json({
        success: false,
        error: 'NO_GARBAGE_DETECTED',
        message: 'AI Validation Failed: We couldn\'t identify garbage in this image. Please upload a clearer image showing the garbage.',
        validation: yoloValidation
      });
    }

    console.log(`✅ Server-side YOLO11n validation passed: ${yoloValidation.total_objects} garbage object(s) detected.`);

    let imageUrl = '';
    try {
      if (process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_KEY !== 'your_cloudinary_api_key') {
        const cloudResult = await uploadToCloudinary(imageBuffer);
        imageUrl = cloudResult.secure_url;
      } else {
        imageUrl = `data:${req.file.mimetype};base64,${imageBuffer.toString('base64')}`;
      }
    } catch (uploadErr) {
      console.warn('Image upload fallback to data URL:', uploadErr.message);
      imageUrl = `data:${req.file.mimetype};base64,${imageBuffer.toString('base64')}`;
    }

    // Multimodal AI Evidence Analysis via FastAPI
    let aiAnalysisResult = {
      cnnPrediction: 'pending',
      cnnProbability: 0,
      totalObjects: 0,
      yoloDetections: [],
      modelAgreement: 'pending',
      evidenceSummary: ['Analysis pending'],
      uncertainties: [],
      requiresHumanReview: false
    };

    if (imageBuffer) {
      try {
        const aiResponse = await aiServiceClient.analyzeMultimodalEvidence({
          imageBuffer,
          complaintId,
          transcript: voiceTranscript || description,
          coordinates: { lat, lng },
          category: category || 'Garbage'
        });

        if (aiResponse) {
          aiAnalysisResult = {
            cnnPrediction: aiResponse.cnn_result?.prediction || 'pending',
            cnnProbability: aiResponse.cnn_result?.probability || 0,
            cnnThreshold: 0.67,
            totalObjects: aiResponse.yolo_result?.total_objects || 0,
            yoloDetections: (aiResponse.yolo_result?.detections || []).map(d => ({
              class_name: d.class_name,
              confidence: d.confidence,
              bbox: d.bbox
            })),
            modelAgreement: aiResponse.agreement || 'pending',
            evidenceSummary: aiResponse.evidence_summary || [],
            uncertainties: aiResponse.uncertainties || [],
            requiresHumanReview: Boolean(aiResponse.requires_human_review),
            analyzedAt: new Date()
          };
        }
      } catch (aiErr) {
        console.warn('⚠️ AI analysis during createIssue error:', aiErr.message);
      }
    }

    // Duplicate detection against existing issues
    const allExisting = await (async () => {
      try {
        const found = await Issue.find().lean();
        if (found && found.length > 0) return found;
      } catch (e) {}
      return demoIssues;
    })();

    const duplicateCheck = findPotentialDuplicates(
      { location: { lat, lng }, title, description, category, voiceTranscript },
      allExisting
    );

    // Explainable Prioritization Calculation
    const priorityCalc = calculateExplainablePriority(
      { title, description, category, aiAnalysis: aiAnalysisResult, createdAt: new Date() },
      duplicateCheck.duplicateCount
    );

    const validLinkedIds = (duplicateCheck.candidates || [])
      .map(c => c.issueId)
      .filter(id => mongoose.isValidObjectId(id));

    const newIssuePayload = {
      complaintId,
      title: title.trim(),
      description: description.trim(),
      category: category || 'Garbage',
      status: 'Reported',
      priority: priorityCalc.recommendedPriority,
      location: {
        type: 'Point',
        coordinates: [lng, lat],
        lat,
        lng,
        address: locationData.address || 'GPS Tagged'
      },
      imageUrl,
      voiceTranscript: voiceTranscript || '',
      voiceSessionId: voiceSessionId || '',
      aiAnalysis: aiAnalysisResult,
      duplicateInfo: {
        isSuspectedDuplicate: duplicateCheck.isSuspectedDuplicate,
        linkedReportIds: validLinkedIds,
        duplicateReasons: duplicateCheck.candidates.map(c => c.reason),
        confirmedByAdmin: false
      },
      priorityExplanation: {
        score: priorityCalc.score,
        recommendedPriority: priorityCalc.recommendedPriority,
        factors: priorityCalc.factors
      },
      resolutionVerification: {
        status: 'Not Submitted',
        afterImageUrl: '',
        residualWasteDetected: false
      },
      reportedBy: {
        _id: req.user?._id || '1',
        name: req.user?.name || 'Citizen Reporter',
        email: req.user?.email || 'citizen@swachhmap.org'
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Resolve reporter ID for database persistence
    let reporterId = req.user?._id;
    if (!reporterId && isDbConnected()) {
      const citizenUser = await User.findOne({ role: 'citizen' });
      if (citizenUser) {
        reporterId = citizenUser._id;
      }
    }

    // Save to MongoDB if available
    try {
      const dbIssue = new Issue({
        ...newIssuePayload,
        reportedBy: reporterId
      });
      await dbIssue.save();
      console.log('✅ Issue persisted in MongoDB:', dbIssue.complaintId, 'ID:', dbIssue._id);
      newIssuePayload._id = dbIssue._id;
      newIssuePayload.id = dbIssue._id;
    } catch (dbErr) {
      console.warn('Database save fallback to in-memory store:', dbErr.message);
      newIssuePayload._id = `demo-${Date.now()}`;
      newIssuePayload.id = newIssuePayload._id;
      demoIssues.unshift(newIssuePayload);
    }

    res.status(201).json({
      success: true,
      data: newIssuePayload,
      message: 'Complaint submitted and analyzed with multimodal AI intelligence!'
    });
  } catch (error) {
    console.error('❌ Error creating issue:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update issue status / details
const updateIssue = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, priority, adminNotes } = req.body;

    // FORBID DIRECT RESOLUTION WITHOUT IMAGE VERIFICATION
    if (status && status.toLowerCase() === 'resolved') {
      return res.status(400).json({
        success: false,
        error: 'RESOLUTION_VERIFICATION_REQUIRED',
        message: 'Security Policy: Complaints cannot be marked as resolved directly. An after-cleaning photograph must be uploaded and verified via the Administrative Resolution Verification workflow.'
      });
    }

    let updated = null;
    try {
      updated = await Issue.findByIdAndUpdate(
        id,
        { $set: { ...req.body, updatedAt: new Date() } },
        { new: true }
      ).populate('reportedBy', 'name email');
    } catch (dbError) {
      const idx = demoIssues.findIndex(i => String(i._id) === String(id) || i.complaintId === id);
      if (idx !== -1) {
        demoIssues[idx] = { ...demoIssues[idx], ...req.body, updatedAt: new Date() };
        updated = demoIssues[idx];
      }
    }

    if (!updated) {
      return res.status(404).json({ success: false, message: 'Issue not found' });
    }

    res.json({
      success: true,
      data: updated,
      message: `Issue updated successfully!`
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Verify Resolution with after-cleaning photo
const verifyResolution = async (req, res) => {
  try {
    const { id } = req.params;
    const { adminDecision, notes } = req.body;
    const afterFileBuffer = req.file?.buffer;

    let issue = null;
    try {
      issue = await Issue.findById(id);
    } catch (e) {
      issue = demoIssues.find(i => String(i._id) === String(id) || i.complaintId === id);
    }

    if (!issue) {
      return res.status(404).json({ success: false, message: 'Complaint not found for verification' });
    }

    let afterImageUrl = '';
    if (afterFileBuffer) {
      afterImageUrl = `data:${req.file.mimetype};base64,${afterFileBuffer.toString('base64')}`;
    }

    // Run AI verification comparison
    const verificationAI = await aiServiceClient.verifyResolution({
      complaintId: issue.complaintId || issue._id,
      afterBuffer: afterFileBuffer,
      beforeBase64: issue.imageUrl?.startsWith('data:') ? issue.imageUrl : null
    });

    const residualWaste = Boolean(verificationAI.residual_waste_detected);
    
    // STRICT SECURITY RULE: If garbage is still detected by AI, resolution MUST be rejected
    let finalDecision = 'Rejected';
    let newStatus = 'Verification Rejected';

    if (residualWaste) {
      finalDecision = 'Rejected';
      newStatus = 'Verification Rejected';
    } else {
      finalDecision = adminDecision || 'Approved';
      newStatus = finalDecision === 'Approved' ? 'Resolved' : 'In-progress';
    }

    const verificationRecord = {
      status: finalDecision === 'Approved' ? 'Verified' : 'Rejected',
      afterImageUrl: afterImageUrl || issue.resolutionVerification?.afterImageUrl || '',
      cnnProbability: verificationAI.after_status?.cnn_probability || 0,
      yoloDetections: verificationAI.after_status?.detections || [],
      residualWasteDetected: residualWaste,
      adminDecision: finalDecision,
      notes: notes || verificationAI.explanation?.join('; ') || '',
      verifiedAt: new Date()
    };

    try {
      issue.resolutionVerification = verificationRecord;
      issue.status = newStatus;
      issue.resolvedAt = finalDecision === 'Approved' ? new Date() : null;
      await issue.save();
    } catch (dbErr) {
      issue.resolutionVerification = verificationRecord;
      issue.status = newStatus;
      issue.resolvedAt = finalDecision === 'Approved' ? new Date() : null;
    }

    res.json({
      success: true,
      data: {
        issueId: issue._id,
        status: issue.status,
        resolutionVerification: verificationRecord,
        aiRecommendation: verificationAI.recommendation,
        explanation: verificationAI.explanation
      },
      message: `Resolution verification recorded: ${finalDecision}`
    });
  } catch (error) {
    console.error('❌ verifyResolution error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Delete issue
const deleteIssue = async (req, res) => {
  try {
    const { id } = req.params;
    let deleted = false;

    try {
      const res = await Issue.findByIdAndDelete(id);
      if (res) deleted = true;
    } catch (dbErr) {
      const idx = demoIssues.findIndex(i => String(i._id) === String(id) || i.complaintId === id);
      if (idx !== -1) {
        demoIssues.splice(idx, 1);
        deleted = true;
      }
    }

    res.json({
      success: true,
      message: deleted ? 'Issue deleted successfully' : 'Issue not found'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get admin stats
const getAdminStats = async (req, res) => {
  try {
    let totalIssues, reportedIssues, inProgressIssues, resolvedIssues, awaitingVerification;
    let categoryStats = [];

    if (isDbConnected()) {
      try {
        totalIssues = await Issue.countDocuments();
        reportedIssues = await Issue.countDocuments({ status: 'Reported' });
        inProgressIssues = await Issue.countDocuments({ status: 'In-progress' });
        resolvedIssues = await Issue.countDocuments({ status: 'Resolved' });
        awaitingVerification = await Issue.countDocuments({ 'resolutionVerification.status': 'Awaiting Verification' });

        categoryStats = await Issue.aggregate([
          { $group: { _id: '$category', count: { $sum: 1 } } }
        ]);
      } catch (dbError) {
        // Fall through to demo stats calculation
      }
    }

    if (totalIssues == null) {
      totalIssues = demoIssues.length;
      reportedIssues = demoIssues.filter(i => i.status === 'Reported').length;
      inProgressIssues = demoIssues.filter(i => i.status === 'In-progress').length;
      resolvedIssues = demoIssues.filter(i => i.status === 'Resolved').length;
      awaitingVerification = demoIssues.filter(i => i.resolutionVerification?.status === 'Awaiting Verification').length;

      const counts = {};
      demoIssues.forEach(i => {
        counts[i.category] = (counts[i.category] || 0) + 1;
      });
      categoryStats = Object.keys(counts).map(k => ({ _id: k, count: counts[k] }));
    }

    res.json({
      success: true,
      data: {
        totalIssues,
        reportedIssues,
        inProgressIssues,
        resolvedIssues,
        awaitingVerification,
        categoryStats
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getAllIssues,
  getMyReports,
  createIssue,
  updateIssue,
  verifyResolution,
  deleteIssue,
  getAdminStats,
  getDemoIssues
};
