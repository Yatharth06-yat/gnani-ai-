const express = require('express');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables from backend/.env explicitly
dotenv.config({ path: path.join(__dirname, '.env') });
const connectDB = require('./config/db');
const { seedDefaultAdmin } = require('./config/seedAdmin');

console.log('🚀 Starting SwachhMap AI 2.0 Backend Server...');

const app = express();

// Attempt MongoDB connection gracefully and seed administrator
connectDB().then(() => {
  seedDefaultAdmin();
}).catch((err) => {
  console.warn('⚠️ MongoDB connection could not be established. Falling back to active memory store.');
});

// Middleware
app.use(cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Correlation-Id']
}));

app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// Register Mongoose models (order matters: models before routes)
require('./models/ConversationSession');

// Import Routes
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/adminRoutes');
const issueRoutes = require('./routes/issueRoutes');
const gnaniRoutes = require('./routes/gnaniRoutes');
const aiRoutes = require('./routes/aiRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');
const geocodeRoutes = require('./routes/geocodeRoutes');

// Mount Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/issues', issueRoutes);
app.use('/api/gnani', gnaniRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/geocode', geocodeRoutes);

// Root endpoint for status inspection
app.get(['/', '/api/health'], (req, res) => {
  res.json({
    status: 'OK',
    message: '✅ SwachhMap AI 2.0 Backend Server is operating.',
    timestamp: new Date().toISOString(),
    services: {
      auth: '/api/auth',
      admin: '/api/admin',
      issues: '/api/issues',
      gnani_voice: '/api/gnani',
      ai_vision: '/api/ai',
      analytics: '/api/analytics',
      geocode: '/api/geocode'
    }
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('❌ Server Unhandled Error:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

// 404 Route Handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint not found',
    url: req.originalUrl,
    method: req.method
  });
});

const PORT = process.env.PORT || 8002;

app.listen(PORT, () => {
  console.log(`✅ SwachhMap AI 2.0 Server listening on http://localhost:${PORT}`);
  console.log(`📡 Gnani AI API: ${process.env.GNANI_API_KEY ? 'Configured' : 'Offline Adapter Mode'}`);
  console.log(`🤖 FastAPI AI Engine: ${process.env.AI_SERVICE_URL || 'http://127.0.0.1:8000'}`);
});

module.exports = app;
