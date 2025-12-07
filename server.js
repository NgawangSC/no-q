const express = require("express")
const path = require("path")
const cors = require("cors")
const cookieParser = require("cookie-parser")

// Only load dotenv in development (Railway provides env vars in production)
if (process.env.NODE_ENV !== 'production') {
  require("dotenv").config()
}

const { connectDB } = require('./config/mongo')

const app = express()
const PORT = process.env.PORT || 3000

// CORS configuration
const corsOptions = {
  origin: process.env.CLIENT_ORIGIN || "http://localhost:3000",
  credentials: true
}

// Middleware
app.use(cors(corsOptions))
app.use(cookieParser())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(express.static("public"))

const sseClients = new Set()

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

app.get("/admin-register", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin-register.html"))
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

app.get("/admin-dashboard", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin-dashboard.html"))
})

app.get("/staff-management", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "staff-management.html"))
})

app.get("/specializations-management", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "specializations-management.html"))
})

app.get("/chambers-management", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "chambers-management.html"))
})

app.get("/doctor-profile-management", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "doctor-profile-management.html"))
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

// Validate required environment variables (only at runtime, not during build)
// This check only runs when the server actually starts, not during build
if (typeof process !== 'undefined' && process.env) {
  if (!process.env.JWT_SECRET) {
    console.error("⚠️  WARNING: JWT_SECRET is not set! Authentication will fail.")
    console.error("   Please set JWT_SECRET in your environment variables.")
  }

  // MongoDB Connection
  if (process.env.MONGODB_URI) {
    console.log("MongoDB URI detected, trying to connect...")
    connectDB().catch((err) => {
      console.error("❌ MongoDB connection failed:", err.message)
      console.error("   Please check your MONGODB_URI environment variable.")
    })
  } else {
    console.warn("⚠️  WARNING: MONGODB_URI not set. Skipping MongoDB connection.")
    console.warn("   Database operations will fail. Please set MONGODB_URI.")
  }
}

// API Routes
app.use("/api/patients", require("./routes/patients"))
app.use("/api/staff", require("./routes/staff"))
app.use("/api/doctor", require("./routes/doctor"))
app.use("/api/queue", require("./routes/queue"))

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
  console.log(`No-Q server running on http://localhost:${PORT}`)
})

module.exports = app
