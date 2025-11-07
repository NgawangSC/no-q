const express = require("express")
const router = express.Router()
const Patient = require("../models/Patient")

// Get analytics data
router.get("/", async (req, res) => {
  try {
    const { startDate, endDate } = req.query

    const start = startDate ? new Date(startDate) : new Date(new Date().setDate(new Date().getDate() - 7))
    const end = endDate ? new Date(endDate) : new Date()

    start.setHours(0, 0, 0, 0)
    end.setHours(23, 59, 59, 999)

    // Daily patient count
    const dailyStats = await Patient.aggregate([
      {
        $match: {
          joinedAt: { $gte: start, $lte: end },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$joinedAt" },
          },
          total: { $sum: 1 },
          completed: {
            $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] },
          },
          cancelled: {
            $sum: { $cond: [{ $eq: ["$status", "cancelled"] }, 1, 0] },
          },
        },
      },
      { $sort: { _id: 1 } },
    ])

    // Hourly distribution
    const hourlyStats = await Patient.aggregate([
      {
        $match: {
          joinedAt: { $gte: start, $lte: end },
        },
      },
      {
        $group: {
          _id: { $hour: "$joinedAt" },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ])

    // Average wait time by hour
    const waitTimeByHour = await Patient.aggregate([
      {
        $match: {
          status: "completed",
          joinedAt: { $gte: start, $lte: end },
          calledAt: { $exists: true },
        },
      },
      {
        $project: {
          hour: { $hour: "$joinedAt" },
          waitTime: {
            $subtract: ["$calledAt", "$joinedAt"],
          },
        },
      },
      {
        $group: {
          _id: "$hour",
          avgWaitTime: { $avg: "$waitTime" },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ])

    // Priority distribution
    const priorityStats = await Patient.aggregate([
      {
        $match: {
          joinedAt: { $gte: start, $lte: end },
        },
      },
      {
        $group: {
          _id: "$priority",
          count: { $sum: 1 },
        },
      },
    ])

    // Status distribution
    const statusStats = await Patient.aggregate([
      {
        $match: {
          joinedAt: { $gte: start, $lte: end },
        },
      },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ])

    // Overall statistics
    const totalPatients = await Patient.countDocuments({
      joinedAt: { $gte: start, $lte: end },
    })

    const completedPatients = await Patient.countDocuments({
      status: "completed",
      joinedAt: { $gte: start, $lte: end },
    })

    const avgWaitTimeResult = await Patient.aggregate([
      {
        $match: {
          status: "completed",
          joinedAt: { $gte: start, $lte: end },
          calledAt: { $exists: true },
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

    const avgServiceTimeResult = await Patient.aggregate([
      {
        $match: {
          status: "completed",
          joinedAt: { $gte: start, $lte: end },
          calledAt: { $exists: true },
          completedAt: { $exists: true },
        },
      },
      {
        $project: {
          serviceTime: {
            $subtract: ["$completedAt", "$calledAt"],
          },
        },
      },
      {
        $group: {
          _id: null,
          avgServiceTime: { $avg: "$serviceTime" },
        },
      },
    ])

    res.json({
      dateRange: { start, end },
      overview: {
        totalPatients,
        completedPatients,
        completionRate: totalPatients > 0 ? ((completedPatients / totalPatients) * 100).toFixed(1) : 0,
        avgWaitTime: Math.round((avgWaitTimeResult[0]?.avgWaitTime || 0) / 60000),
        avgServiceTime: Math.round((avgServiceTimeResult[0]?.avgServiceTime || 0) / 60000),
      },
      dailyStats,
      hourlyStats,
      waitTimeByHour: waitTimeByHour.map((item) => ({
        hour: item._id,
        avgWaitTime: Math.round(item.avgWaitTime / 60000),
        count: item.count,
      })),
      priorityStats,
      statusStats,
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

module.exports = router
