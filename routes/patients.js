const express = require('express')
const mongoose = require('mongoose')
const { DoctorProfile } = require("../models/mongo/DoctorProfile")
const Staff = require("../models/mongo/Staff")
const Specialization = require("../models/mongo/Specialization")
const { authenticateStaff, authorizeRole } = require("../middleware/auth")
const {
  Patient,
  create: createPatient,
  findByCid,
  updateStatus,
  update: updatePatient,
  findAllByStatus,
  getNextQueueNumber,
  getNextTokenForChamber,
  findById,
  getPatientWithHistory
} = require('../models/mongo/Patient')
const router = express.Router()

// Get all patients in queue
router.get("/", async (req, res) => {
  try {
    const { status, limit } = req.query
    let query = {}
    
    if (status) {
      query.status = status
    }
    
    let patients = await Patient.find(query)
      .sort({ createdAt: 1 })
      .lean()
    
    if (limit) {
      patients = patients.slice(0, parseInt(limit))
    }
    
    res.json(patients)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Get patient with visit history
// GET /api/patients/:id/history
router.get(
  "/:id/history",
  authenticateStaff,
  authorizeRole("admin", "doctor", "receptionist"),
  async (req, res) => {
    try {
      const { id } = req.params
      const patient = await getPatientWithHistory(id)

      if (!patient) {
        return res.status(404).json({ error: "Patient not found" })
      }

      const basicInfo = {
        id: patient._id,
        cid: patient.cid,
        name: patient.name,
        age: patient.age,
        gender: patient.gender,
        phone: patient.phone || null,
        totalVisits: Array.isArray(patient.visitHistory)
          ? patient.visitHistory.length
          : 0
      }

      const visitHistory = (patient.visitHistory || []).map((entry) => ({
        visitDate: entry.visitDate,
        status: entry.status,
        chiefComplaint: entry.chiefComplaint,
        chamber: entry.chamber,
        tokenNumber: entry.tokenNumber,
        doctor: entry.doctor
          ? {
              id: entry.doctor._id,
              name: entry.doctor.name,
              cid: entry.doctor.cid
            }
          : null
      }))

      return res.json({ patient: basicInfo, visitHistory })
    } catch (error) {
      console.error("Error getting patient history:", error)
      res.status(500).json({ error: "Failed to load patient history" })
    }
  }
)

// Check patient status by CID
router.get("/status/:cid", async (req, res) => {
  try {
    const { cid } = req.params
    
    // Get patient with all related information
    const patient = await Patient.findOne({ cid })
      .populate('chamber')
      .populate('visitHistory.doctor')
      .lean()
    
    if (!patient) {
      return res.status(404).json({ error: "Patient not found" })
    }
    
    // Resolve doctor & specialization based on the patient's chamber
    let chamberId = null
    if (patient.chamber && typeof patient.chamber === "object") {
      chamberId = patient.chamber._id || patient.chamber.id || null
    } else if (patient.chamber) {
      chamberId = patient.chamber
    }

    let resolvedDoctorName = null
    let resolvedSpecializationName = null

    console.log("[DEBUG] DoctorProfile typeof:", typeof DoctorProfile)
    console.log("[DEBUG] DoctorProfile.findOne typeof:", typeof DoctorProfile?.findOne)

    if (chamberId) {
      const profile = await DoctorProfile.findOne({ chamber_id: chamberId })
        .populate("staff_id", "name")
        .populate("specialization_id", "name")
        .lean()

      if (profile) {
        resolvedDoctorName = profile.staff_id?.name || null
        resolvedSpecializationName = profile.specialization_id?.name || null
      }
    }
    
    // Calculate people ahead in queue
    const peopleAhead = await Patient.countDocuments({
      status: 'waiting',
      chamber: patient.chamber,
      tokenNumber: { $lt: patient.tokenNumber }
    })
    
    const queuePosition = peopleAhead + 1
    const estimatedWaitTime = peopleAhead * 5
    const totalWaiting = await Patient.countDocuments({ status: 'waiting' })
    
    const statusPatient = {
      id: patient._id || patient.id,
      cid: patient.cid,
      name: patient.name,
      age: patient.age,
      gender: patient.gender,
      // Preserve existing fields (using new schema names when available)
      chiefComplaint:
        patient.chiefComplaint || patient.chief_complaint || null,
      tokenNumber:
        patient.tokenNumber || patient.token_number || null,
      chamber: patient.chamber || patient.chamber_number || '-',
      phone: patient.phone || null,
      reason: patient.reason || null,
      queueNumber:
        patient.queueNumber || patient.queue_number || null,
      priority: patient.priority || 'normal',
      assignedDoctor:
        patient.assignedDoctor || patient.assigned_doctor || null,
      doctorName:
        resolvedDoctorName ||
        patient.doctorName ||
        patient.doctor_name ||
        '-',
      specialization:
        resolvedSpecializationName ||
        patient.specialization ||
        patient.specialization_name ||
        '-',
      prescription: patient.prescription || null,
      status: patient.status,
      // Richer metadata
      registeredAt: patient.createdAt || patient.created_at || null,
      createdAt: patient.createdAt || patient.created_at || null,
      updatedAt: patient.updatedAt || patient.updated_at || null
    }

    return res.json({
      patient: statusPatient,
      queuePosition,
      peopleAhead,
      estimatedWaitTime,
      totalWaiting
    })
  } catch (error) {
    console.error("[v0] Error fetching patient status:", error)
    res.status(500).json({ error: error.message })
  }
})

// Check if patient exists (for patient portal)
router.get("/check/:cid", async (req, res) => {
  try {
    const patient = await Patient.findOne({ cid: req.params.cid }).lean()

    if (!patient) {
      return res.status(404).json({ 
        error: "Patient not found. Please register first." 
      })
    }

    // Return patient data for status page
    res.json({
      patient: {
        id: patient.id,
        cid: patient.cid,
        name: patient.name,
        status: patient.status,
        tokenNumber: patient.token_number,
        chamber: patient.chamber,
        chiefComplaint: patient.chief_complaint || "Not specified",
        createdAt: patient.created_at
      }
    })
  } catch (error) {
    console.error("[v0] Error checking patient:", error)
    res.status(500).json({ error: error.message })
  }
})

router.post("/register", async (req, res) => {
  try {
    const { cid, name, age, gender, dob, chiefComplaint, tokenNumber, chamber, phone, reason } = req.body

    // Check if patient already exists in queue
    const existingPatient = await findByCid(cid)
    if (existingPatient && ['waiting', 'in-progress'].includes(existingPatient.status)) {
      return res.status(400).json({
        message: "Patient already in queue",
        patient: existingPatient,
      })
    }

    // Get next queue number and token
    const queueNumber = await getNextQueueNumber()
    const nextToken = await getNextTokenForChamber(chamber)

    const patientData = {
      cid,
      name,
      age,
      gender,
      dob,
      chiefComplaint,
      tokenNumber: nextToken,
      chamber,
      phone,
      reason,
      queueNumber,
      priority: "normal",
      status: 'waiting'
    }

    const patient = await createPatient(patientData)

    // Broadcast SSE update
    const broadcast = req.app.get("broadcastQueueUpdate")
    if (broadcast) {
      broadcast({
        type: "patient-registered",
        patient: patient,
        timestamp: new Date().toISOString(),
      })
    }

    res.status(201).json({
      success: true,
      patient,
      message: "Patient registered successfully",
    })
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

// Get patient by ID
router.get("/:id", async (req, res) => {
  try {
    const patient = await findById(req.params.id).lean()
    if (!patient) {
      return res.status(404).json({ error: "Patient not found" })
    }
    res.json(patient)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Update patient status
// Update patient status or prescription
router.patch("/:id", async (req, res) => {
  try {
    const { status, prescription } = req.body

    let patient;
    
    if (status !== undefined) {
      // Update status
      patient = await updateStatus(req.params.id, status)
      
      if (!patient) {
        return res.status(404).json({ error: "Patient not found" })
      }

      // Broadcast SSE update
      const broadcastUpdate = require('../config/sse').broadcastUpdate
      broadcastUpdate({
        type: 'patient-updated',
        data: patient
      })
    } else if (prescription !== undefined) {
      // Update prescription
      patient = await updatePatient(req.params.id, { prescription })
      
      if (!patient) {
        return res.status(404).json({ error: "Patient not found" })
      }
      
      // Broadcast SSE update for prescription
      const broadcast = req.app.get("broadcastQueueUpdate")
      if (broadcast) {
        broadcast({
          type: "patient-updated",
          patient: patient,
          timestamp: new Date().toISOString(),
        })
      }
    } else {
      return res.status(400).json({ error: "No valid update field provided" })
    }

    res.json(patient)
  } catch (error) {
    console.error("[v0] Error updating patient:", error)
    res.status(500).json({ error: error.message })
  }
})

router.delete("/:id", async (req, res) => {
  try {
    const patient = await updateStatus(req.params.id, 'cancelled')
    if (!patient) {
      return res.status(404).json({ error: "Patient not found" })
    }
    res.json({ message: "Patient removed from queue", patient })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Get next available token number for specific chamber (by Chamber ObjectId)
router.get("/tokens/next-available/:chamber", async (req, res) => {
  try {
    const { chamber } = req.params

    if (!chamber) {
      return res.status(400).json({ error: "Chamber parameter is required" })
    }

    if (!mongoose.Types.ObjectId.isValid(chamber)) {
      return res.status(400).json({ error: "Invalid chamber id" })
    }

    const nextToken = await getNextTokenForChamber(chamber)
    res.json(nextToken)
  } catch (error) {
    console.error("Error getting next available token:", error)
    res.status(500).json({ error: error.message })
  }
})

// Get next available token number (backward compatibility)
router.get("/tokens/next-available", async (req, res) => {
  try {
    const { chamber } = req.query
    
    if (!chamber) {
      return res.status(400).json({ error: "Chamber parameter is required" })
    }

    if (!mongoose.Types.ObjectId.isValid(chamber)) {
      return res.status(400).json({ error: "Invalid chamber id" })
    }
    
    const latest = await Patient.find({ chamber })
      .sort({ tokenNumber: -1 })
      .limit(1)
      .lean()
    
    const nextToken = (latest[0]?.tokenNumber || 0) + 1
    
    res.json(nextToken)
  } catch (error) {
    console.error("Error getting next available token:", error)
    res.status(500).json({ error: error.message })
  }
})

// Get available tokens for specific chamber
router.get("/tokens/available/:chamber", async (req, res) => {
  try {
    const { chamber } = req.params

    if (!mongoose.Types.ObjectId.isValid(chamber)) {
      return res.status(400).json({ error: "Invalid chamber id" })
    }
    
    const latest = await Patient.find({ chamber })
      .sort({ tokenNumber: -1 })
      .limit(1)
      .lean()
    
    const nextToken = (latest[0]?.tokenNumber || 0) + 1
    
    // Return array with next available token and a few future tokens
    const tokens = [nextToken]
    for (let i = 1; i <= 5; i++) {
      const futureToken = nextToken + i
      if (futureToken <= 100) {
        tokens.push(futureToken)
      }
    }
    
    res.json(tokens)
  } catch (error) {
    console.error("Error getting available tokens:", error)
    res.status(500).json({ error: error.message })
  }
})

// Get available tokens (for compatibility)
router.get("/tokens/available", async (req, res) => {
  try {
    const { chamber } = req.query
    
    if (!chamber) {
      return res.status(400).json({ error: "Chamber parameter is required" })
    }

    if (!mongoose.Types.ObjectId.isValid(chamber)) {
      return res.status(400).json({ error: "Invalid chamber id" })
    }
    
    const latest = await Patient.find({ chamber })
      .sort({ tokenNumber: -1 })
      .limit(1)
      .lean()
    
    const nextToken = (latest[0]?.tokenNumber || 0) + 1
    
    // Return array with next available token and a few future tokens
    const tokens = [nextToken]
    for (let i = 1; i <= 5; i++) {
      const futureToken = nextToken + i
      if (futureToken <= 100) {
        tokens.push(futureToken)
      }
    }
    
    res.json(tokens)
  } catch (error) {
    console.error("Error getting available tokens:", error)
    res.status(500).json({ error: error.message })
  }
})

// Receptionist specific routes
router.get(
  "/receptionist/recent",
  authenticateStaff,
  authorizeRole("receptionist", "admin"),
  async (req, res) => {
  try {
    const patients = await Patient.find({})
      .sort({ createdAt: -1 })
      .limit(10)
      .lean()

    const result = patients.map(p => ({
      id: p._id,
      cid: p.cid,
      name: p.name,
      age: p.age,
      gender: p.gender,
      dob: p.dob,
      chief_complaint: p.chiefComplaint,
      token_number: p.tokenNumber,
      chamber: p.chamber,
      queue_number: p.queueNumber,
      status: p.status,
      created_at: p.createdAt
    }))

    res.json(result)
  } catch (error) {
    console.error("Error getting recent registrations:", error)
    res.status(500).json({ error: error.message })
  }
})

router.post(
  "/receptionist/register",
  authenticateStaff,
  authorizeRole("receptionist", "admin"),
  async (req, res) => {
  try {
    const { cid, name, age, gender, dob, chiefComplaint, chamber } = req.body
    
    // Validate required fields
    if (!cid || !name || !age || !gender || !dob || !chiefComplaint || !chamber) {
      return res.status(400).json({ error: "All fields are required" })
    }

    if (!mongoose.Types.ObjectId.isValid(chamber)) {
      return res.status(400).json({ error: "Invalid chamber id" })
    }
    
    // Check if patient already exists and is active
    const existing = await findByCid(cid)
    if (existing && existing.status !== 'completed' && existing.status !== 'cancelled') {
      return res.status(400).json({ error: "Patient with this CID already registered" })
    }
    
    // Convert DOB to proper Date format (from DD-MM-YYYY)
    const [day, month, year] = dob.split('-')
    const dobDate = new Date(`${year}-${month}-${day}`)
    
    // Get next queue number and token
    const queueNumber = await getNextQueueNumber()
    const nextToken = await getNextTokenForChamber(chamber)
    
    // Create patient in MongoDB
    const patient = await createPatient({
      cid,
      name,
      age: parseInt(age),
      gender,
      dob: dobDate,
      chiefComplaint,
      tokenNumber: nextToken,
      chamber,
      queueNumber,
      status: 'waiting'
    })
    
    // Emit real-time update
    const io = req.app.get('io')
    if (io) {
      io.emit('patient-registered', {
        type: 'patient-registered',
        patient: patient
      })
    }
    
    res.status(201).json({
      success: true,
      patient
    })
  } catch (error) {
    console.error("Error registering patient:", error)
    res.status(500).json({ 
      success: false,
      error: error.message 
    })
  }
})

module.exports = router
