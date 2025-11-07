document.addEventListener("DOMContentLoaded", () => {
  const refreshBtn = document.getElementById("refreshBtn")
  const noTokenState = document.getElementById("noTokenState")
  const tokenStatus = document.getElementById("tokenStatus")
  const welcomeMessage = document.getElementById("welcomeMessage")

  // Get CID from URL or localStorage
  const urlParams = new URLSearchParams(window.location.search)
  const cid = urlParams.get("cid") || localStorage.getItem("patientCID")

  if (cid) {
    loadPatientStatus(cid)
  }

  // Refresh button
  if (refreshBtn) {
    refreshBtn.addEventListener("click", () => {
      if (cid) loadPatientStatus(cid)
    })
  }

  // Load patient status
  async function loadPatientStatus(cid) {
    try {
      const response = await fetch(`/api/patients/status/${cid}`)
      const data = await response.json()

      if (data.patient) {
        welcomeMessage.textContent = `Welcome, ${data.patient.name}`

        if (data.patient.status === "waiting" || data.patient.status === "in-progress") {
          noTokenState.style.display = "none"
          tokenStatus.style.display = "block"
          // Redirect to status page
          window.location.href = `/patient-status?cid=${cid}`
        } else {
          noTokenState.style.display = "flex"
          tokenStatus.style.display = "none"
        }
      } else {
        welcomeMessage.textContent = "Welcome, Patient"
        noTokenState.style.display = "flex"
        tokenStatus.style.display = "none"
      }
    } catch (error) {
      console.error("Error loading status:", error)
      noTokenState.style.display = "flex"
      tokenStatus.style.display = "none"
    }
  }
})
