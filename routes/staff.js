const express = require("express")
const router = express.Router()
const Staff = require("../models/Staff")

// Staff login
router.post("/login", async (req, res) => {
  try {
    const { cidNumber, password, role } = req.body

    const staff = await Staff.findOne({ username: cidNumber })
    if (!staff) {
      return res.status(401).json({ message: "Invalid credentials" })
    }

    if (role && staff.role !== role) {
      return res.status(401).json({ message: "Invalid role for this account" })
    }

    // In production, use proper password hashing (bcrypt)
    if (staff.password !== password) {
      return res.status(401).json({ message: "Invalid credentials" })
    }

    if (!staff.isActive) {
      return res.status(401).json({ message: "Account is inactive" })
    }

    res.json({
      token: `staff_${staff._id}_${Date.now()}`, // Simple token for demo
      staff: {
        _id: staff._id,
        username: staff.username,
        role: staff.role,
        name: staff.name,
        email: staff.email,
      },
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Get all staff members
router.get("/", async (req, res) => {
  try {
    const { role } = req.query
    const filter = role ? { role, isActive: true } : { isActive: true }
    const staff = await Staff.find(filter).select("-password")
    res.json(staff)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Create new staff member
router.post("/", async (req, res) => {
  try {
    const staff = new Staff(req.body)
    await staff.save()
    res.status(201).json({
      id: staff._id,
      username: staff.username,
      role: staff.role,
      name: staff.name,
      email: staff.email,
    })
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

module.exports = router
