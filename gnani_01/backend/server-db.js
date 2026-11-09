const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/db');

// Load environment variables
dotenv.config();

console.log('🚀 Starting SwachhMap Server with Database...');

const app = express();

// Connect to database
connectDB();

// Middleware
app.use(cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Import controllers
const authController = require('./controllers/authController');
const issueController = require('./controllers/issueController');
const { authenticate, authorize } = require('./middleware/auth');

// Root endpoint
app.get('/', (req, res) => {
  res.json({ 
    message: '✅ SwachhMap API Server with Database is running!',
    timestamp: new Date().toISOString(),
    database: 'MongoDB Connected',
    endpoints: [
      'POST /api/auth/register',
      'POST /api/auth/login',
      'GET /api/auth/me',
      'PUT /api/auth/profile',
      'GET /api/issues',
      'POST /api/issues',
      'PUT /api/issues/:id',
      'DELETE /api/issues/:id',
      'GET /api/issues/my-reports',
      'GET /api/issues/admin/stats'
    ]
  });
});

// Auth routes
app.post('/api/auth/register', authController.register);
app.post('/api/auth/login', authController.login);
app.get('/api/auth/me', authenticate, authController.getMe);
app.put('/api/auth/profile', authenticate, authController.updateProfile);

// Issue routes
app.get('/api/issues', issueController.getAllIssues);
app.post('/api/issues', authenticate, issueController.createIssue);
app.put('/api/issues/:id', authenticate, authorize('admin', 'official'), issueController.updateIssue);
app.delete('/api/issues/:id', authenticate, authorize('admin'), issueController.deleteIssue);
app.get('/api/issues/my-reports', authenticate, issueController.getMyReports);
app.get('/api/issues/admin/stats', authenticate, authorize('admin'), issueController.getAdminStats);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('❌ Server Error:', err);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint not found',
    url: req.originalUrl,
    method: req.method
  });
});

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`✅ SwachhMap Server running on http://localhost:${PORT}`);
  console.log(`🗄️ Database: MongoDB`);
  console.log(`🔐 JWT Secret: ${process.env.JWT_SECRET ? 'Configured' : 'Missing'}`);
  console.log(`🔗 Test: curl http://localhost:${PORT}/`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
  console.error('❌ Unhandled Promise Rejection:', err.message);
  // Close server & exit process
  server.close(() => {
    process.exit(1);
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err.message);
  process.exit(1);
});