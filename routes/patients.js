const express = require("express")
const router = express.Router()
const Patient = require("../models/Patient")

// Get all patients in queue
router.get("/", async (req, res) => {
  try {
    const { status, limit } = req.query
    const filter = status ? { status } : { status: { $in: ["waiting", "in-progress"] } }

    let query = Patient.find(filter).sort({ createdAt: -1 }).populate("assignedDoctor", "name role")

    if (limit) {
      query = query.limit(Number.parseInt(limit))
    }

    const patients = await query
    res.json(patients)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Check patient status by CID
router.get("/status/:cid", async (req, res) => {
  try {
    const patient = await Patient.findOne({
      cid: req.params.cid,
      status: { $in: ["waiting", "in-progress"] },
    }).populate("assignedDoctor", "name role")

    if (!patient) {
      return res.status(404).json({ message: "Patient not found in queue" })
    }

    // Calculate queue position and estimated wait time
    let queuePosition = 0
    let estimatedWaitTime = 0

    if (patient.status === "waiting") {
      queuePosition = await Patient.countDocuments({
        status: "waiting",
        chamber: patient.chamber,
        queueNumber: { $lt: patient.queueNumber },
      })

      // Estimate 15 minutes per patient
      estimatedWaitTime = queuePosition * 15
    }

    res.json({
      patient,
      queuePosition,
      estimatedWaitTime,
      totalWaiting: await Patient.countDocuments({ status: "waiting", chamber: patient.chamber }),
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

router.post("/register", async (req, res) => {
  try {
    const { cid, name, age, gender, dob, chiefComplaint, tokenNumber, chamber } = req.body

    // Check if patient already exists in queue
    const existingPatient = await Patient.findOne({
      cid,
      status: { $in: ["waiting", "in-progress"] },
    })

    if (existingPatient) {
      return res.status(400).json({
        message: "Patient already in queue",
        patient: existingPatient,
      })
    }

    // Get the last queue number for today
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const lastPatient = await Patient.findOne({
      joinedAt: { $gte: today },
    }).sort({ queueNumber: -1 })

    const queueNumber = lastPatient ? lastPatient.queueNumber + 1 : 1

    const patient = new Patient({
      cid,
      name,
      age,
      gender,
      dob,
      chiefComplaint,
      tokenNumber,
      chamber,
      queueNumber,
      status: "waiting",
      priority: "normal",
      joinedAt: new Date(),
    })

    await patient.save()

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
    const patient = await Patient.findById(req.params.id).populate("assignedDoctor", "name role")
    if (!patient) {
      return res.status(404).json({ error: "Patient not found" })
    }
    res.json(patient)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Update patient status
router.patch("/:id", async (req, res) => {
  try {
    const updates = req.body

    if (updates.status === "in-progress" && !updates.calledAt) {
      updates.calledAt = new Date()
    }
    if (updates.status === "completed" && !updates.completedAt) {
      updates.completedAt = new Date()
    }

    const patient = await Patient.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    }).populate("assignedDoctor", "name role")

    if (!patient) {
      return res.status(404).json({ error: "Patient not found" })
    }

    // Broadcast SSE update
    const broadcast = req.app.get("broadcastQueueUpdate")
    if (broadcast) {
      broadcast({
        type: "patient-updated",
        patient: patient,
        timestamp: new Date().toISOString(),
      })
    }

    res.json(patient)
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

router.delete("/:id", async (req, res) => {
  try {
    const patient = await Patient.findByIdAndUpdate(req.params.id, { status: "cancelled" }, { new: true })
    if (!patient) {
      return res.status(404).json({ error: "Patient not found" })
    }
    res.json({ message: "Patient removed from queue", patient })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

module.exports = router
