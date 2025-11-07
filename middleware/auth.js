const authenticateStaff = (req, res, next) => {
  // In a production app, verify JWT token here
  const staffId = req.headers["x-staff-id"]
  const staffRole = req.headers["x-staff-role"]

  if (!staffId) {
    return res.status(401).json({ error: "Authentication required" })
  }

  req.staffId = staffId
  req.staffRole = staffRole
  next()
}

const authorizeRole = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.staffRole)) {
      return res.status(403).json({ error: "Insufficient permissions" })
    }
    next()
  }
}

module.exports = { authenticateStaff, authorizeRole }
