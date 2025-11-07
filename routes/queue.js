const express = require("express")
const router = express.Router()
const Patient = require("../models/Patient")

// Get all patients in queue
router.get("/", async (req, res) => {
  try {
    const queue = await Patient.find({
      status: { $in: ["waiting", "in-progress"] },
    })
      .populate("assignedDoctor", "name role")
      .sort({ priority: -1, queueNumber: 1 })

    res.json(queue)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Get queue statistics
router.get("/stats", async (req, res) => {
  try {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const waiting = await Patient.countDocuments({ status: "waiting" })
    const inProgress = await Patient.countDocuments({ status: "in-progress" })
    const completed = await Patient.countDocuments({
      status: "completed",
      completedAt: { $gte: today },
    })

    const avgWaitTime = await Patient.aggregate([
      {
        $match: {
          status: "completed",
          completedAt: { $gte: today },
        },
      },
      {
        $project: {
          waitTime: {
            $subtract: ["$calledAt", "$joinedAt"],
          },
        },
      },
      {
        $group: {
          _id: null,
          avgWaitTime: { $avg: "$waitTime" },
        },
      },
    ])

    const priorityBreakdown = await Patient.aggregate([
      { $match: { status: "waiting" } },
      { $group: { _id: "$priority", count: { $sum: 1 } } },
    ])

    res.json({
      waiting,
      inProgress,
      completedToday: completed,
      avgWaitTime: Math.round((avgWaitTime[0]?.avgWaitTime || 0) / 60000), // Convert to minutes
      priorityBreakdown,
      totalToday: waiting + inProgress + completed,
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

router.get("/current", async (req, res) => {
  try {
    const { chamber } = req.query

    // Get current patient in progress for this chamber
    let currentPatient = await Patient.findOne({
      status: "in-progress",
      chamber: chamber,
    }).populate("assignedDoctor", "name role")

    // If no current patient, get the next waiting patient
    if (!currentPatient) {
      currentPatient = await Patient.findOne({
        status: "waiting",
        chamber: chamber,
      }).sort({ queueNumber: 1 })
    }

    // Get waiting count for this chamber
    const waitingCount = await Patient.countDocuments({
      status: "waiting",
      chamber: chamber,
    })

    res.json({
      patient: currentPatient,
      chamber: chamber,
      waitingCount: waitingCount,
      expectedTime: waitingCount * 15, // 15 minutes per patient
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Call next patient
router.post("/call-next", async (req, res) => {
  try {
    const { doctorId, chamber } = req.body

    const nextPatient = await Patient.findOne({
      status: "waiting",
      chamber: chamber,
    }).sort({ priority: -1, queueNumber: 1 })

    if (!nextPatient) {
      return res.status(404).json({ message: "No patients in queue" })
    }

    nextPatient.status = "in-progress"
    nextPatient.calledAt = new Date()
    if (doctorId) {
      nextPatient.assignedDoctor = doctorId
    }
    await nextPatient.save()

    await nextPatient.populate("assignedDoctor", "name role")

    const broadcast = req.app.get("broadcastQueueUpdate")
    if (broadcast) {
      broadcast({
        type: "patient-called",
        patient: nextPatient,
        timestamp: new Date().toISOString(),
      })
    }

    res.json({ patient: nextPatient })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Call specific patient
router.put("/call/:id", async (req, res) => {
  try {
    const patient = await Patient.findById(req.params.id)

    if (!patient) {
      return res.status(404).json({ message: "Patient not found" })
    }

    patient.status = "in-progress"
    patient.calledAt = new Date()
    await patient.save()

    const broadcast = req.app.get("broadcastQueueUpdate")
    if (broadcast) {
      broadcast({
        type: "patient-called",
        patient: patient,
        timestamp: new Date().toISOString(),
      })
    }

    res.json(patient)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

router.post("/complete/:tokenNumber", async (req, res) => {
  try {
    const patient = await Patient.findOne({
      tokenNumber: req.params.tokenNumber,
      status: "in-progress",
    })

    if (!patient) {
      return res.status(404).json({ message: "Patient not found or not in progress" })
    }

    patient.status = "completed"
    patient.completedAt = new Date()
    await patient.save()

    const broadcast = req.app.get("broadcastQueueUpdate")
    if (broadcast) {
      broadcast({
        type: "patient-completed",
        patient: patient,
        timestamp: new Date().toISOString(),
      })
    }

    res.json({
      success: true,
      patient: patient,
      message: "Token cleared successfully",
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Complete patient visit by ID
router.put("/complete/:id", async (req, res) => {
  try {
    const patient = await Patient.findById(req.params.id)

    if (!patient) {
      return res.status(404).json({ message: "Patient not found" })
    }

    patient.status = "completed"
    patient.completedAt = new Date()
    await patient.save()

    const broadcast = req.app.get("broadcastQueueUpdate")
    if (broadcast) {
      broadcast({
        type: "patient-completed",
        patient: patient,
        timestamp: new Date().toISOString(),
      })
    }

    res.json(patient)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

module.exports = router
