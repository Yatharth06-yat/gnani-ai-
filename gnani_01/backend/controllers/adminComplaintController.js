const mongoose = require('mongoose');
const Issue = require('../models/Issue');
const aiServiceClient = require('../services/ai/aiService');
const { uploadToCloudinary } = require('../utils/cloudinary');
const {
  computeImageHash,
  createVerificationRecord,
  validateAndConsumeToken
} = require('../services/verification/verificationSessionService');
const { getDemoIssues } = require('./issueController');

const isDbConnected = () => Boolean(mongoose.connection && mongoose.connection.readyState === 1);

/**
 * GET /api/admin/complaints
 * Comprehensive administrative complaint query with pagination, filters, and search
 */
const getAdminComplaints = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;

    const { status, category, priority, search, dateFrom, dateTo } = req.query;

    const query = {};

    if (status && status !== 'all') {
      // Case-insensitive status matching
      query.status = { $regex: new RegExp(`^${status.replace('-', '[- ]?')}$`, 'i') };
    }

    if (category && category !== 'all') {
      query.category = { $regex: new RegExp(`^${category}$`, 'i') };
    }

    if (priority && priority !== 'all') {
      query.priority = { $regex: new RegExp(`^${priority}$`, 'i') };
    }

    if (dateFrom || dateTo) {
      query.createdAt = {};
      if (dateFrom) query.createdAt.$gte = new Date(dateFrom);
      if (dateTo) query.createdAt.$lte = new Date(dateTo);
    }

    if (search && search.trim()) {
      const term = search.trim();
      query.$or = [
        { complaintId: { $regex: term, $options: 'i' } },
        { title: { $regex: term, $options: 'i' } },
        { description: { $regex: term, $options: 'i' } },
        { 'location.address': { $regex: term, $options: 'i' } }
      ];
    }

    let complaints = [];
    let total = 0;

    if (isDbConnected()) {
      total = await Issue.countDocuments(query);
      complaints = await Issue.find(query)
        .populate('reportedBy', 'name email phone')
        .populate('resolvedBy', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();
    } else {
      // In-memory demo fallback
      let all = getDemoIssues();
      if (status && status !== 'all') {
        all = all.filter(c => c.status.toLowerCase() === status.toLowerCase());
      }
      if (category && category !== 'all') {
        all = all.filter(c => c.category.toLowerCase() === category.toLowerCase());
      }
      if (search && search.trim()) {
        const t = search.trim().toLowerCase();
        all = all.filter(c => 
          (c.title && c.title.toLowerCase().includes(t)) ||
          (c.complaintId && c.complaintId.toLowerCase().includes(t))
        );
      }
      total = all.length;
      complaints = all.slice(skip, skip + limit);
    }

    // Compute admin summary statistics
    const stats = {
      total,
      pending: isDbConnected() ? await Issue.countDocuments({ status: { $in: ['Reported', 'Pending', 'pending'] } }) : complaints.filter(c => c.status === 'Reported').length,
      underReview: isDbConnected() ? await Issue.countDocuments({ status: { $in: ['Under Review', 'In-progress', 'in_progress'] } }) : complaints.filter(c => c.status === 'In-progress').length,
      awaitingVerification: isDbConnected() ? await Issue.countDocuments({ status: { $in: ['Awaiting Verification', 'awaiting_verification'] } }) : 0,
      resolved: isDbConnected() ? await Issue.countDocuments({ status: { $in: ['Resolved', 'resolved'] } }) : complaints.filter(c => c.status === 'Resolved').length,
      verificationRejected: isDbConnected() ? await Issue.countDocuments({ status: { $in: ['Verification Rejected', 'Rejected'] } }) : 0
    };

    res.json({
      success: true,
      data: complaints,
      stats,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1
      }
    });
  } catch (error) {
    console.error('❌ getAdminComplaints error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /api/admin/complaints/:id
 */
const getAdminComplaintById = async (req, res) => {
  try {
    const { id } = req.params;
    let complaint = null;

    if (isDbConnected()) {
      complaint = await Issue.findOne({
        $or: [{ _id: mongoose.isValidObjectId(id) ? id : null }, { complaintId: id }]
      })
      .populate('reportedBy', 'name email phone')
      .populate('resolvedBy', 'name email')
      .populate('verificationHistory.verifiedBy', 'name email')
      .lean();
    } else {
      complaint = getDemoIssues().find(c => c._id === id || c.complaintId === id);
    }

    if (!complaint) {
      return res.status(404).json({ success: false, message: 'Complaint not found' });
    }

    res.json({ success: true, data: complaint });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * PATCH /api/admin/complaints/:id/status
 * Updates non-resolved operational status.
 * MANDATORY SECURITY RULE: Cannot mark as 'Resolved' through this endpoint.
 */
const updateComplaintStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, adminNotes } = req.body;

    if (!status) {
      return res.status(400).json({ success: false, message: 'Status is required' });
    }

    // FORBID DIRECT RESOLUTION WITHOUT IMAGE VERIFICATION
    if (status.toLowerCase() === 'resolved') {
      return res.status(400).json({
        success: false,
        error: 'RESOLUTION_VERIFICATION_REQUIRED',
        message: 'Security Policy: Complaints cannot be marked as resolved directly. An after-cleaning photograph must be uploaded and verified via POST /api/admin/complaints/:id/verify-resolution.'
      });
    }

    const allowedStatuses = [
      'Reported', 'Pending', 'Under Review', 'In-progress', 'Awaiting Verification', 'Rejected', 'Verification Rejected'
    ];

    const matchedStatus = allowedStatuses.find(s => s.toLowerCase() === status.toLowerCase());
    if (!matchedStatus) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Permitted non-resolved statuses: ${allowedStatuses.join(', ')}`
      });
    }

    let updated = null;
    if (isDbConnected()) {
      updated = await Issue.findOneAndUpdate(
        { $or: [{ _id: mongoose.isValidObjectId(id) ? id : null }, { complaintId: id }] },
        { 
          $set: { 
            status: matchedStatus,
            ...(adminNotes ? { 'resolutionVerification.notes': adminNotes } : {})
          }
        },
        { new: true }
      );
    }

    if (!updated) {
      return res.status(404).json({ success: false, message: 'Complaint not found' });
    }

    res.json({
      success: true,
      message: `Complaint status updated to ${matchedStatus}`,
      data: updated
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * POST /api/admin/complaints/:id/verify-resolution
 * Analyzes uploaded after-cleaning image with real YOLO11n model.
 */
const verifyResolution = async (req, res) => {
  try {
    const { id } = req.params;
    const adminNotes = req.body.notes || '';
    const imageBuffer = req.file?.buffer;

    if (!imageBuffer) {
      return res.status(400).json({
        success: false,
        error: 'IMAGE_REQUIRED',
        message: 'An after-cleaning photograph of the cleaned site is required for AI resolution verification.'
      });
    }

    // 1. Fetch complaint
    let complaint = null;
    if (isDbConnected()) {
      complaint = await Issue.findOne({
        $or: [{ _id: mongoose.isValidObjectId(id) ? id : null }, { complaintId: id }]
      });
    } else {
      complaint = getDemoIssues().find(c => c._id === id || c.complaintId === id);
    }

    if (!complaint) {
      return res.status(404).json({ success: false, message: 'Complaint not found' });
    }

    if (complaint.status === 'Resolved') {
      return res.status(400).json({
        success: false,
        message: 'This complaint has already been resolved and verified.'
      });
    }

    // 2. Compute cryptographic SHA-256 hash of submitted after-cleaning image
    const imageHash = computeImageHash(imageBuffer);

    // 3. Upload to Cloudinary or build data URL
    let imageUrl = '';
    try {
      if (process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_KEY !== 'your_cloudinary_api_key') {
        const cloud = await uploadToCloudinary(imageBuffer);
        imageUrl = cloud.secure_url;
      } else {
        imageUrl = `data:${req.file.mimetype || 'image/jpeg'};base64,${imageBuffer.toString('base64')}`;
      }
    } catch (uploadErr) {
      imageUrl = `data:${req.file.mimetype || 'image/jpeg'};base64,${imageBuffer.toString('base64')}`;
    }

    // 4. Run fresh YOLO11n object detection on the after-cleaning image buffer
    console.log('🤖 Running YOLO11n inference on after-cleaning image for complaint:', complaint.complaintId || id);
    const yoloResult = await aiServiceClient.detectObjects(imageBuffer, null, 0.25);

    if (yoloResult.error && !yoloResult.model_loaded) {
      return res.status(503).json({
        success: false,
        error: 'AI_SERVICE_UNAVAILABLE',
        message: 'YOLO11n resolution verification service is temporarily unreachable. Cleanliness cannot be validated.'
      });
    }

    // 5. Create secure server-side verification record
    const record = createVerificationRecord({
      complaintId: complaint._id || id,
      adminId: req.user._id,
      adminName: req.user.name,
      imageHash,
      imageUrl,
      yoloResult,
      notes: adminNotes
    });

    // 6. Record attempt in MongoDB verificationHistory audit trail
    if (isDbConnected() && complaint.save) {
      complaint.verificationHistory.push({
        attemptId: record.attemptId,
        imageUrl,
        imageHash,
        garbageDetected: record.garbageDetected,
        detections: record.detections,
        totalObjects: record.totalObjects,
        verificationPassed: record.verificationPassed,
        modelVersion: record.modelVersion,
        verifiedBy: req.user._id,
        verifiedByName: req.user.name,
        verifiedAt: new Date(),
        notes: adminNotes
      });

      complaint.resolutionVerification = {
        status: record.verificationPassed ? 'Awaiting Verification' : 'Rejected',
        afterImageUrl: imageUrl,
        cnnProbability: 0,
        yoloDetections: record.detections,
        residualWasteDetected: record.garbageDetected,
        verifiedBy: req.user._id,
        verifiedAt: new Date(),
        adminDecision: record.verificationPassed ? 'Pending' : 'Rejected',
        notes: adminNotes
      };

      if (!record.verificationPassed) {
        complaint.status = 'Verification Rejected';
      }

      await complaint.save();
    }

    // 7. Return response based on Case A (Garbage Detected) vs. Case B (Clean image)
    if (record.garbageDetected) {
      return res.json({
        success: true,
        verificationPassed: false,
        garbageDetected: true,
        totalObjects: record.totalObjects,
        message: 'Garbage is still detected in this area. The complaint cannot be marked as resolved.',
        detections: record.detections,
        annotatedImage: record.annotatedImageBase64,
        afterImageUrl: imageUrl,
        verificationToken: null // No token issued when garbage is present
      });
    }

    // Case B: Zero supported garbage objects detected
    res.json({
      success: true,
      verificationPassed: true,
      garbageDetected: false,
      totalObjects: 0,
      message: 'No supported garbage objects detected. Image verification passed.',
      verificationToken: record.verificationToken,
      expiresInSeconds: 900,
      afterImageUrl: imageUrl,
      detections: []
    });

  } catch (error) {
    console.error('❌ verifyResolution error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * POST /api/admin/complaints/:id/confirm-resolution
 * Final cryptographic authorization to resolve a complaint
 */
const confirmResolution = async (req, res) => {
  try {
    const { id } = req.params;
    const { verificationToken, resolutionNotes } = req.body;

    if (!verificationToken) {
      return res.status(400).json({
        success: false,
        error: 'TOKEN_REQUIRED',
        message: 'Resolution verification token is required. Post-cleaning AI verification must pass before confirming resolution.'
      });
    }

    // 1. Fetch complaint
    let complaint = null;
    if (isDbConnected()) {
      complaint = await Issue.findOne({
        $or: [{ _id: mongoose.isValidObjectId(id) ? id : null }, { complaintId: id }]
      });
    } else {
      complaint = getDemoIssues().find(c => c._id === id || c.complaintId === id);
    }

    if (!complaint) {
      return res.status(404).json({ success: false, message: 'Complaint not found' });
    }

    if (complaint.status === 'Resolved') {
      return res.status(400).json({
        success: false,
        message: 'This complaint has already been resolved.'
      });
    }

    // 2. Validate and consume single-use verification token
    const tokenValidation = validateAndConsumeToken(
      verificationToken,
      complaint._id || id,
      req.user._id
    );

    if (!tokenValidation.valid) {
      return res.status(403).json({
        success: false,
        error: 'INVALID_VERIFICATION',
        message: tokenValidation.reason
      });
    }

    const { record } = tokenValidation;

    // 3. Atomically update complaint status to Resolved in database
    const resolvedAt = new Date();
    const finalNotes = resolutionNotes || record.notes || 'Cleaning verified and confirmed by administrator.';

    if (isDbConnected() && complaint.save) {
      complaint.status = 'Resolved';
      complaint.resolvedBy = req.user._id;
      complaint.resolvedAt = resolvedAt;
      complaint.resolutionNotes = finalNotes;
      complaint.resolutionImage = record.imageUrl;
      complaint.resolutionVerification.status = 'Verified';
      complaint.resolutionVerification.adminDecision = 'Approved';
      complaint.resolutionVerification.afterImageUrl = record.imageUrl;
      complaint.resolutionVerification.verifiedBy = req.user._id;
      complaint.resolutionVerification.verifiedAt = resolvedAt;
      complaint.resolutionVerification.notes = finalNotes;

      await complaint.save();
    } else {
      complaint.status = 'Resolved';
      complaint.resolvedAt = resolvedAt;
      complaint.resolutionNotes = finalNotes;
      complaint.resolutionImage = record.imageUrl;
    }

    console.log(`🎉 Complaint ${complaint.complaintId || id} officially MARKED RESOLVED by Admin: ${req.user.name}`);

    res.json({
      success: true,
      message: 'Complaint marked as RESOLVED successfully. Resolution evidence recorded.',
      data: {
        complaintId: complaint.complaintId || complaint._id,
        status: 'Resolved',
        resolvedAt,
        resolvedBy: {
          id: req.user._id,
          name: req.user.name,
          email: req.user.email
        },
        resolutionImage: record.imageUrl,
        resolutionNotes: finalNotes,
        verificationAttemptId: record.attemptId
      }
    });

  } catch (error) {
    console.error('❌ confirmResolution error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getAdminComplaints,
  getAdminComplaintById,
  updateComplaintStatus,
  verifyResolution,
  confirmResolution
};

