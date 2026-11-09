const express = require('express');
const multer = require('multer');
const { adminLogin } = require('../controllers/authController');
const {
  getAdminComplaints,
  getAdminComplaintById,
  updateComplaintStatus,
  verifyResolution,
  confirmResolution
} = require('../controllers/adminComplaintController');
const { authenticateUser, requireAdmin } = require('../middleware/authMiddleware');

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

/**
 * Public Admin Authentication Route
 */
router.post('/login', adminLogin);

/**
 * Protected Admin Routes (require both valid token and admin role)
 */
router.use(authenticateUser);
router.use(requireAdmin);

// Admin Profile & Session
router.get('/me', (req, res) => {
  res.json({
    success: true,
    admin: {
      id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role,
      lastLogin: new Date()
    }
  });
});

router.post('/logout', (req, res) => {
  res.json({ success: true, message: 'Administrative logout successful' });
});

// Admin Complaint Management
router.get('/complaints', getAdminComplaints);
router.get('/complaints/:id', getAdminComplaintById);
router.patch('/complaints/:id/status', updateComplaintStatus);

// Resolution Verification & Confirmation
router.post('/complaints/:id/verify-resolution', upload.single('after_image'), verifyResolution);
router.post('/complaints/:id/confirm-resolution', confirmResolution);

module.exports = router;

