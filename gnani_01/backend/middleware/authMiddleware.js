const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Standard Authenticate Middleware
 * Extracts Bearer token and attaches verified User to req.user
 * Never falls back to a hardcoded secret.
 */
const authenticateUser = async (req, res, next) => {
  try {
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret || jwtSecret === 'your_jwt_secret_key_here' || jwtSecret.trim() === '') {
      console.error('FATAL: JWT_SECRET environment variable is missing.');
      return res.status(500).json({
        success: false,
        error: 'SERVER_SECURITY_ERROR',
        message: 'Server security configuration error. Valid JWT_SECRET must be set in environment.'
      });
    }

    const authHeader = req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'UNAUTHORIZED',
        message: 'Access denied. Valid Bearer authentication token is required.'
      });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, jwtSecret);
    
    const userId = decoded.userId || decoded.id;
    const user = await User.findById(userId).select('-password');
    
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'INVALID_TOKEN',
        message: 'Authentication failed. User record not found.'
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        error: 'ACCOUNT_DEACTIVATED',
        message: 'Account has been deactivated.'
      });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      error: 'INVALID_TOKEN',
      message: 'Token verification failed: ' + error.message
    });
  }
};

/**
 * Optional Authenticate Middleware
 * Extracts Bearer token if provided, attaches User to req.user, or sets req.user = null
 */
const optionalAuthenticateUser = async (req, res, next) => {
  const authHeader = req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    req.user = null;
    return next();
  }
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret || jwtSecret === 'your_jwt_secret_key_here') {
    req.user = null;
    return next();
  }
  try {
    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, jwtSecret);
    const userId = decoded.userId || decoded.id;
    const user = await User.findById(userId).select('-password');
    if (user && user.isActive) {
      req.user = user;
    } else {
      req.user = null;
    }
  } catch (_) {
    req.user = null;
  }
  next();
};

/**
 * Require Admin Middleware
 * Strictly enforces that req.user has role === 'admin'
 */
const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'UNAUTHENTICATED',
      message: 'Authentication required prior to administrative authorization.'
    });
  }

  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      error: 'FORBIDDEN',
      message: 'Access denied: Administrative privileges required. Citizen accounts are not authorized.'
    });
  }

  next();
};

// Aliases for compatibility
const auth = authenticateUser;
const adminAuth = [authenticateUser, requireAdmin];

module.exports = {
  authenticateUser,
  optionalAuthenticateUser,
  requireAdmin,
  auth,
  adminAuth
};
