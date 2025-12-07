// Specializations & Chambers Management JavaScript
let currentSpecializations = []
let currentChambers = []
let currentAssignments = []
let editingId = null

// Check authentication and admin role on page load
document.addEventListener("DOMContentLoaded", function () {
  checkAuthentication()
  setupFormListeners()
  setupChamberFormListeners()
  setupAssignmentFormListeners()
  setupTabs()
})

function checkAuthentication() {
  const role = localStorage.getItem("staffRole")

  const errorMessage = document.getElementById("errorMessage")
  const mainContent = document.getElementById("mainContent")

  if (role !== "admin") {
    if (errorMessage) errorMessage.style.display = "block"
    if (mainContent) mainContent.style.display = "none"
    return
  }

  if (errorMessage) errorMessage.style.display = "none"
  if (mainContent) mainContent.style.display = "block"
  loadSpecializations()
  loadChambers()
  loadAssignments()
}

function goToDashboard() {
  window.location.href = "/staff-dashboard"
}

function setupFormListeners() {
  const form = document.getElementById("specializationForm")
  if (form) {
    form.addEventListener("submit", handleFormSubmit)
  }
}

function setupChamberFormListeners() {
  const chamberForm = document.getElementById("chamberForm")
  if (chamberForm) {
    chamberForm.addEventListener("submit", handleChamberFormSubmit)
  }

  const chamberCancelBtn = document.getElementById("chamberCancelBtn")
  if (chamberCancelBtn) {
    chamberCancelBtn.addEventListener("click", resetChamberForm)
  }
}

function setupAssignmentFormListeners() {
  const form = document.getElementById("assignmentForm")
  if (form) {
    form.addEventListener("submit", handleAssignmentFormSubmit)
  }
}

function setupTabs() {
  const tabButtons = document.querySelectorAll(".tab-button")
  const sections = document.querySelectorAll(".tab-section")

  if (!tabButtons.length || !sections.length) return

  tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.getAttribute("data-section")
      if (!target) return

      tabButtons.forEach((b) => b.classList.remove("active"))
      btn.classList.add("active")

      sections.forEach((section) => {
        if (section.id === `section-${target}`) {
          section.style.display = ""
        } else {
          section.style.display = "none"
        }
      })
    })
  })
}

function getAuthHeaders() {
  return {
    "Content-Type": "application/json",
  }
}

async function loadSpecializations() {
  try {
    const loadingMessage = document.getElementById("loadingMessage")
    const tableContainer = document.getElementById("tableContainer")
    if (loadingMessage) loadingMessage.style.display = "block"
    if (tableContainer) tableContainer.style.display = "none"

    const response = await fetch("/api/doctor/specializations", {
      headers: getAuthHeaders(),
      credentials: "include",
    })

    if (!response.ok) {
      throw new Error("Failed to load specializations")
    }

    const specializations = await response.json()
    currentSpecializations = Array.isArray(specializations)
      ? specializations
      : []
    displaySpecializations(currentSpecializations)
    populateAssignmentSelects()

    const loadingMessageHide = document.getElementById("loadingMessage")
    const tableContainerShow = document.getElementById("tableContainer")
    if (loadingMessageHide) loadingMessageHide.style.display = "none"
    if (tableContainerShow) tableContainerShow.style.display = "block"
  } catch (error) {
    console.error("Error loading specializations:", error)
    showAlert("Error loading specializations: " + error.message, "error")
    const loadingMessageError = document.getElementById("loadingMessage")
    if (loadingMessageError) loadingMessageError.style.display = "none"
  }
}

function displaySpecializations(specializations) {
  const tbody = document.getElementById("specializationsTableBody")
  if (!tbody) return
  tbody.innerHTML = ""

  if (specializations.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="3" style="text-align: center; color: #666;">No specializations found</td></tr>'
    return
  }

  specializations.forEach((spec) => {
    const row = document.createElement("tr")
    const safeId = spec.id || spec._id
    const safeName = (spec.name || "").replace(/'/g, "&#39;").replace(/"/g, "&quot;")
    const displayId = safeId.length > 8 ? safeId.substring(0, 8) + "..." : safeId
    row.innerHTML = `
            <td>${displayId}</td>
            <td>${safeName}</td>
            <td class="actions">
                <button class="btn btn-sm btn-edit" onclick="editSpecialization('${safeId}')">Edit</button>
                <button class="btn btn-sm btn-delete" onclick="deleteSpecialization('${safeId}', '${safeName}')">Delete</button>
            </td>
        `
    tbody.appendChild(row)
  })
}

async function handleFormSubmit(event) {
  event.preventDefault()

  const formData = new FormData(event.target)
  const data = {
    name: (formData.get("name") || "").trim(),
  }

  if (!data.name) {
    showAlert("Specialization name is required", "error")
    return
  }

  try {
    let response
    const specializationIdInput = document.getElementById("specializationId")
    const specializationId = specializationIdInput
      ? specializationIdInput.value
      : ""

    if (specializationId) {
      // Update existing specialization
      response = await fetch(`/api/doctor/specializations/${specializationId}`, {
        method: "PUT",
        headers: getAuthHeaders(),
        credentials: "include",
        body: JSON.stringify(data),
      })
    } else {
      // Create new specialization
      response = await fetch("/api/doctor/specializations", {
        method: "POST",
        headers: getAuthHeaders(),
        credentials: "include",
        body: JSON.stringify(data),
      })
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error || "Failed to save specialization")
    }

    await response.json()
    showAlert(
      specializationId
        ? "Specialization updated successfully."
        : "Specialization added successfully.",
      "success"
    )
    resetForm()
    loadSpecializations()
  } catch (error) {
    console.error("Error saving specialization:", error)
    showAlert("Error: " + error.message, "error")
  }
}

function editSpecialization(id) {
  const specialization = currentSpecializations.find(
    (s) => (s.id || s._id) === id
  )
  if (!specialization) {
    showAlert("Specialization not found", "error")
    return
  }

  editingId = id
  const specIdInput = document.getElementById("specializationId")
  const nameInput = document.getElementById("name")
  const formTitle = document.getElementById("formTitle")
  const submitBtn = document.getElementById("submitBtn")
  const cancelBtn = document.getElementById("cancelBtn")

  if (specIdInput) specIdInput.value = id
  if (nameInput) nameInput.value = specialization.name || ""

  if (formTitle) formTitle.textContent = "Update Specialization"
  if (submitBtn) submitBtn.textContent = "Update Specialization"
  if (cancelBtn) cancelBtn.style.display = "inline-block"

  const formSection = document.querySelector("#section-specializations .form-section")
  if (formSection) {
    formSection.scrollIntoView({ behavior: "smooth" })
  }
}

function resetForm() {
  const form = document.getElementById("specializationForm")
  const specIdInput = document.getElementById("specializationId")
  const formTitle = document.getElementById("formTitle")
  const submitBtn = document.getElementById("submitBtn")
  const cancelBtn = document.getElementById("cancelBtn")

  if (form) form.reset()
  if (specIdInput) specIdInput.value = ""
  editingId = null

  if (formTitle) formTitle.textContent = "Add New Specialization"
  if (submitBtn) submitBtn.textContent = "Add Specialization"
  if (cancelBtn) cancelBtn.style.display = "none"
}

async function deleteSpecialization(id, name) {
  // Decode HTML entities for display
  const tempDiv = document.createElement("div")
  tempDiv.innerHTML = name
  const decodedName = tempDiv.textContent || tempDiv.innerText || name
  
  const confirmed = window.confirm(
    `Are you sure you want to delete the specialization "${decodedName}"?`
  )
  if (!confirmed) {
    return
  }

  try {
    const response = await fetch(`/api/doctor/specializations/${id}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
      credentials: "include",
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      if (
        response.status === 400 &&
        errorData.error &&
        (errorData.error.toLowerCase().includes("assigned") || 
         errorData.error.toLowerCase().includes("chambers"))
      ) {
        // Decode HTML entities for display
        const tempDiv = document.createElement("div")
        tempDiv.innerHTML = name
        const decodedName = tempDiv.textContent || tempDiv.innerText || name
        showAlert(
          `Cannot delete specialization "${decodedName}". ${errorData.error}`,
          "error"
        )
      } else {
        throw new Error(errorData.error || "Failed to delete specialization")
      }
      return
    }

    showAlert("Specialization deleted successfully.", "success")
    loadSpecializations()
  } catch (error) {
    console.error("Error deleting specialization:", error)
    showAlert("Error: " + error.message, "error")
  }
}

// Toast based alert
function showAlert(message, type) {
  if (window.NoQ && window.NoQ.toast) {
    const toastType = type === "error" ? "error" : "success"
    window.NoQ.toast(message, toastType)
  } else {
    alert(message)
  }
}

// Chambers CRUD

async function loadChambers() {
  try {
    const loadingMessage = document.getElementById("chamberLoadingMessage")
    const tableContainer = document.getElementById("chamberTableContainer")
    if (loadingMessage) loadingMessage.style.display = "block"
    if (tableContainer) tableContainer.style.display = "none"

    const response = await fetch("/api/doctor/chambers", {
      method: "GET",
      headers: getAuthHeaders(),
      credentials: "include",
    })

    if (!response.ok) {
      throw new Error("Failed to load chambers")
    }

    const chambers = await response.json()
    currentChambers = Array.isArray(chambers) ? chambers : []
    displayChambers(currentChambers)
    populateAssignmentSelects()

    const loadingMessageHide = document.getElementById(
      "chamberLoadingMessage"
    )
    const tableContainerShow = document.getElementById(
      "chamberTableContainer"
    )
    if (loadingMessageHide) loadingMessageHide.style.display = "none"
    if (tableContainerShow) tableContainerShow.style.display = "block"
  } catch (error) {
    console.error("Error loading chambers:", error)
    showAlert("Error loading chambers: " + error.message, "error")
    const loadingMessageError = document.getElementById(
      "chamberLoadingMessage"
    )
    if (loadingMessageError) loadingMessageError.style.display = "none"
  }
}

function displayChambers(chambers) {
  const tbody = document.getElementById("chambersTableBody")
  if (!tbody) return

  tbody.innerHTML = ""

  if (!Array.isArray(chambers) || chambers.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="2" style="text-align: center; color: #666;">No chambers found</td></tr>'
    return
  }

  chambers.forEach((chamber) => {
    const id = chamber.id || chamber._id
    const number =
      typeof chamber.chamber_number === "number"
        ? chamber.chamber_number
        : chamber.chamber_number || ""

    const safeNumber = String(number).replace(/'/g, "&#39;")

    const row = document.createElement("tr")
    row.innerHTML = `
            <td>${number}</td>
            <td class="actions">
                <button class="btn btn-sm btn-edit" onclick="editChamber('${id}')">Edit</button>
                <button class="btn btn-sm btn-delete" onclick="deleteChamber('${id}', '${safeNumber}')">Delete</button>
            </td>
        `
    tbody.appendChild(row)
  })
}

async function handleChamberFormSubmit(event) {
  event.preventDefault()

  const formData = new FormData(event.target)
  const chamberNumberRaw = (formData.get("chamber_number") || "").trim()

  if (!chamberNumberRaw) {
    showAlert("Chamber number is required", "error")
    return
  }

  const data = {
    chamber_number: Number(chamberNumberRaw),
  }

  try {
    const chamberIdInput = document.getElementById("chamberId")
    const chamberId = chamberIdInput ? chamberIdInput.value : ""

    let url = "/api/doctor/chambers"
    let method = "POST"

    if (chamberId) {
      url = `/api/doctor/chambers/${chamberId}`
      method = "PUT"
    }

    const response = await fetch(url, {
      method,
      headers: getAuthHeaders(),
      credentials: "include",
      body: JSON.stringify(data),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error || "Failed to save chamber")
    }

    await response.json()
    showAlert(
      chamberId
        ? "Chamber updated successfully."
        : "Chamber added successfully.",
      "success"
    )
    resetChamberForm()
    loadChambers()
  } catch (error) {
    console.error("Error saving chamber:", error)
    showAlert("Error: " + error.message, "error")
  }
}

function editChamber(id) {
  const chamber = currentChambers.find((c) => (c.id || c._id) === id)
  if (!chamber) return

  const chamberIdInput = document.getElementById("chamberId")
  const chamberNumberInput = document.getElementById("chamber_number")
  const formTitle = document.getElementById("chamberFormTitle")
  const submitBtn = document.getElementById("chamberSubmitBtn")
  const cancelBtn = document.getElementById("chamberCancelBtn")

  if (chamberIdInput) chamberIdInput.value = id
  if (chamberNumberInput) {
    chamberNumberInput.value =
      typeof chamber.chamber_number === "number"
        ? chamber.chamber_number
        : chamber.chamber_number || ""
  }

  if (formTitle) formTitle.textContent = "Update Chamber"
  if (submitBtn) submitBtn.textContent = "Update Chamber"
  if (cancelBtn) cancelBtn.style.display = "inline-block"
}

function resetChamberForm() {
  const form = document.getElementById("chamberForm")
  const chamberIdInput = document.getElementById("chamberId")
  const formTitle = document.getElementById("chamberFormTitle")
  const submitBtn = document.getElementById("chamberSubmitBtn")
  const cancelBtn = document.getElementById("chamberCancelBtn")

  if (form) form.reset()
  if (chamberIdInput) chamberIdInput.value = ""

  if (formTitle) formTitle.textContent = "Add New Chamber"
  if (submitBtn) submitBtn.textContent = "Add Chamber"
  if (cancelBtn) cancelBtn.style.display = "none"
}

async function deleteChamber(id, chamberNumber) {
  const confirmed = window.confirm(
    `Are you sure you want to delete chamber "${chamberNumber}"?`
  )
  if (!confirmed) {
    return
  }

  try {
    const response = await fetch(`/api/doctor/chambers/${id}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
      credentials: "include",
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      if (
        response.status === 400 &&
        errorData.error &&
        errorData.error.toLowerCase().includes("assigned")
      ) {
        showAlert(
          "Cannot delete chamber because it is currently assigned. Please update assignments first.",
          "error"
        )
      } else {
        throw new Error(errorData.error || "Failed to delete chamber")
      }
      return
    }

    showAlert("Chamber deleted successfully.", "success")
    loadChambers()
  } catch (error) {
    console.error("Error deleting chamber:", error)
    showAlert("Error: " + error.message, "error")
  }
}

// Assignments

function populateAssignmentSelects() {
  const specSelect = document.getElementById("assignmentSpecialization")
  const chamberSelect = document.getElementById("assignmentChamber")

  if (!specSelect || !chamberSelect) return

  specSelect.innerHTML = ""
  chamberSelect.innerHTML = ""

  const specPlaceholder = document.createElement("option")
  specPlaceholder.value = ""
  specPlaceholder.textContent = "Select specialization..."
  specSelect.appendChild(specPlaceholder)

  currentSpecializations.forEach((spec) => {
    const option = document.createElement("option")
    option.value = spec.id || spec._id
    option.textContent = spec.name || ""
    specSelect.appendChild(option)
  })

  const chamberPlaceholder = document.createElement("option")
  chamberPlaceholder.value = ""
  chamberPlaceholder.textContent = "Select chamber..."
  chamberSelect.appendChild(chamberPlaceholder)

  currentChambers.forEach((chamber) => {
    const option = document.createElement("option")
    const id = chamber.id || chamber._id
    const number =
      typeof chamber.chamber_number === "number"
        ? chamber.chamber_number
        : chamber.chamber_number || ""
    option.value = id
    option.textContent = `Chamber ${number}`
    chamberSelect.appendChild(option)
  })
}

async function handleAssignmentFormSubmit(event) {
  event.preventDefault()

  const specSelect = document.getElementById("assignmentSpecialization")
  const chamberSelect = document.getElementById("assignmentChamber")

  const specialization_id = specSelect ? specSelect.value : ""
  const chamber_id = chamberSelect ? chamberSelect.value : ""

  if (!specialization_id || !chamber_id) {
    showAlert("Please select both specialization and chamber.", "error")
    return
  }

  try {
    const response = await fetch("/api/doctor/assignments", {
      method: "POST",
      headers: getAuthHeaders(),
      credentials: "include",
      body: JSON.stringify({ specialization_id, chamber_id }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      const msg =
        errorData.error ||
        "Failed to create assignment. This chamber might already be assigned."
      showAlert(msg, "error")
      return
    }

    await response.json()
    showAlert("Assignment created successfully.", "success")
    loadAssignments()
  } catch (error) {
    console.error("Error creating assignment:", error)
    showAlert("Error: " + error.message, "error")
  }
}

async function loadAssignments() {
  try {
    const response = await fetch("/api/doctor/assignments", {
      method: "GET",
      headers: getAuthHeaders(),
      credentials: "include",
    })

    if (!response.ok) {
      throw new Error("Failed to load assignments")
    }

    const assignments = await response.json()
    currentAssignments = Array.isArray(assignments) ? assignments : []
    displayAssignments(currentAssignments)
  } catch (error) {
    console.error("Error loading assignments:", error)
    showAlert("Error loading assignments: " + error.message, "error")
  }
}

function displayAssignments(assignments) {
  const tbody = document.getElementById("assignmentsTableBody")
  if (!tbody) return

  tbody.innerHTML = ""

  if (!Array.isArray(assignments) || assignments.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="2" style="text-align: center; color: #666;">No assignments yet</td></tr>'
    return
  }

  assignments.forEach((item) => {
    const row = document.createElement("tr")

    const chips =
      item.chambers && item.chambers.length > 0
        ? item.chambers
            .map((ch) => {
              const chamberId = ch.id || ch._id
              const num = ch.chamber_number
              return `
              <span class="assignment-chip">
                Chamber ${num}
                <button type="button" class="assignment-remove" onclick="deleteAssignment('${item.specialization_id}', '${chamberId}')">
                  &times;
                </button>
              </span>
            `
            })
            .join("")
        : '<span style="color:#666;">No chambers assigned</span>'

    row.innerHTML = `
        <td>${item.specialization_name}</td>
        <td>${chips}</td>
      `
    tbody.appendChild(row)
  })
}

async function deleteAssignment(specId, chamberId) {
  const confirmed = window.confirm(
    "Remove this chamber from the specialization?"
  )
  if (!confirmed) return

  try {
    const response = await fetch("/api/doctor/assignments", {
      method: "DELETE",
      headers: getAuthHeaders(),
      credentials: "include",
      body: JSON.stringify({
        specialization_id: specId,
        chamber_id: chamberId,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error || "Failed to remove assignment")
    }

    showAlert("Assignment removed successfully.", "success")
    loadAssignments()
  } catch (error) {
    console.error("Error deleting assignment:", error)
    showAlert("Error: " + error.message, "error")
  }
}
