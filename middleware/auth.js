const { verifyToken } = require('../config/jwt')

const authenticateStaff = (req, res, next) => {
  // Prefer token from httpOnly cookie
  let token = null

  if (req.cookies && req.cookies.auth_token) {
    token = req.cookies.auth_token
  } else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    // Fallback for tools like Postman
    token = req.headers.authorization.substring(7)
  }

  if (!token) {
    return res.status(401).json({ error: "Authentication required" })
  }

  try {
    const decoded = verifyToken(token)
    req.user = decoded
    next()
  } catch (error) {
    return res.status(401).json({ error: "Invalid or expired token" })
  }
}

const authorizeRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Insufficient permissions" })
    }
    next()
  }
}

module.exports = { authenticateStaff, authorizeRole }
