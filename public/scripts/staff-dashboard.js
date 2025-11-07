// Staff Dashboard JavaScript

let staffToken = null
let staffRole = null
let staffName = null
let refreshInterval = null
let eventSource = null

document.addEventListener("DOMContentLoaded", () => {
  // Check authentication
  staffToken = localStorage.getItem("staffToken")
  staffRole = localStorage.getItem("staffRole")
  staffName = localStorage.getItem("staffName")

  if (!staffToken || !staffRole) {
    window.location.href = "/staff"
    return
  }

  // Display staff info
  document.getElementById("staffName").textContent = staffName || "Staff Member"
  document.getElementById("staffRole").textContent = staffRole.charAt(0).toUpperCase() + staffRole.slice(1)

  // Show appropriate section based on role
  if (staffRole === "receptionist") {
    document.getElementById("receptionistSection").style.display = "block"
    setupReceptionistHandlers()
  } else if (staffRole === "doctor") {
    document.getElementById("doctorSection").style.display = "block"
    setupDoctorHandlers()
  }

  // Setup common handlers
  setupCommonHandlers()

  // Load initial data
  loadDashboardData()

  setupSSE()

  // Auto-refresh every 30 seconds as fallback
  refreshInterval = setInterval(loadDashboardData, 30000)
})

function setupSSE() {
  eventSource = new EventSource("/api/queue/stream")

  eventSource.onmessage = (event) => {
    const data = JSON.parse(event.data)

    if (data.type === "connected") {
      console.log("[v0] Connected to real-time updates")
      return
    }

    // Reload dashboard when queue changes
    if (data.type === "patient-called" || data.type === "patient-completed" || data.type === "patient-registered") {
      loadDashboardData()

      // Show notification for staff
      if (data.type === "patient-registered") {
        showToast(`New patient registered: ${data.patient.name}`)
      } else if (data.type === "patient-called") {
        showToast(`Patient ${data.patient.name} is being called`)
      }
    }
  }

  eventSource.onerror = (error) => {
    console.error("[v0] SSE connection error:", error)
    eventSource.close()
    // Reconnect after 5 seconds
    setTimeout(setupSSE, 5000)
  }
}

function showToast(message) {
  const toast = document.createElement("div")
  toast.className = "toast-notification"
  toast.textContent = message
  document.body.appendChild(toast)

  setTimeout(() => {
    toast.classList.add("show")
  }, 100)

  setTimeout(() => {
    toast.classList.remove("show")
    setTimeout(() => {
      document.body.removeChild(toast)
    }, 300)
  }, 3000)
}

function setupCommonHandlers() {
  // Logout handler
  document.getElementById("logoutBtn").addEventListener("click", () => {
    localStorage.removeItem("staffToken")
    localStorage.removeItem("staffRole")
    localStorage.removeItem("staffName")
    localStorage.removeItem("staffId")
    clearInterval(refreshInterval)
    if (eventSource) {
      eventSource.close()
    }
    window.location.href = "/staff"
  })

  // Refresh button
  document.getElementById("refreshBtn").addEventListener("click", loadDashboardData)
}

function setupReceptionistHandlers() {
  const form = document.getElementById("addPatientForm")

  form.addEventListener("submit", async (e) => {
    e.preventDefault()

    const patientData = {
      name: document.getElementById("patientName").value,
      cidNumber: document.getElementById("patientCID").value,
      phone: document.getElementById("patientPhone").value,
      reason: document.getElementById("patientReason").value,
    }

    try {
      const response = await fetch("/api/patients/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${staffToken}`,
        },
        body: JSON.stringify(patientData),
      })

      const data = await response.json()

      if (response.ok) {
        alert(`Patient added successfully! Queue position: ${data.queuePosition}`)
        form.reset()
        loadDashboardData()
      } else {
        alert(data.message || "Failed to add patient")
      }
    } catch (error) {
      console.error("Error adding patient:", error)
      alert("An error occurred. Please try again.")
    }
  })
}

function setupDoctorHandlers() {
  // Call Next Patient
  document.getElementById("callNextBtn").addEventListener("click", async () => {
    try {
      const response = await fetch("/api/queue/call-next", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${staffToken}`,
        },
      })

      const data = await response.json()

      if (response.ok) {
        displayCurrentPatient(data.patient)
        loadDashboardData()
      } else {
        alert(data.message || "No patients in queue")
      }
    } catch (error) {
      console.error("Error calling next patient:", error)
      alert("An error occurred. Please try again.")
    }
  })

  // Complete Patient
  document.getElementById("completeBtn").addEventListener("click", async () => {
    const patientId = document.getElementById("completeBtn").dataset.patientId

    if (!patientId) return

    try {
      const response = await fetch(`/api/queue/complete/${patientId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${staffToken}`,
        },
      })

      const data = await response.json()

      if (response.ok) {
        alert("Patient marked as completed")
        hideCurrentPatient()
        loadDashboardData()
      } else {
        alert(data.message || "Failed to complete patient")
      }
    } catch (error) {
      console.error("Error completing patient:", error)
      alert("An error occurred. Please try again.")
    }
  })
}

async function loadDashboardData() {
  try {
    // Load stats
    const statsResponse = await fetch("/api/queue/stats", {
      headers: {
        Authorization: `Bearer ${staffToken}`,
      },
    })

    if (statsResponse.ok) {
      const stats = await statsResponse.json()
      updateStats(stats)
    }

    // Load queue
    const queueResponse = await fetch("/api/queue", {
      headers: {
        Authorization: `Bearer ${staffToken}`,
      },
    })

    if (queueResponse.ok) {
      const queue = await queueResponse.json()
      updateQueueTable(queue)
    }
  } catch (error) {
    console.error("Error loading dashboard data:", error)
  }
}

function updateStats(stats) {
  document.getElementById("waitingCount").textContent = stats.waiting || 0
  document.getElementById("inProgressCount").textContent = stats.inProgress || 0
  document.getElementById("completedCount").textContent = stats.completedToday || 0
  document.getElementById("avgWaitTime").textContent = stats.avgWaitTime || 0
}

function updateQueueTable(queue) {
  const tbody = document.getElementById("queueTableBody")

  if (!queue || queue.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" class="no-data">No patients in queue</td></tr>'
    return
  }

  tbody.innerHTML = queue
    .map(
      (patient, index) => `
    <tr class="queue-row status-${patient.status}">
      <td><span class="position-badge">${index + 1}</span></td>
      <td>${patient.cidNumber}</td>
      <td>${patient.name}</td>
      <td>${patient.phone}</td>
      <td>${patient.reason}</td>
      <td><span class="status-badge status-${patient.status}">${patient.status}</span></td>
      <td>${calculateWaitTime(patient.joinedAt)}</td>
      <td>
        ${
          patient.status === "waiting"
            ? `<button class="btn-small btn-primary" onclick="callPatient('${patient._id}')">Call</button>`
            : patient.status === "in-progress"
              ? `<button class="btn-small btn-success" onclick="completePatient('${patient._id}')">Complete</button>`
              : ""
        }
      </td>
    </tr>
  `,
    )
    .join("")
}

function displayCurrentPatient(patient) {
  document.getElementById("currentPatientCard").style.display = "block"
  document.getElementById("noPatientMessage").style.display = "none"
  document.getElementById("currentPatientName").textContent = patient.name
  document.getElementById("currentPatientDetails").textContent =
    `CID: ${patient.cidNumber} | Phone: ${patient.phone} | Reason: ${patient.reason}`
  document.getElementById("completeBtn").dataset.patientId = patient._id
}

function hideCurrentPatient() {
  document.getElementById("currentPatientCard").style.display = "none"
  document.getElementById("noPatientMessage").style.display = "block"
}

function calculateWaitTime(joinedAt) {
  const now = new Date()
  const joined = new Date(joinedAt)
  const diffMinutes = Math.floor((now - joined) / 1000 / 60)
  return `${diffMinutes} min`
}

// Global functions for table actions
window.callPatient = async (patientId) => {
  try {
    const response = await fetch(`/api/queue/call/${patientId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${staffToken}`,
      },
    })

    if (response.ok) {
      loadDashboardData()
    }
  } catch (error) {
    console.error("Error calling patient:", error)
  }
}

window.completePatient = async (patientId) => {
  try {
    const response = await fetch(`/api/queue/complete/${patientId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${staffToken}`,
      },
    })

    if (response.ok) {
      loadDashboardData()
    }
  } catch (error) {
    console.error("Error completing patient:", error)
  }
}
