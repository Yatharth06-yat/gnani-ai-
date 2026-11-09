const express = require('express');
const { optionalAuthenticateUser } = require('../middleware/authMiddleware');
const {
  getAllIssues,
  getMyReports,
  createIssue,
  updateIssue,
  verifyResolution,
  deleteIssue,
  getAdminStats
} = require('../controllers/issueController');
const { upload } = require('../utils/cloudinary');

const router = express.Router();

router.use(optionalAuthenticateUser);

router.get('/', getAllIssues);
router.get('/my-reports', getMyReports);
router.post('/', upload.single('image'), createIssue);
router.put('/:id', updateIssue);
router.post('/:id/verify-resolution', upload.single('after_image'), verifyResolution);
router.delete('/:id', deleteIssue);
router.get('/admin/stats', getAdminStats);

module.exports = router;
