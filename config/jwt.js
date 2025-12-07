const jwt = require('jsonwebtoken')

/**
 * Generate JWT token with 24 hour expiry
 * @param {Object} payload - Data to encode in token
 * @returns {string} JWT token
 */
function generateToken(payload) {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET environment variable is not set')
  }
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: '24h'
  })
}

/**
 * Verify JWT token
 * @param {string} token - JWT token to verify
 * @returns {Object} Decoded payload
 * @throws {Error} If token is invalid
 */
function verifyToken(token) {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET environment variable is not set')
  }
  return jwt.verify(token, process.env.JWT_SECRET)
}

module.exports = {
  generateToken,
  verifyToken
}
