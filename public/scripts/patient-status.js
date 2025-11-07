// Patient Status JavaScript

let refreshInterval = null
let eventSource = null

document.addEventListener("DOMContentLoaded", () => {
  const urlParams = new URLSearchParams(window.location.search)
  const cid = urlParams.get("cid")

  if (!cid) {
    showError("No CID provided. Please go back and enter your CID.")
    return
  }

  // Load initial status
  loadPatientStatus(cid)

  setupSSE(cid)

  // Set up auto-refresh every 30 seconds as fallback
  refreshInterval = setInterval(() => {
    loadPatientStatus(cid, true)
  }, 30000)

  // Manual refresh button
  document.getElementById("refreshButton").addEventListener("click", () => {
    loadPatientStatus(cid)
  })
})

function setupSSE(cid) {
  eventSource = new EventSource("/api/queue/stream")

  eventSource.onmessage = (event) => {
    const data = JSON.parse(event.data)

    if (data.type === "connected") {
      console.log("[v0] Connected to real-time updates")
      return
    }

    // Reload status when queue changes
    if (data.type === "patient-called" || data.type === "patient-completed" || data.type === "patient-registered") {
      const urlParams = new URLSearchParams(window.location.search)
      const currentCid = urlParams.get("cid")
      loadPatientStatus(currentCid, true)
    }
  }

  eventSource.onerror = (error) => {
    console.error("[v0] SSE connection error:", error)
    eventSource.close()
    // Reconnect after 5 seconds
    setTimeout(() => setupSSE(cid), 5000)
  }
}

async function loadPatientStatus(cid, silent = false) {
  const loadingState = document.getElementById("loadingState")
  const statusContent = document.getElementById("statusContent")
  const errorState = document.getElementById("errorState")

  if (!silent) {
    loadingState.style.display = "flex"
    statusContent.style.display = "none"
    errorState.style.display = "none"
  }

  try {
    const response = await fetch(`/api/patients/status/${cid}`)

    if (response.ok) {
      const data = await response.json()
      displayPatientStatus(data)

      loadingState.style.display = "none"
      statusContent.style.display = "block"
      errorState.style.display = "none"
    } else {
      const error = await response.json()
      showError(error.message || "Failed to load status")
    }
  } catch (error) {
    console.error("[v0] Error loading patient status:", error)
    showError("Connection error. Please check your internet connection.")
  }
}

function displayPatientStatus(data) {
  const { patient, queuePosition, estimatedWaitTime, totalWaiting } = data

  // Patient Info
  document.getElementById("patientName").textContent = patient.name
  document.getElementById("patientCid").textContent = patient.cid
  document.getElementById("queueNumber").textContent = `#${patient.queueNumber}`

  // Status Badge
  const statusBadge = document.getElementById("statusBadge")
  const statusText = document.getElementById("statusText")
  statusBadge.className = `status-badge status-${patient.status}`

  const statusLabels = {
    waiting: "Waiting in Queue",
    "in-progress": "Being Served",
    completed: "Completed",
    cancelled: "Cancelled",
  }
  statusText.textContent = statusLabels[patient.status] || patient.status

  // Queue Position (only show if waiting)
  const queuePositionCard = document.getElementById("queuePositionCard")
  if (patient.status === "waiting") {
    queuePositionCard.style.display = "flex"
    document.getElementById("positionNumber").textContent = queuePosition
  } else {
    queuePositionCard.style.display = "none"
  }

  // Estimated Wait Time
  const waitTimeElement = document.getElementById("waitTime")
  if (patient.status === "waiting" && estimatedWaitTime > 0) {
    waitTimeElement.textContent = `${estimatedWaitTime} minutes`
  } else if (patient.status === "in-progress") {
    waitTimeElement.textContent = "You're being served now!"
  } else if (patient.status === "completed") {
    waitTimeElement.textContent = "Visit completed"
  } else {
    waitTimeElement.textContent = "Please wait"
  }

  // Additional Info
  if (document.getElementById("visitReason")) {
    document.getElementById("visitReason").textContent = patient.reason || patient.chiefComplaint || "—"
  }
  document.getElementById("priorityLevel").textContent =
    patient.priority.charAt(0).toUpperCase() + patient.priority.slice(1)
  document.getElementById("joinedTime").textContent = new Date(patient.joinedAt).toLocaleTimeString()

  // Show notification if being called
  if (patient.status === "in-progress" && !sessionStorage.getItem(`notified-${patient.cidNumber}`)) {
    showNotification("It's your turn! Please proceed to the reception.")
    sessionStorage.setItem(`notified-${patient.cidNumber}`, "true")
  }
}

function showError(message) {
  document.getElementById("loadingState").style.display = "none"
  document.getElementById("statusContent").style.display = "none"
  document.getElementById("errorState").style.display = "flex"
  document.getElementById("errorMessage").textContent = message
}

function showNotification(message) {
  // Browser notification
  if ("Notification" in window && Notification.permission === "granted") {
    new Notification("Q-Less", {
      body: message,
      icon: "/favicon.ico",
    })
  }

  // Alert as fallback
  alert(message)
}

// Request notification permission on load
if ("Notification" in window && Notification.permission === "default") {
  Notification.requestPermission()
}

// Clean up on page unload
window.addEventListener("beforeunload", () => {
  if (refreshInterval) {
    clearInterval(refreshInterval)
  }
  if (eventSource) {
    eventSource.close()
  }
})
