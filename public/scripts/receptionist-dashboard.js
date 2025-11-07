document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("registrationForm")
  const modal = document.getElementById("successModal")
  const continueBtn = document.getElementById("continueBtn")
  const recentList = document.getElementById("recentList")
  const logoutBtn = document.getElementById("logoutBtn")

  // Load recent registrations
  loadRecentRegistrations()

  // Real-time updates via SSE
  try {
    const es = new EventSource("/api/queue/stream")
    es.onmessage = (event) => {
      const data = JSON.parse(event.data)
      if (
        data.type === "patient-registered" ||
        data.type === "patient-called" ||
        data.type === "patient-completed"
      ) {
        loadRecentRegistrations()
      }
    }
    es.onerror = () => {
      es.close()
      setTimeout(() => {
        // best-effort reconnect
        window.location.reload()
      }, 5000)
    }
  } catch (e) {
    console.warn("SSE not available", e)
  }

  // Form submission
  form.addEventListener("submit", async (e) => {
    e.preventDefault()

    const formData = {
      cid: document.getElementById("cidNumber").value,
      name: document.getElementById("name").value,
      age: Number.parseInt(document.getElementById("age").value),
      gender: document.getElementById("gender").value,
      dob: document.getElementById("dob").value,
      chiefComplaint: document.getElementById("complaint").value,
      tokenNumber: document.getElementById("tokenNumber").value,
      chamber: document.getElementById("chamber").value,
    }

    try {
      const response = await fetch("/api/patients/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })

      if (response.ok) {
        modal.style.display = "flex"
        form.reset()
      } else {
        alert("Registration failed. Please try again.")
      }
    } catch (error) {
      console.error("Error:", error)
      alert("An error occurred. Please try again.")
    }
  })

  // Continue button
  continueBtn.addEventListener("click", () => {
    modal.style.display = "none"
    loadRecentRegistrations()
  })

  // Logout
  logoutBtn.addEventListener("click", () => {
    localStorage.removeItem("staffToken")
    window.location.href = "/staff"
  })

  // Load recent registrations
  async function loadRecentRegistrations() {
    try {
      const response = await fetch("/api/patients?limit=5")
      const patients = await response.json()

      if (patients.length === 0) {
        recentList.innerHTML = `
                    <div class="empty-state">
                        <svg class="empty-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" stroke="#94A3B8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                        <p class="empty-text">No patients registered yet</p>
                    </div>
                `
      } else {
        recentList.innerHTML = patients
          .map(
            (patient) => `
                    <div class="recent-item">
                        <div class="recent-icon">
                            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <circle cx="12" cy="12" r="10" fill="#3B82F6"/>
                                <path d="M9 12l2 2 4-4" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                        </div>
                        <div class="recent-content">
                            <h3 class="recent-name">${patient.name}</h3>
                            <p class="recent-details">Registered successfully. Token #${patient.tokenNumber} assigned.</p>
                            <span class="recent-time">${new Date(patient.createdAt).toLocaleString()}</span>
                        </div>
                    </div>
                `,
          )
          .join("")
      }
    } catch (error) {
      console.error("Error loading registrations:", error)
    }
  }
})
