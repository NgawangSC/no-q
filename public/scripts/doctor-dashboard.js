document.addEventListener("DOMContentLoaded", () => {
  const clearTokenBtn = document.getElementById("clearTokenBtn")
  const refreshBtn = document.getElementById("refreshBtn")
  const logoutBtn = document.getElementById("logoutBtn")

  // Load current patient
  loadCurrentPatient()

  // Real-time updates via SSE + fallback interval
  try {
    const es = new EventSource("/api/queue/stream")
    es.onmessage = (event) => {
      const data = JSON.parse(event.data)
      if (
        data.type === "patient-registered" ||
        data.type === "patient-called" ||
        data.type === "patient-completed" ||
        data.type === "patient-updated"
      ) {
        loadCurrentPatient()
      }
    }
    es.onerror = () => {
      es.close()
      // fallback polling if SSE drops
      setInterval(loadCurrentPatient, 30000)
    }
  } catch (e) {
    setInterval(loadCurrentPatient, 30000)
  }

  // Clear token button
  clearTokenBtn.addEventListener("click", async () => {
    if (confirm("Are you sure you want to clear this token?")) {
      try {
        const tokenNumber = document.getElementById("currentToken").textContent
        const response = await fetch(`/api/queue/complete/${tokenNumber}`, {
          method: "POST",
        })

        if (response.ok) {
          alert("Token cleared successfully!")
          loadCurrentPatient()
        } else {
          alert("Failed to clear token. Please try again.")
        }
      } catch (error) {
        console.error("Error:", error)
        alert("An error occurred. Please try again.")
      }
    }
  })

  // Refresh button
  refreshBtn.addEventListener("click", loadCurrentPatient)

  // Logout
  logoutBtn.addEventListener("click", () => {
    localStorage.removeItem("staffToken")
    window.location.href = "/staff"
  })

  // Load current patient
  async function loadCurrentPatient() {
    try {
      const response = await fetch("/api/queue/current")
      const data = await response.json()

      if (data.patient) {
        document.getElementById("currentToken").textContent = data.patient.tokenNumber
        document.getElementById("patientName").textContent = data.patient.name
        document.getElementById("patientCID").textContent = data.patient.cid
        document.getElementById("patientDOB").textContent = new Date(data.patient.dob).toLocaleDateString()
        document.getElementById("patientAge").textContent = data.patient.age
        document.getElementById("patientComplaint").textContent = data.patient.chiefComplaint

        document.getElementById("patientInfo").style.display = "block"
        document.getElementById("noPatient").style.display = "none"
      } else {
        document.getElementById("currentToken").textContent = "-"
        document.getElementById("patientInfo").style.display = "none"
        document.getElementById("noPatient").style.display = "block"
      }

      // Update queue overview
      document.getElementById("chamberLocation").textContent = `Chamber No: ${data.chamber || "-"}`
      document.getElementById("expectedTime").textContent = `${data.expectedTime || "-"} Minutes`
      document.getElementById("tokenNo").textContent = `Token No: ${data.patient?.tokenNumber || "-"}`
      document.getElementById("waitingCount").textContent = `${data.waitingCount || 0} people`
      document.getElementById("lastUpdated").textContent = `Last Updated ${new Date().toLocaleTimeString()}`
    } catch (error) {
      console.error("Error loading patient:", error)
    }
  }
})
