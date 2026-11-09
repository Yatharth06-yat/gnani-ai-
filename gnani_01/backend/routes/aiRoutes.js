const express = require('express');
const multer = require('multer');
const aiServiceClient = require('../services/ai/aiService');

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }
});

router.get('/health', async (req, res) => {
  const health = await aiServiceClient.checkHealth();
  res.json(health);
});

router.post('/classify', upload.single('image'), async (req, res) => {
  try {
    const result = await aiServiceClient.classifyImage(req.file?.buffer, req.body.image_base64);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/detect', (req, res, next) => {
  upload.single('image')(req, res, (err) => {
    if (err) {
      console.warn('⚠️ Multer upload warning in /api/ai/detect:', err.message);
    }
    next();
  });
}, async (req, res) => {
  try {
    const imageBuffer = req.file?.buffer;
    const imageBase64 = req.body?.image_base64;

    if (!imageBuffer && !imageBase64) {
      return res.status(400).json({
        success: false,
        error: 'NO_IMAGE_PROVIDED',
        message: 'No image file or base64 data received for validation',
        garbage_detected: false,
        total_objects: 0,
        detections: []
      });
    }

    const threshold = req.query.threshold ? parseFloat(req.query.threshold) : 0.25;
    const result = await aiServiceClient.detectObjects(imageBuffer, imageBase64, threshold);
    
    if (result.error && result.model_loaded === false && !result.fallback_mode) {
      return res.status(503).json({
        success: false,
        error: 'AI_SERVICE_UNAVAILABLE',
        message: `FastAPI AI Engine is currently unreachable: ${result.error}`,
        garbage_detected: false,
        total_objects: 0,
        detections: []
      });
    }

    // Ensure standard response properties
    res.json({
      success: result.success !== false,
      garbage_detected: Boolean(result.garbage_detected),
      total_objects: result.total_objects || 0,
      detections: result.detections || [],
      annotated_image: result.annotated_image_base64 || null,
      annotated_image_base64: result.annotated_image_base64 || null,
      confidence_threshold: threshold,
      inference_time_ms: result.inference_time_ms || 0,
      model: result.model || 'yolo11n',
      model_loaded: Boolean(result.model_loaded),
      error: result.error
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      garbage_detected: false,
      total_objects: 0,
      detections: [],
      message: error.message
    });
  }
});

router.post('/analyze', upload.single('image'), async (req, res) => {
  try {
    let coordinates = null;
    if (req.body.location) {
      coordinates = typeof req.body.location === 'string' ? JSON.parse(req.body.location) : req.body.location;
    }
    const result = await aiServiceClient.analyzeMultimodalEvidence({
      imageBuffer: req.file?.buffer,
      imageBase64: req.body.image_base64,
      complaintId: req.body.complaint_id || 'SWM-PREVIEW',
      transcript: req.body.transcript || '',
      coordinates,
      category: req.body.category || 'Garbage'
    });
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/verify', upload.fields([
  { name: 'before_image', maxCount: 1 },
  { name: 'after_image', maxCount: 1 }
]), async (req, res) => {
  try {
    const complaintId = req.body.complaint_id || 'SWM-VERIFY';
    const beforeBuffer = req.files?.before_image?.[0]?.buffer || null;
    const afterBuffer = req.files?.after_image?.[0]?.buffer || null;

    const result = await aiServiceClient.verifyResolution({
      complaintId,
      beforeBuffer,
      afterBuffer,
      beforeBase64: req.body.before_base64,
      afterBase64: req.body.after_base64
    });
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;

