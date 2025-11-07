const express = require("express")
const mongoose = require("mongoose")
const path = require("path")
const cors = require("cors")
require("dotenv").config()

const app = express()
const PORT = process.env.PORT || 3000

// Middleware
app.use(cors())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(express.static("public"))

const sseClients = new Set()

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/qless"

mongoose
  .connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("✅ Connected to MongoDB"))
  .catch((err) => console.error("❌ MongoDB connection error:", err))

// Routes
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"))
})

app.get("/patient", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "patient-portal.html"))
})

app.get("/staff", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "staff-portal.html"))
})

app.get("/staff-dashboard", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "staff-dashboard.html"))
})

app.get("/receptionist-dashboard", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "receptionist-dashboard.html"))
})

app.get("/doctor-dashboard", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "doctor-dashboard.html"))
})

app.get("/patient-dashboard", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "patient-dashboard.html"))
})

app.get("/patient-register", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "patient-register.html"))
})

app.get("/patient-status", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "patient-status.html"))
})

app.get("/notifications", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "notifications.html"))
})

app.get("/analytics", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "analytics.html"))
})

app.get("/admin-dashboard", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin-dashboard.html"))
})

app.get("/api/queue/stream", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream")
  res.setHeader("Cache-Control", "no-cache")
  res.setHeader("Connection", "keep-alive")

  // Add client to the set
  sseClients.add(res)

  // Send initial connection message
  res.write("data: " + JSON.stringify({ type: "connected" }) + "\n\n")

  // Remove client on disconnect
  req.on("close", () => {
    sseClients.delete(res)
  })
})

function broadcastQueueUpdate(data) {
  const message = "data: " + JSON.stringify(data) + "\n\n"
  sseClients.forEach((client) => {
    client.write(message)
  })
}

app.set("broadcastQueueUpdate", broadcastQueueUpdate)

// API Routes (to be implemented)
app.use("/api/patients", require("./routes/patients"))
app.use("/api/staff", require("./routes/staff"))
app.use("/api/queue", require("./routes/queue"))
app.use("/api/analytics", require("./routes/analytics"))

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack)
  res.status(500).json({
    error: "Something went wrong!",
    message: err.message,
  })
})

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Q-Less server running on http://localhost:${PORT}`)
})

module.exports = app
