const crypto = require('crypto');

/**
 * In-memory secure store for active resolution verification tokens
 * Key: verificationToken -> Record
 */
const activeVerifications = new Map();

// Token TTL: 15 minutes
const TOKEN_TTL_MS = 15 * 60 * 1000;

function computeImageHash(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function generateVerificationToken() {
  return crypto.randomBytes(32).toString('hex');
}

function createVerificationRecord({
  complaintId,
  adminId,
  adminName,
  imageHash,
  imageUrl,
  yoloResult,
  notes = ''
}) {
  const attemptId = `ATTEMPT-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
  const token = generateVerificationToken();
  const expiresAt = Date.now() + TOKEN_TTL_MS;

  const totalObjects = yoloResult.total_objects || 0;
  const garbageDetected = Boolean(yoloResult.garbage_detected) && totalObjects > 0;
  const verificationPassed = !garbageDetected && totalObjects === 0;

  const record = {
    attemptId,
    verificationToken: token,
    complaintId: String(complaintId),
    adminId: String(adminId),
    adminName: adminName || 'Administrator',
    imageHash,
    imageUrl: imageUrl || '',
    garbageDetected,
    totalObjects,
    detections: yoloResult.detections || [],
    annotatedImageBase64: yoloResult.annotated_image_base64 || null,
    verificationPassed,
    modelVersion: yoloResult.model || 'YOLO11n-Ultralytics',
    confidenceThreshold: yoloResult.confidence_threshold || 0.25,
    notes,
    createdAt: Date.now(),
    expiresAt,
    used: false
  };

  // Only store tokens for records that actually PASSED clean-image verification
  if (verificationPassed) {
    activeVerifications.set(token, record);
  }

  // Periodic cleanup of expired records
  cleanExpiredTokens();

  return record;
}

function validateAndConsumeToken(token, complaintId, adminId, imageHash = null) {
  if (!token || typeof token !== 'string') {
    return { valid: false, reason: 'Verification token is required.' };
  }

  const record = activeVerifications.get(token);
  if (!record) {
    return { valid: false, reason: 'Invalid or expired verification record. Clean-image verification must be executed first.' };
  }

  if (record.used) {
    return { valid: false, reason: 'This verification record has already been consumed. Re-verification required.' };
  }

  if (Date.now() > record.expiresAt) {
    activeVerifications.delete(token);
    return { valid: false, reason: 'Verification record has expired (15 minute validity exceeded). Please re-verify.' };
  }

  if (String(record.complaintId) !== String(complaintId)) {
    return { valid: false, reason: 'Verification token does not match the target complaint ID.' };
  }

  if (String(record.adminId) !== String(adminId)) {
    return { valid: false, reason: 'Verification token does not match the authenticated administrator.' };
  }

  if (imageHash && record.imageHash && record.imageHash !== imageHash) {
    return { valid: false, reason: 'Image hash mismatch: Submitted after-cleaning image has changed.' };
  }

  if (!record.verificationPassed || record.garbageDetected || record.totalObjects > 0) {
    return { valid: false, reason: 'Security check failed: Garbage was detected in this verification record.' };
  }

  // Mark token as used to prevent replay attacks
  record.used = true;
  activeVerifications.delete(token);

  return { valid: true, record };
}

function cleanExpiredTokens() {
  const now = Date.now();
  for (const [token, record] of activeVerifications.entries()) {
    if (now > record.expiresAt || record.used) {
      activeVerifications.delete(token);
    }
  }
}

module.exports = {
  computeImageHash,
  createVerificationRecord,
  validateAndConsumeToken
};

