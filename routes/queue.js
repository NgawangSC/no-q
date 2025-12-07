const express = require("express")
const mongoose = require("mongoose")
const router = express.Router()
const {
  Patient,
  findAll: findAllPatients,
  updateStatus,
  update,
  findById,
  findOne: findPatient
} = require("../models/mongo/Patient")
const { authenticateStaff, authorizeRole } = require("../middleware/auth")

const AVERAGE_CONSULTATION_MINUTES = 10
const MS_PER_MINUTE = 60000

// Helper: map patient object to what the frontend expects
function mapPatientForDashboard(p, positionInQueue = null, estimatedWaitMinutes = null) {
  if (!p) return null

  const base = {
    id: p._id ? String(p._id) : p.id ? String(p.id) : null,
    tokenNumber: p.tokenNumber,
    queueNumber: p.queueNumber,
    enteredTime: p.createdAt,
    name: p.name,
    cid: p.cid,
    age: p.age,
    gender: p.gender,
    chiefComplaint: p.chiefComplaint,
    status: p.status,
    // chamber may be a legacy number or a new ObjectId; stringify for stable comparison
    chamber: p.chamber != null ? String(p.chamber) : null
  }

  const result = { ...base }

  if (positionInQueue != null) {
    result.positionInQueue = positionInQueue
  }

  if (typeof estimatedWaitMinutes === "number" && Number.isFinite(estimatedWaitMinutes)) {
    result.estimatedWaitMinutes = estimatedWaitMinutes

    const estimatedReadyDate = new Date(
      Date.now() + estimatedWaitMinutes * MS_PER_MINUTE
    )

    result.estimatedReadyTime = estimatedReadyDate.toISOString()
  } else {
    result.estimatedWaitMinutes = null
    result.estimatedReadyTime = null
  }

  return result
}

// Get all patients in queue (all chambers)
router.get("/", async (req, res) => {
  try {
    const allPatients = await Patient.find({}).lean()

    const waitingPatients = allPatients.filter((p) => p.status === "waiting")
    const inProgressPatients = allPatients.filter(
      (p) => p.status === "in-progress"
    )
    const completedPatients = allPatients.filter(
      (p) => p.status === "completed"
    )
    const cancelledPatients = allPatients.filter(
      (p) => p.status === "cancelled"
    )

    const otherPatients = allPatients.filter(
      (p) => !["waiting", "in-progress"].includes(p.status)
    )

    // Sort groups
    const sortedInProgress = inProgressPatients.sort(
      (a, b) => (a.queueNumber || 0) - (b.queueNumber || 0)
    )
    const sortedWaiting = waitingPatients.sort(
      (a, b) => (a.queueNumber || 0) - (b.queueNumber || 0)
    )
    const sortedOthers = otherPatients.sort(
      (a, b) => (a.queueNumber || 0) - (b.queueNumber || 0)
    )

    const patients = []

    // In-progress: position 0, 0 minutes
    sortedInProgress.forEach((p) => {
      patients.push(mapPatientForDashboard(p, 0, 0))
    })

    const inProgressCount = sortedInProgress.length

    // Waiting: position after in-progress patients
    sortedWaiting.forEach((p, index) => {
      const positionInQueue = inProgressCount + index + 1
      const estimatedWaitMinutes =
        positionInQueue * AVERAGE_CONSULTATION_MINUTES
      patients.push(
        mapPatientForDashboard(p, positionInQueue, estimatedWaitMinutes)
      )
    })

    // Others: no queue position or wait time
    sortedOthers.forEach((p) => {
      patients.push(mapPatientForDashboard(p))
    })

    const summary = {
      totalPatients: allPatients.length,
      waiting: waitingPatients.length,
      inProgress: inProgressPatients.length,
      completed: completedPatients.length,
      cancelled: cancelledPatients.length
    }

    res.json({ summary, patients })
  } catch (error) {
    if (error.name === "CastError") {
      return res.status(400).json({ error: "Invalid chamber id" })
    }
    res.status(500).json({ error: error.message })
  }
})

// Get queue statistics
router.get("/stats", async (req, res) => {
  try {
    const today = new Date().toISOString().split("T")[0]
    
    const [waitingPatients, inProgressPatients, completedToday] = await Promise.all([
      Patient.find({ status: "waiting" }).lean(),
      Patient.find({ status: "in-progress" }).lean(),
      Patient.find({
        status: "completed",
        updatedAt: {
          $gte: new Date(today + "T00:00:00"),
          $lte: new Date(today + "T23:59:59")
        }
      }).lean()
    ])

    // simple placeholder
    const avgWaitTime = completedToday.length > 0 ? 15 : 0

    const priorityBreakdown = waitingPatients.reduce((acc, patient) => {
      const key = patient.priority || "normal"
      const existing = acc.find((item) => item._id === key)
      if (existing) {
        existing.count += 1
      } else {
        acc.push({ _id: key, count: 1 })
      }
      return acc
    }, [])

    res.json({
      waiting: waitingPatients.length,
      inProgress: inProgressPatients.length,
      completedToday: completedToday.length,
      avgWaitTime,
      priorityBreakdown,
      totalToday:
        waitingPatients.length +
        inProgressPatients.length +
        completedToday.length,
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Get current patient + queue for a specific chamber (by Chamber ObjectId)
router.get("/current", async (req, res) => {
  try {
    const { chamber } = req.query

    if (!chamber || typeof chamber !== "string") {
      return res.status(400).json({ error: "chamber query parameter is required" })
    }

    if (!mongoose.Types.ObjectId.isValid(chamber)) {
      return res.status(400).json({ error: "Invalid chamber id" })
    }

    const chamberId = chamber

    // 1. Try to find in-progress patient first
    let currentPatient = await Patient.findOne({
      status: "in-progress",
      chamber: chamberId
    }).lean()

    // 2. If no in-progress, get next waiting patient by priority
    if (!currentPatient) {
      // Calculate priority value for sorting
      const priorityValue = {
        emergency: 3,
        urgent: 2,
        normal: 1
      }
      
      const waiting = await Patient.find({
        status: "waiting",
        chamber: chamberId
      })
      .sort({ 
        priority: -1,  // Sort by priority (descending)
        queueNumber: 1 // Then by queue number (ascending)
      })
      .limit(1)
      .lean()
      
      currentPatient = waiting[0] || null
    }

    // 3. Get all waiting patients for the queue
    const waitingPatients = await Patient.find({
      status: "waiting",
      chamber: chamberId
    })
    .sort({
      priority: -1,
      queueNumber: 1
    })
    .lean()

    const waitingCount = Array.isArray(waitingPatients) ? waitingPatients.length : 0

    const response = {
      patient: currentPatient ? mapPatientForDashboard(currentPatient) : null,
      queue: Array.isArray(waitingPatients)
        ? waitingPatients.map(mapPatientForDashboard)
        : [],
      chamber: chamberId,
      waitingCount,
      expectedTime: waitingCount * 15 // 15 minutes per patient
    }
    
    res.json(response)
  } catch (error) {
    console.error("Error in /api/queue/current:", error)
    res.status(500).json({ error: error.message })
  }
})

// Call next patient for doctor's chamber
router.post(
  "/call-next",
  authenticateStaff,
  authorizeRole("doctor"),
  async (req, res) => {
    try {
      const doctorId = req.user?.id
      const { chamber } = req.body

      if (!chamber) {
        return res.status(400).json({ error: "chamber is required to call next patient" })
      }

      if (!mongoose.Types.ObjectId.isValid(chamber)) {
        return res.status(400).json({ error: "Invalid chamber id" })
      }

      const chamberId = chamber

      // Find next patient by priority and queue number
      const next = await Patient.findOne({ 
        status: "waiting", 
        chamber: chamberId 
      })
      .sort({ 
        priority: -1, 
        queueNumber: 1 
      })
      .lean()

      if (!next) {
        return res.status(404).json({ message: "No patients in queue" })
      }

      // Update patient status to in-progress
      const updateData = { status: "in-progress" }
      if (doctorId) {
        updateData.assignedDoctor = doctorId
      }

      const calledPatient = await updateStatus(next._id, "in-progress")

      const broadcast = req.app.get("broadcastQueueUpdate")
      if (broadcast) {
        broadcast({
          type: "patient-called",
          patient: calledPatient,
          timestamp: new Date().toISOString(),
        })
      }

      res.json({ patient: mapPatientForDashboard(calledPatient) })
    } catch (error) {
      res.status(500).json({ error: error.message })
    }
  }
)

// Call specific patient by ID
router.put("/call/:id", async (req, res) => {
  try {
    const patient = await updateStatus(req.params.id, "in-progress")

    if (!patient) {
      return res.status(404).json({ message: "Patient not found" })
    }

    const broadcast = req.app.get("broadcastQueueUpdate")
    if (broadcast) {
      broadcast({
        type: "patient-called",
        patient,
        timestamp: new Date().toISOString(),
      })
    }

    res.json(mapPatientForDashboard(patient))
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Complete patient by token number (used by doctor dashboard)
router.post(
  "/complete/:tokenNumber",
  authenticateStaff,
  authorizeRole("doctor"),
  async (req, res) => {
    try {
      const tokenNumber = Number(req.params.tokenNumber)
      
      // Find patient by token number and in-progress status
      const patient = await Patient.findOne({
        status: "in-progress",
        tokenNumber: tokenNumber
      })

      if (!patient) {
        return res.status(404).json({ 
          message: "Patient not found or not in progress" 
        })
      }

      const completedPatient = await updateStatus(patient._id, "completed")

      const broadcast = req.app.get("broadcastQueueUpdate")
      if (broadcast) {
        broadcast({
          type: "patient-completed",
          patient: completedPatient,
          timestamp: new Date().toISOString(),
        })
      }

      res.json({
        success: true,
        patient: mapPatientForDashboard(completedPatient),
        message: "Token cleared successfully",
      })
    } catch (error) {
      res.status(500).json({ error: error.message })
    }
  }
)

// Complete patient visit by ID
router.put("/complete/:id", async (req, res) => {
  try {
    const patient = await updateStatus(req.params.id, "completed")

    if (!patient) {
      return res.status(404).json({ message: "Patient not found" })
    }

    const broadcast = req.app.get("broadcastQueueUpdate")
    if (broadcast) {
      broadcast({
        type: "patient-completed",
        patient,
        timestamp: new Date().toISOString(),
      })
    }

    res.json(mapPatientForDashboard(patient))
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// SSE endpoint for real-time queue updates
router.get("/stream", (req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Cache-Control",
  })

  // Send initial connection message
  res.write("data: " + JSON.stringify({ type: "connected" }) + "\n\n")

  // Set up interval to send periodic updates (every 5 seconds)
  const interval = setInterval(async () => {
    try {
      const [waitingCount, inProgressCount] = await Promise.all([
        Patient.countDocuments({ status: "waiting" }),
        Patient.countDocuments({ status: "in-progress" })
      ])
      
      res.write("data: " + JSON.stringify({ 
        type: "queue-update",
        data: {
          waiting: waitingCount,
          inProgress: inProgressCount,
          total: waitingCount + inProgressCount
        }
      }) + "\n\n")
    } catch (error) {
      console.error("[v0] Error sending queue update:", error)
    }
  }, 5000)

  // Clean up when client disconnects
  req.on("close", () => {
    clearInterval(interval)
  })
})

module.exports = router
