const express = require("express")
const router = express.Router()
const mongoose = require("mongoose")
const {
  Staff,
  create,
  findById,
  findByUsername,
  findAll,
  update,
  softDelete,
  comparePassword
} = require("../models/mongo/Staff")
const { generateToken } = require("../config/jwt")
const { authenticateStaff, authorizeRole } = require("../middleware/auth")

// Staff login
router.post("/login", async (req, res) => {
  try {
    const { cidNumber, password, role } = req.body

    // Find staff by CID (username)
    const staff = await findByUsername(cidNumber)
    if (!staff) {
      return res.status(401).json({ message: "Invalid credentials" })
    }

    // Check if role matches if specified
    if (role && staff.role !== role) {
      return res.status(401).json({ message: "Invalid role for this account" })
    }

    // Check if account is active
    if (staff.is_active === false) {
      return res.status(403).json({ message: "Account is deactivated. Please contact admin." })
    }

    // Verify password
    const isValidPassword = await comparePassword(password, staff.password)
    if (!isValidPassword) {
      return res.status(401).json({ message: "Invalid credentials" })
    }

    // Generate JWT token with staff payload
    const token = generateToken({
      id: staff._id,
      cid: staff.cid,
      role: staff.role,
      name: staff.name
    })

    // Set httpOnly cookie for auth
    res.cookie("auth_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    })

    // Return staff info only, no token in body
    res.json({
      staff: {
        id: staff._id,
        cid: staff.cid,
        role: staff.role,
        name: staff.name,
        email: staff.email
      }
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Get current logged in staff from JWT
router.get("/me", authenticateStaff, async (req, res) => {
  try {
    const staffId = req.user.id
    const staff = await findById(staffId)

    if (!staff || staff.is_active === false) {
      return res.status(404).json({ error: "Staff not found or inactive" })
    }

    const { password, ...rest } = staff.toObject()
    res.json({
      id: rest._id,
      cid: rest.cid,
      role: rest.role,
      name: rest.name,
      email: rest.email,
      is_active: rest.is_active
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Staff logout
router.post("/logout", authenticateStaff, (req, res) => {
  res.clearCookie("auth_token", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax"
  })
  res.json({ message: "Logged out successfully" })
})

// Get all staff members
router.get("/", authenticateStaff, authorizeRole('admin'), async (req, res) => {
  try {
    const { role } = req.query
    let staff = await findAll()
    
    // Filter by role if specified
    if (role) {
      staff = staff.filter(s => s.role === role)
    }
    
    // Remove password field and ensure _id is a string
    const staffWithoutPasswords = staff.map(({ password, _id, ...rest }) => ({
      ...rest,
      _id: String(_id),
      id: String(_id) // Also include as 'id' for compatibility
    }))
    
    res.json(staffWithoutPasswords)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Get single staff member by ID
router.get("/:id", authenticateStaff, authorizeRole('admin'), async (req, res) => {
  try {
    const { id } = req.params
    console.log("==== GET /api/staff/:id ====")
    console.log("Requested ID:", id, "Type:", typeof id, "Length:", id?.length)
    console.log("Authenticated user:", req.user ? { id: req.user.id, role: req.user.role } : "None")
    
    // Try to find staff - mongoose.isValid can be lenient, so try the query even if validation fails
    let staff = null
    let isValidFormat = mongoose.Types.ObjectId.isValid(id)
    
    if (isValidFormat) {
      staff = await findById(id)
    } else {
      console.warn("ObjectId validation failed, but trying query anyway. ID:", id)
      // Try anyway - sometimes IDs can be valid even if isValid returns false
      try {
        staff = await findById(id)
      } catch (err) {
        console.error("Error querying with invalid format:", err)
      }
    }
    
    console.log("Found staff:", staff ? "Yes" : "No")
    
    if (!staff) {
      // Get all staff to see what IDs exist (for debugging)
      const allStaff = await findAll()
      const allIds = allStaff.map(s => String(s._id))
      const allIdsLengths = allIds.map(sid => ({ id: sid, length: sid.length }))
      console.log("Available staff IDs:", allIds)
      console.log("ID lengths:", allIdsLengths)
      console.log("Requested ID:", id, "Length:", id?.length)
      
      // Try to find a matching ID (in case of truncation or formatting issues)
      const matchingId = allIds.find(sid => sid === id || sid.startsWith(id) || id.startsWith(sid))
      if (matchingId && matchingId !== id) {
        console.log("Found partial match:", matchingId, "for requested:", id)
        try {
          staff = await findById(matchingId)
        } catch (err) {
          console.error("Error querying with matched ID:", err)
        }
      }
      
      if (!staff) {
        // Check if it's an authentication issue by checking req.user
        console.log("Request user:", req.user ? { id: req.user.id, role: req.user.role } : "Not authenticated")
        
        return res.status(404).json({ 
          error: "Staff not found",
          message: `No staff member found with ID: ${id}`,
          receivedId: id,
          receivedIdLength: id?.length,
          isValidFormat: isValidFormat,
          availableIdsCount: allIds.length,
          availableIds: allIds.slice(0, 5) // Only return first 5 to avoid huge response
        })
      }
    }
    
    // Remove password field from response
    const { password, ...staffWithoutPassword } = staff.toObject()
    
    res.json(staffWithoutPassword)
  } catch (error) {
    console.error("Error fetching staff by ID:", error)
    res.status(500).json({ 
      error: "Internal server error",
      message: error.message 
    })
  }
})

// Create new staff member
router.post("/", authenticateStaff, authorizeRole('admin'), async (req, res) => {
  try {
    const { cid, name, email, role, password } = req.body
    
    if (!cid || !name || !email || !role || !password) {
      return res.status(400).json({ error: "All fields are required" })
    }
    
    const staff = await create({
      cid,
      name,
      email,
      role,
      password
    })
    
    // Remove password from response
    const { password: _, ...staffWithoutPassword } = staff.toObject()
    
    res.status(201).json(staffWithoutPassword)
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

// Update staff member
router.put("/:id", authenticateStaff, authorizeRole('admin'), async (req, res) => {
  try {
    const { id } = req.params
    const { name, role, email, is_active, password } = req.body

    // Validate required fields
    if (!name || !role) {
      return res.status(400).json({ error: "Name and role are required" })
    }

    // Validate role
    const validRoles = ['receptionist', 'doctor', 'admin']
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: "Invalid role. Must be: receptionist, doctor, or admin" })
    }

    const updateData = { name, role, email }
    if (is_active !== undefined) {
      updateData.is_active = is_active
    }
    // Include password if provided
    if (password) {
      updateData.password = password
    }

    const updatedStaff = await update(id, updateData)

    if (!updatedStaff) {
      return res.status(404).json({ error: "Staff not found" })
    }

    if (updatedStaff.password) {
      delete updatedStaff.password
    }

    return res.json(updatedStaff)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Delete (deactivate) staff member
router.delete("/:id", authenticateStaff, authorizeRole('admin'), async (req, res) => {
  try {
    const { id } = req.params

    const deactivatedStaff = await softDelete(id)
    
    if (!deactivatedStaff) {
      return res.status(404).json({ error: "Staff not found" })
    }

    // Remove password from response
    const { password, ...staffWithoutPassword } = deactivatedStaff.toObject()
    res.json({ 
      message: "Staff member deactivated successfully",
      staff: staffWithoutPassword
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

module.exports = router
