// Receptionist Dashboard JavaScript

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("registrationForm")
  const recentList = document.getElementById("recentList")
  const logoutBtn = document.getElementById("logoutBtn")
  const messageContainer = document.getElementById("messageContainer")
  const submitBtn = document.getElementById("submitBtn")
  const submitBtnText = submitBtn.querySelector(".btn-text")
  const dobInput = document.getElementById("dob")
  const ageInput = document.getElementById("age")
  const tokenSelect = document.getElementById("tokenNumber")
  const chamberSelect = document.getElementById("chamber")

  // Simple auth guard on role
  const staffRole = localStorage.getItem("staffRole")
  const staffId = localStorage.getItem("staffId")
  if (!staffRole || staffRole !== "receptionist" || !staffId) {
    window.location.href = "/staff"
    return
  }

  // Toast wrapper
  function showMessage(message, type = "success") {
    if (window.NoQ && window.NoQ.toast) {
      const toastType =
        type === "error"
          ? "error"
          : type === "info"
          ? "info"
          : "success"
      window.NoQ.toast(message, toastType)
    } else {
      alert(message)
    }
  }

  // Authenticated fetch helper using cookie
  async function apiFetch(url, options = {}) {
    const response = await fetch(url, {
      ...options,
      credentials: "include", // send auth_token cookie
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
    })

    if (response.status === 401 || response.status === 403) {
      localStorage.removeItem("staffRole")
      localStorage.removeItem("staffName")
      localStorage.removeItem("staffId")
      window.location.href = "/staff"
      throw new Error("Unauthorized")
    }

    return response
  }

  // Initialize chambers with specializations
  initializeChambers()

  // Load available tokens
  loadAvailableTokens()

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
        if (data.type === "patient-registered") {
          if (
            chamberSelect.value &&
            data.patient &&
            data.patient.chamber == chamberSelect.value
          ) {
            loadAvailableTokens()
          }
        }
      }
    }
    es.onerror = () => {
      es.close()
      setTimeout(() => {
        window.location.reload()
      }, 5000)
    }
  } catch (e) {
    console.warn("SSE not available", e)
  }

  // Initialize chambers with specializations and add event listener for token loading
  async function initializeChambers() {
    chamberSelect.innerHTML =
      '<option value="" disabled selected>Select chamber</option>'

    try {
      // Load chambers
      const response = await apiFetch("/api/doctor/chambers")
      if (response.ok) {
        const chambers = await response.json()

        // Load specializations (once)
        const specResponse = await apiFetch("/api/doctor/specializations")
        const specializations = specResponse.ok
          ? await specResponse.json()
          : []

        // For each chamber, find assigned specs
        for (const chamber of chambers) {
          const assignedSpecs = []

          for (const spec of specializations) {
            const chamberSpecResponse = await apiFetch(
              `/api/doctor/specializations/${spec.id}/chambers`
            )

            if (chamberSpecResponse.ok) {
              const assignedChambers = await chamberSpecResponse.json()
              if (assignedChambers.some((ch) => ch.id === chamber.id)) {
                assignedSpecs.push(spec.name)
              }
            }
          }

          const option = document.createElement("option")
          option.value = chamber.id
          const specText =
            assignedSpecs.length > 0
              ? ` (${assignedSpecs.join(", ")})`
              : ""
          option.textContent = `${chamber.chamber_number}${specText}`
          chamberSelect.appendChild(option)
        }
      }
    } catch (error) {
      console.error("Error loading chambers:", error)
    }

    chamberSelect.addEventListener("change", loadAvailableTokens)
  }

  // Get next available token number for selected chamber
  async function loadAvailableTokens() {
    const selectedChamber = chamberSelect.value

    if (!selectedChamber) {
      tokenSelect.innerHTML =
        '<option value="" disabled selected>Please select chamber first</option>'
      tokenSelect.disabled = true
      return
    }

    tokenSelect.disabled = false

    try {
      const response = await apiFetch(
        `/api/patients/tokens/next-available/${selectedChamber}`
      )

      if (response.ok) {
        const nextToken = await response.json()
        tokenSelect.innerHTML = ""

        const selectedOption = chamberSelect.options[chamberSelect.selectedIndex]
        const chamberText = selectedOption
          ? selectedOption.textContent.split(" (")[0]
          : `Chamber ${selectedChamber}`

        const option = document.createElement("option")
        option.value = nextToken
        option.textContent = `Token ${nextToken} (${chamberText})`
        option.selected = true
        tokenSelect.appendChild(option)

        for (let i = 1; i <= 3; i++) {
          const futureToken = nextToken + i
          if (futureToken <= 100) {
            const futureOption = document.createElement("option")
            futureOption.value = futureToken
            futureOption.textContent = `Token ${futureToken} (${chamberText} - Future)`
            futureOption.disabled = true
            tokenSelect.appendChild(futureOption)
          }
        }
      } else {
        const fallbackToken = await getCurrentTokenCount(selectedChamber)
        tokenSelect.innerHTML = ""

        const selectedOption = chamberSelect.options[chamberSelect.selectedIndex]
        const chamberText = selectedOption
          ? selectedOption.textContent.split(" (")[0]
          : `Chamber ${selectedChamber}`

        const option = document.createElement("option")
        option.value = fallbackToken
        option.textContent = `Token ${fallbackToken} (${chamberText})`
        option.selected = true
        tokenSelect.appendChild(option)
      }
    } catch (error) {
      console.error("Error loading available tokens:", error)
      tokenSelect.innerHTML = ""

      const selectedOption = chamberSelect.options[chamberSelect.selectedIndex]
      const chamberText = selectedOption
        ? selectedOption.textContent.split(" (")[0]
        : `Chamber ${selectedChamber}`

      const option = document.createElement("option")
      option.value = 1
      option.textContent = `Token 1 (${chamberText})`
      option.selected = true
      tokenSelect.appendChild(option)
    }
  }

  // Helper function to get current token count for specific chamber (fallback)
  async function getCurrentTokenCount(chamber) {
    try {
      const response = await apiFetch("/api/patients/receptionist/recent")
      if (response.ok) {
        const patients = await response.json()
        const highestToken = patients.reduce((max, patient) => {
          if (patient.chamber == chamber) {
            return Math.max(max, parseInt(patient.token_number) || 0)
          }
          return max
        }, 0)
        return highestToken + 1
      }
    } catch (error) {
      console.error("Error getting current token count:", error)
    }
    return 1
  }

  // Auto-format date input as DD-MM-YYYY
  function formatDateString(input) {
    let value = input.value.replace(/\D/g, "")

    if (value.length >= 2) {
      value = value.slice(0, 2) + "-" + value.slice(2)
    }
    if (value.length >= 5) {
      value = value.slice(0, 5) + "-" + value.slice(5)
    }
    if (value.length > 10) {
      value = value.slice(0, 10)
    }

    return value
  }

  function isValidDate(dateString) {
    const regex =
      /^(0[1-9]|[12][0-9]|3[01])-(0[1-9]|1[0-2])-\d{4}$/
    if (!regex.test(dateString)) return false

    const parts = dateString.split("-")
    const day = parseInt(parts[0])
    const month = parseInt(parts[1]) - 1
    const year = parseInt(parts[2])

    const date = new Date(year, month, day)
    return (
      date.getDate() === day &&
      date.getMonth() === month &&
      date.getFullYear() === year
    )
  }

  function calculateAge() {
    if (!dobInput.value) {
      ageInput.value = ""
      return
    }

    if (!isValidDate(dobInput.value)) {
      ageInput.value = ""
      return
    }

    const dateParts = dobInput.value.split("-")
    const day = parseInt(dateParts[0])
    const month = parseInt(dateParts[1]) - 1
    const year = parseInt(dateParts[2])

    const birthDate = new Date(year, month, day)
    const today = new Date()

    if (isNaN(birthDate.getTime()) || birthDate > today) {
      ageInput.value = ""
      return
    }

    let age = today.getFullYear() - birthDate.getFullYear()
    const monthDiff = today.getMonth() - birthDate.getMonth()
    const dayDiff = today.getDate() - birthDate.getDate()

    if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
      age--
    }

    if (age >= 0 && age <= 120) {
      ageInput.value = age
    } else {
      ageInput.value = ""
    }
  }

  dobInput.addEventListener("input", (e) => {
    const formattedValue = formatDateString(e.target)
    if (e.target.value !== formattedValue) {
      e.target.value = formattedValue
    }

    if (formattedValue.length === 10) {
      calculateAge()
    } else {
      ageInput.value = ""
    }
  })

  dobInput.addEventListener("change", (e) => {
    calculateAge()
    if (e.target.value && isValidDate(e.target.value)) {
      ageInput.classList.add("calculated")
    } else {
      ageInput.value = ""
      ageInput.classList.remove("calculated")
    }
  })

  dobInput.addEventListener("keypress", (e) => {
    const char = String.fromCharCode(e.which)
    if (!/[0-9]/.test(char)) {
      e.preventDefault()
    }
  })

  function setLoading(isLoading) {
    if (isLoading) {
      submitBtn.disabled = true
      submitBtn.classList.add("loading")
      submitBtnText.innerHTML =
        '<span class="loading-spinner"></span>Registering...'
    } else {
      submitBtn.disabled = false
      submitBtn.classList.remove("loading")
      submitBtnText.textContent = "Register Patient"
    }
  }

  function validateForm(formData) {
    if (
      !formData.cid ||
      !formData.name ||
      !formData.dob ||
      !formData.gender ||
      !formData.chiefComplaint
    ) {
      showMessage("Please fill in all required fields", "error")
      return false
    }

    if (!/^\d+$/.test(formData.cid)) {
      showMessage("CID must contain numbers only", "error")
      return false
    }

    if (!isValidDate(formData.dob)) {
      showMessage("Please enter a valid date in DD-MM-YYYY format", "error")
      return false
    }

    if (formData.age < 0 || formData.age > 120) {
      showMessage("Please enter a valid date of birth", "error")
      return false
    }

    if (!formData.tokenNumber || !formData.chamber) {
      showMessage(
        "Please select both token number and chamber",
        "error"
      )
      return false
    }

    if (formData.tokenNumber < 1) {
      showMessage("Invalid token number", "error")
      return false
    }

    return true
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault()

    messageContainer.innerHTML = ""

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

    if (!validateForm(formData)) {
      return
    }

    setLoading(true)

    try {
      const response = await apiFetch(
        "/api/patients/receptionist/register",
        {
          method: "POST",
          body: JSON.stringify(formData),
        }
      )

      const data = await response.json()

      if (response.ok) {
        const chamberText =
          chamberSelect.options[chamberSelect.selectedIndex]?.textContent ||
          `Chamber ${formData.chamber}`

        showMessage(
          `Patient registered successfully. Token ${formData.tokenNumber} assigned to ${chamberText}.`,
          "success"
        )

        form.reset()
        ageInput.value = ""

        await loadAvailableTokens()
        loadRecentRegistrations()
      } else {
        showMessage(
          data.error ||
            "Failed to register patient. Please try again.",
          "error"
        )
      }
    } catch (error) {
      console.error("[No-Q] Error registering patient:", error)
      showMessage(
        "An error occurred. Please check your connection and try again.",
        "error"
      )
    } finally {
      setLoading(false)
    }
  })

  function formatDisplayDate(dateString) {
    const date = new Date(dateString)
    if (isNaN(date.getTime())) return dateString

    const day = String(date.getDate()).padStart(2, "0")
    const month = String(date.getMonth() + 1).padStart(2, "0")
    const year = date.getFullYear()

    return `${day}-${month}-${year}`
  }

  async function loadRecentRegistrations() {
    try {
      const response = await apiFetch("/api/patients/receptionist/recent")
      const patients = response.ok ? await response.json() : []

      if (patients.length === 0) {
        recentList.innerHTML = `
          <div class="receptionist-empty-state">
            <svg class="receptionist-empty-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" stroke="#94A3B8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <p class="receptionist-empty-text">No patients registered yet</p>
          </div>
        `
        return
      }

      recentList.innerHTML = patients
        .map((patient) => {
          const chamberLabel = `Chamber ${patient.chamber}`

          return `
          <div class="receptionist-patient-card">
            <div class="receptionist-patient-header">
              <div class="receptionist-patient-info">
                <h3>${patient.name}</h3>
                <p>CID: ${patient.cid}</p>
              </div>
              <div class="receptionist-patient-badges">
                <span class="receptionist-badge token">Token ${patient.token_number}</span>
                <span class="receptionist-badge chamber">${chamberLabel}</span>
                <span class="receptionist-badge age">${patient.age} years</span>
              </div>
            </div>
            <div class="receptionist-patient-details">
              <div class="receptionist-detail-item">
                <span class="receptionist-detail-label">Gender</span>
                <span class="receptionist-detail-value">${patient.gender}</span>
              </div>
              <div class="receptionist-detail-item">
                <span class="receptionist-detail-label">Date of Birth</span>
                <span class="receptionist-detail-value">${formatDisplayDate(
                  patient.dob
                )}</span>
              </div>
              <div class="receptionist-detail-item">
                <span class="receptionist-detail-label">Chief Complaint</span>
                <span class="receptionist-detail-value">${
                  patient.chief_complaint
                }</span>
              </div>
              <div class="receptionist-detail-item">
                <span class="receptionist-detail-label">Registered</span>
                <span class="receptionist-detail-value">${new Date(
                  patient.created_at
                ).toLocaleString()}</span>
              </div>
            </div>
          </div>
        `
        })
        .join("")
    } catch (error) {
      console.error("[No-Q] Error loading recent registrations:", error)
      recentList.innerHTML = `
        <div class="receptionist-empty-state">
          <p class="receptionist-empty-text">Error loading recent registrations</p>
        </div>
      `
    }
  }

  const inputs = document.querySelectorAll(
    ".receptionist-form-input, .receptionist-form-select"
  )
  inputs.forEach((input) => {
    input.addEventListener("focus", () => {
      input.parentElement.classList.add("focused")
    })

    input.addEventListener("blur", () => {
      if (!input.value) {
        input.parentElement.classList.remove("focused")
      }
    })
  })

  const cidInput = document.getElementById("cidNumber")
  cidInput.addEventListener("input", (e) => {
    const value = e.target.value
    if (value && !/^\d+$/.test(value)) {
      e.target.setCustomValidity("CID must contain numbers only")
    } else {
      e.target.setCustomValidity("")
    }
  })

  chamberSelect.addEventListener("change", () => {
    loadAvailableTokens()
  })

  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      localStorage.removeItem("staffRole")
      localStorage.removeItem("staffName")
      localStorage.removeItem("staffId")
      window.location.href = "/"
    })
  }

  const registrationCard = document.querySelector(
    ".receptionist-registration-card"
  )
  if (registrationCard) {
    registrationCard.style.opacity = "0"
    registrationCard.style.transform = "translateY(20px)"

    setTimeout(() => {
      registrationCard.style.transition =
        "opacity 0.5s ease, transform 0.5s ease"
      registrationCard.style.opacity = "1"
      registrationCard.style.transform = "translateY(0)"
    }, 100)
  }

  const recentRegistrations = document.querySelector(
    ".receptionist-recent-registrations"
  )
  if (recentRegistrations) {
    recentRegistrations.style.opacity = "0"
    recentRegistrations.style.transform = "translateY(20px)"

    setTimeout(() => {
      recentRegistrations.style.transition =
        "opacity 0.5s ease, transform 0.5s ease"
      recentRegistrations.style.opacity = "1"
      recentRegistrations.style.transform = "translateY(0)"
    }, 300)
  }
})
