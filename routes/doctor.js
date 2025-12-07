const express = require("express")
const router = express.Router()
const { authenticateStaff, authorizeRole } = require("../middleware/auth")

// Debug middleware to log all requests to doctor router
router.use((req, res, next) => {
  if (req.method === "DELETE") {
    console.log("🗑️ DELETE request to doctor router:", req.method, req.path, "Original:", req.originalUrl)
  }
  next()
})

const {
  Specialization,
  findAllSpecializations,
  findSpecializationById,
  findSpecializationByName,
  createSpecialization
} = require('../models/mongo/Specialization')

const {
  Chamber,
  createChamber,
  findAllChambers,
  findChamberById,
  findChamberByNumber
} = require('../models/mongo/Chamber')

const {
  DoctorProfile,
  create: createDoctorProfile,
  update: updateDoctorProfile,
  findByStaffId
} = require('../models/mongo/DoctorProfile')

const {
  Staff,
  findById: findStaffById,
  permanentDelete
} = require('../models/mongo/Staff')

const {
  SpecializationChamber,
  addMapping,
  findChambersForSpecialization,
  findSpecializationsForChamber
} = require('../models/mongo/SpecializationChamber')

// Get all specializations
router.get(
  "/specializations",
  authenticateStaff,
  authorizeRole("admin", "doctor", "receptionist"),
  async (req, res) => {
    try {
      console.log("DEBUG: entering /api/doctor/specializations")
      const list = await findAllSpecializations()

      // Normalize shape: expose _id and name, and add id alias for frontend convenience
      const normalized = list.map((spec) => ({
        _id: spec._id,
        id: spec._id?.toString ? spec._id.toString() : spec._id,
        name: spec.name
      }))

      res.json(normalized)
    } catch (error) {
      console.error("Error fetching specializations:", error)
      res.status(500).json({ error: error.message })
    }
  }
)

// Get all doctors (for admin doctor profile management)
router.get(
  "/doctors",
  authenticateStaff,
  authorizeRole("admin"),
  async (req, res) => {
    try {
      // Fetch all active doctors
      const doctors = await Staff.find({ role: "doctor", is_active: true })
        .sort({ name: 1 })
        .lean()

      const result = []

      for (const doctor of doctors) {
        // Optional: load existing profile to expose specialization / chamber info
        const profile = await DoctorProfile.findOne({ staff_id: doctor._id })
          .populate("specialization_id", "name")
          .populate("chamber_id")
          .lean()

        let specialization_id = null
        let specialization_name = null
        let chamber_id = null
        let chamber_number = null
        let floor = null
        let building = null

        if (profile) {
          if (profile.specialization_id) {
            specialization_id = profile.specialization_id._id?.toString?.() || profile.specialization_id._id || profile.specialization_id
            specialization_name = profile.specialization_id.name || null
          }

          if (profile.chamber_id) {
            chamber_id = profile.chamber_id._id?.toString?.() || profile.chamber_id._id || profile.chamber_id
            chamber_number = profile.chamber_id.chamber_number || null
            floor = profile.chamber_id.floor || null
            building = profile.chamber_id.building || null
          }
        }

        result.push({
          id: doctor._id?.toString?.() || doctor._id,
          name: doctor.name,
          email: doctor.email || "",
          cid: doctor.cid,
          specialization_id,
          specialization_name,
          chamber_id,
          chamber_number,
          floor,
          building
        })
      }

      return res.json(result)
    } catch (error) {
      console.error("Error fetching doctors list:", error)
      return res.status(500).json({ error: error.message })
    }
  }
)

// Create specialization
router.post(
  "/specializations",
  authenticateStaff,
  authorizeRole("admin"),
  async (req, res) => {
    try {
      const { name } = req.body

      if (!name || !name.trim()) {
        return res.status(400).json({ error: "Specialization name is required" })
      }

      const data = { name: name.trim() }

      const specialization = await createSpecialization(data)

      return res.status(201).json({
        _id: specialization._id,
        id: specialization._id.toString(),
        name: specialization.name
      })
    } catch (error) {
      if (error.code === 11000) {
        return res
          .status(400)
          .json({ error: "Specialization name already exists" })
      }

      console.error("Error creating specialization:", error)
      return res.status(500).json({ error: error.message })
    }
  }
)

// Update specialization
router.put(
  "/specializations/:id",
  authenticateStaff,
  authorizeRole("admin"),
  async (req, res) => {
    try {
      const { id } = req.params
      const { name } = req.body

      if (!name || !name.trim()) {
        return res.status(400).json({ error: "Specialization name is required" })
      }

      const updated = await Specialization.findByIdAndUpdate(
        id,
        { $set: { name: name.trim() } },
        { new: true }
      ).lean()

      if (!updated) {
        return res.status(404).json({ error: "Specialization not found" })
      }

      return res.json({
        _id: updated._id,
        id: updated._id.toString(),
        name: updated.name
      })
    } catch (error) {
      if (error.code === 11000) {
        return res
          .status(400)
          .json({ error: "Specialization name already exists" })
      }

      console.error("Error updating specialization:", error)
      return res.status(500).json({ error: error.message })
    }
  }
)

// Delete specialization
router.delete(
  "/specializations/:id",
  authenticateStaff,
  authorizeRole("admin"),
  async (req, res) => {
    try {
      const { id } = req.params

      // Optional check: do not delete if specialization still has chambers assigned
      const hasMappings = await SpecializationChamber.findOne({ specialization_id: id }).lean()
      if (hasMappings) {
        return res.status(400).json({
          error: "Specialization has chambers assigned. Remove assignments first."
        })
      }

      const deleted = await Specialization.findByIdAndDelete(id).lean()

      if (!deleted) {
        return res.status(404).json({ error: "Specialization not found" })
      }

      return res.json({ message: "Specialization deleted successfully" })
    } catch (error) {
      console.error("Error deleting specialization:", error)
      return res.status(500).json({ error: error.message })
    }
  }
)

// Get all chambers
router.get(
  "/chambers",
  authenticateStaff,
  authorizeRole("admin", "doctor", "receptionist"),
  async (req, res) => {
    try {
      console.log("DEBUG: entering /api/doctor/chambers")
      const list = await findAllChambers()

      const result = []

      for (const chamber of list) {
        const specializations = await findSpecializationsForChamber(chamber._id)

        result.push({
          _id: chamber._id,
          id: chamber._id?.toString ? chamber._id.toString() : chamber._id,
          chamber_number: chamber.chamber_number,
          assignedSpecializations: specializations.map((s) => ({
            _id: s._id,
            name: s.name
          }))
        })
      }

      res.json(result)
    } catch (error) {
      console.error("Error fetching chambers:", error)
      res.status(500).json({ error: error.message })
    }
  }
)

// Create chamber
router.post(
  "/chambers",
  authenticateStaff,
  authorizeRole("admin"),
  async (req, res) => {
    try {
      const { chamber_number } = req.body

      if (!chamber_number) {
        return res.status(400).json({ error: "chamber_number is required" })
      }

      const data = { chamber_number: Number(chamber_number) }

      const chamber = await createChamber(data)

      return res.status(201).json({
        _id: chamber._id,
        id: chamber._id.toString(),
        chamber_number: chamber.chamber_number
      })
    } catch (error) {
      // handle duplicate chamber_number (unique index)
      if (error.code === 11000) {
        return res
          .status(400)
          .json({ error: "Chamber number already exists" })
      }

      console.error("Error creating chamber:", error)
      return res.status(500).json({ error: error.message })
    }
  }
)

// Update chamber
router.put(
  "/chambers/:id",
  authenticateStaff,
  authorizeRole("admin"),
  async (req, res) => {
    try {
      const { id } = req.params
      const { chamber_number } = req.body

      if (!chamber_number) {
        return res.status(400).json({ error: "chamber_number is required" })
      }

      const chamber = await Chamber.findByIdAndUpdate(
        id,
        { $set: { chamber_number: Number(chamber_number) } },
        { new: true }
      ).lean()

      if (!chamber) {
        return res.status(404).json({ error: "Chamber not found" })
      }

      return res.json({
        _id: chamber._id,
        id: chamber._id.toString(),
        chamber_number: chamber.chamber_number
      })
    } catch (error) {
      if (error.code === 11000) {
        return res
          .status(400)
          .json({ error: "Chamber number already exists" })
      }

      console.error("Error updating chamber:", error)
      return res.status(500).json({ error: error.message })
    }
  }
)

// Delete chamber
router.delete(
  "/chambers/:id",
  authenticateStaff,
  authorizeRole("admin"),
  async (req, res) => {
    try {
      const { id } = req.params

      // Check if this chamber is used in any mapping or doctor profile
      const inUseMapping = await SpecializationChamber.findOne({ chamber_id: id }).lean()
      if (inUseMapping) {
        return res.status(400).json({
          error: "Chamber is currently assigned to doctors or specializations"
        })
      }

      const deleted = await Chamber.findByIdAndDelete(id).lean()

      if (!deleted) {
        return res.status(404).json({ error: "Chamber not found" })
      }

      return res.json({ message: "Chamber deleted successfully" })
    } catch (error) {
      console.error("Error deleting chamber:", error)
      return res.status(500).json({ error: error.message })
    }
  }
)

// Get chambers assigned to one specialization
router.get(
  "/specializations/:id/chambers",
  authenticateStaff,
  authorizeRole("admin", "doctor", "receptionist"),
  async (req, res) => {
    try {
      const { id } = req.params

      const specialization = await findSpecializationById(id)
      if (!specialization) {
        return res.status(404).json({ error: "Specialization not found" })
      }

      const chambers = await findChambersForSpecialization(id)
      return res.json(chambers)
    } catch (error) {
      console.error("Error fetching chambers for specialization:", error)
      res.status(500).json({ error: error.message })
    }
  }
)

// Assign a chamber to a specialization
router.post(
  "/specializations/:id/chambers",
  authenticateStaff,
  authorizeRole("admin"),
  async (req, res) => {
    try {
      const { id } = req.params
      const { chamber_id } = req.body

      if (!chamber_id) {
        return res.status(400).json({ error: "chamber_id is required" })
      }

      const specialization = await findSpecializationById(id)
      if (!specialization) {
        return res.status(404).json({ error: "Specialization not found" })
      }

      const chamber = await findChamberById(chamber_id)
      if (!chamber) {
        return res.status(404).json({ error: "Chamber not found" })
      }

      const mapping = await addMapping({
        specialization_id: id,
        chamber_id
      })

      return res.status(201).json(mapping)
    } catch (error) {
      // Handle duplicate mapping gracefully
      if (error.code === 11000) {
        return res
          .status(200)
          .json({ message: "Chamber already assigned to this specialization" })
      }

      console.error("Error assigning chamber to specialization:", error)
      res.status(500).json({ error: error.message })
    }
  }
)

// Assignments aggregate endpoints

// GET /api/doctor/assignments
// Returns specializations with their assigned chambers
router.get(
  "/assignments",
  authenticateStaff,
  authorizeRole("admin", "doctor", "receptionist"),
  async (req, res) => {
    try {
      const specs = await findAllSpecializations()
      const result = []

      for (const spec of specs) {
        const chambers = await findChambersForSpecialization(spec._id)

        result.push({
          specialization_id: spec._id?.toString?.() || spec._id,
          specialization_name: spec.name,
          chambers: chambers.map((ch) => ({
            id: ch._id?.toString?.() || ch._id,
            chamber_number: ch.chamber_number,
          })),
        })
      }

      return res.json(result)
    } catch (error) {
      console.error("Error fetching assignments:", error)
      return res.status(500).json({ error: error.message })
    }
  }
)

// POST /api/doctor/assignments
// Body: { specialization_id, chamber_id }
router.post(
  "/assignments",
  authenticateStaff,
  authorizeRole("admin"),
  async (req, res) => {
    try {
      const { specialization_id, chamber_id } = req.body

      if (!specialization_id || !chamber_id) {
        return res.status(400).json({
          error: "specialization_id and chamber_id are required",
        })
      }

      const specialization = await findSpecializationById(specialization_id)
      if (!specialization) {
        return res.status(404).json({ error: "Specialization not found" })
      }

      const chamber = await findChamberById(chamber_id)
      if (!chamber) {
        return res.status(404).json({ error: "Chamber not found" })
      }

      try {
        const mapping = await addMapping({
          specialization_id,
          chamber_id,
        })
        return res.status(201).json(mapping)
      } catch (error) {
        if (error.code === 11000) {
          return res
            .status(400)
            .json({ error: "Chamber already assigned to this specialization" })
        }
        throw error
      }
    } catch (error) {
      console.error("Error creating assignment:", error)
      return res.status(500).json({ error: error.message })
    }
  }
)

// DELETE /api/doctor/assignments
// Body: { specialization_id, chamber_id }
router.delete(
  "/assignments",
  authenticateStaff,
  authorizeRole("admin"),
  async (req, res) => {
    try {
      const { specialization_id, chamber_id } = req.body || {}

      if (!specialization_id || !chamber_id) {
        return res.status(400).json({
          error: "specialization_id and chamber_id are required",
        })
      }

      const deleted = await SpecializationChamber.findOneAndDelete({
        specialization_id,
        chamber_id,
      }).lean()

      if (!deleted) {
        return res.status(404).json({ error: "Assignment not found" })
      }

      return res.json({ success: true })
    } catch (error) {
      console.error("Error deleting assignment:", error)
      return res.status(500).json({ error: error.message })
    }
  }
)

// Get doctor profile by staff ID
router.get(
  "/profile/:staffId",
  authenticateStaff,
  authorizeRole("doctor", "admin"),
  async (req, res) => {
    try {
      const { staffId } = req.params
      const userRole = req.user.role
      const userId = req.user.id

      // Additional guard: doctors can only view their own profile
      if (userRole === "doctor" && staffId !== String(userId)) {
        return res.status(403).json({ error: "Access denied" })
      }

      // Load staff
      const staff = await findStaffById(staffId)
      if (!staff) {
        return res.status(404).json({ error: "Staff not found" })
      }

      // Load doctor profile with populated specialization & chamber
      const profile = await DoctorProfile.findOne({ staff_id: staffId })
        .populate("specialization_id", "name")
        .populate("chamber_id")
        .lean()

      if (!profile) {
        return res.status(404).json({ error: "Doctor profile not found" })
      }

      const specialization = profile.specialization_id
        ? {
            id: profile.specialization_id._id?.toString?.() || profile.specialization_id._id,
            name: profile.specialization_id.name || null
          }
        : null

      const chamber = profile.chamber_id
        ? {
            id: profile.chamber_id._id?.toString?.() || profile.chamber_id._id,
            chamber_number: profile.chamber_id.chamber_number || null,
            floor: profile.chamber_id.floor || null,
            building: profile.chamber_id.building || null
          }
        : null

      return res.json({
        id: profile._id,
        staff_id: staffId,
        name: staff.name,
        email: staff.email || "",
        cid: staff.cid,
        role: staff.role,
        specialization,
        chamber,
        created_at: profile.created_at,
        updated_at: profile.updated_at
      })
    } catch (error) {
      console.error("Error fetching doctor profile:", error)
      res.status(500).json({ error: error.message })
    }
  }
)


// Create or update doctor profile
router.post(
  "/profile",
  authenticateStaff,
  authorizeRole("admin"),
  async (req, res) => {
    try {
      const { staff_id, specialization_id, chamber_id } = req.body

      // Validate required fields
      if (!staff_id || !specialization_id || !chamber_id) {
        return res.status(400).json({
          error: "Staff, specialization and chamber are required",
        })
      }

      // Ensure staff is a doctor
      const staff = await findStaffById(staff_id)
      if (!staff) {
        return res.status(404).json({ error: "Staff not found" })
      }

      if (staff.role !== "doctor") {
        return res.status(400).json({ error: "Staff is not a doctor" })
      }

      // Upsert profile by staff_id
      let profile = await findByStaffId(staff_id)

      if (!profile) {
        profile = await createDoctorProfile({
          staff_id,
          specialization_id,
          chamber_id,
        })
      } else {
        profile = await updateDoctorProfile(staff_id, {
          specialization_id,
          chamber_id,
        })
      }

      // Reload populated profile for consistent response shape
      const populated = await DoctorProfile.findOne({ staff_id })
        .populate("specialization_id", "name")
        .populate("chamber_id")
        .lean()

      const specialization = populated.specialization_id
        ? {
            id:
              populated.specialization_id._id?.toString?.() ||
              populated.specialization_id._id,
            name: populated.specialization_id.name || null,
          }
        : null

      const chamber = populated.chamber_id
        ? {
            id: populated.chamber_id._id?.toString?.() || populated.chamber_id._id,
            chamber_number: populated.chamber_id.chamber_number || null,
            floor: populated.chamber_id.floor || null,
            building: populated.chamber_id.building || null,
          }
        : null

      return res.json({
        id: populated._id,
        staff_id,
        name: staff.name,
        email: staff.email || "",
        cid: staff.cid,
        role: staff.role,
        specialization,
        chamber,
        created_at: populated.created_at,
        updated_at: populated.updated_at,
      })
    } catch (error) {
      console.error("Error in doctor profile creation/updating:", error)
      res.status(500).json({ error: error.message })
    }
  }
)

// Update doctor profile
router.put(
  "/profile/:staffId",
  authenticateStaff,
  authorizeRole("admin"),
  async (req, res) => {
    try {
      const { staffId } = req.params
      const { specialization_id, chamber_id } = req.body

      // Validate required fields
      if (!specialization_id || !chamber_id) {
        return res.status(400).json({
          error: "Specialization and chamber are required",
        })
      }

      // Ensure staff is a doctor
      const staff = await findStaffById(staffId)
      if (!staff) {
        return res.status(404).json({ message: "Staff not found" })
      }

      if (staff.role !== "doctor") {
        return res.status(400).json({ message: "Staff is not a doctor" })
      }

      const updated = await updateDoctorProfile(staffId, {
        specialization_id,
        chamber_id
      })
      
      res.json(updated)
    } catch (error) {
      console.error("Error updating doctor profile:", error)
      res.status(500).json({ error: error.message })
    }
  }
)

// Delete doctor profile
router.delete(
  "/profile/:staffId",
  authenticateStaff,
  authorizeRole("admin"),
  async (req, res) => {
    try {
      const { staffId } = req.params

      const deleted = await DoctorProfile.findOneAndDelete({
        staff_id: staffId,
      }).lean()

      if (!deleted) {
        return res.status(404).json({ error: "Doctor profile not found" })
      }

      return res.json({ success: true })
    } catch (error) {
      console.error("Error deleting doctor profile:", error)
      res.status(500).json({ error: error.message })
    }
  }
)

// Permanently delete doctor (profile + staff record)
router.delete(
  "/delete/:staffId",
  authenticateStaff,
  authorizeRole("admin"),
  async (req, res) => {
    try {
      const { staffId } = req.params
      console.log("==== DELETE /api/doctor/delete/:staffId ====")
      console.log("Requested staffId:", staffId, "Length:", staffId?.length)
      console.log("Authenticated user:", req.user ? { id: req.user.id, role: req.user.role } : "None")

      // Validate ObjectId format
      const mongoose = require("mongoose")
      if (!mongoose.Types.ObjectId.isValid(staffId)) {
        return res.status(400).json({ 
          error: "Invalid staff ID format",
          receivedId: staffId
        })
      }

      // Check if staff exists and is a doctor
      const staff = await findStaffById(staffId)
      console.log("Found staff:", staff ? { id: String(staff._id), role: staff.role } : "No")
      
      if (!staff) {
        // Get all staff for debugging
        const { findAll } = require('../models/mongo/Staff')
        const allStaff = await findAll()
        const allIds = allStaff.map(s => String(s._id))
        console.log("Available staff IDs:", allIds)
        
        return res.status(404).json({ 
          error: "Staff not found",
          message: `No staff member found with ID: ${staffId}`,
          receivedId: staffId,
          availableIdsCount: allIds.length
        })
      }

      if (staff.role !== "doctor") {
        return res.status(400).json({ 
          error: "Staff member is not a doctor",
          actualRole: staff.role
        })
      }

      // Delete doctor profile if it exists
      const profileDeleted = await DoctorProfile.findOneAndDelete({ staff_id: staffId })
      console.log("Doctor profile deleted:", profileDeleted ? "Yes" : "No profile found")

      // Permanently delete staff record
      const { permanentDelete } = require('../models/mongo/Staff')
      await permanentDelete(staffId)
      console.log("Staff record permanently deleted")

      return res.json({ 
        success: true,
        message: "Doctor permanently deleted successfully"
      })
    } catch (error) {
      console.error("Error permanently deleting doctor:", error)
      res.status(500).json({ error: error.message })
    }
  }
)

module.exports = router
