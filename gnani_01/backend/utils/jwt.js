const jwt = require('jsonwebtoken');

function getSecret() {
  const s = process.env.JWT_SECRET;
  if (!s || s === 'your_jwt_secret_key_here' || s.trim() === '') {
    throw new Error('JWT_SECRET environment variable is missing or insecure');
  }
  return s;
}

const generateToken = (userId) => {
  return jwt.sign({ userId }, getSecret(), {
    expiresIn: '7d'
  });
};

const verifyToken = (token) => {
  try {
    return jwt.verify(token, getSecret());
  } catch (error) {
    throw new Error('Invalid token');
  }
};

module.exports = {
  generateToken,
  verifyToken
};