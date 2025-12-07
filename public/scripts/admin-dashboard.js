;(function () {
  const form = document.getElementById("staffForm")
  const result = document.getElementById("result")
  const resultTitle = document.getElementById("resultTitle")
  const resultText = document.getElementById("resultText")
  const staffList = document.getElementById("staffList")

  const roleSelect = document.getElementById("role")
  const doctorFields = document.getElementById("doctorFields")
  const specializationSelect = document.getElementById("specialization")
  const chamberSelect = document.getElementById("chamber")
  const staffFormTitle = document.getElementById("staffFormTitle")
  const staffFormEditHint = document.getElementById("staffFormEditHint")
  const staffSubmitBtn = document.getElementById("staffSubmitBtn")
  const staffCancelEditBtn = document.getElementById("staffCancelEditBtn")

  // Simple admin guard
  const staffRole = localStorage.getItem("staffRole")
  if (!staffRole || staffRole !== "admin") {
    window.location.href = "/staff"
    return
  }

  // Shared fetch helper with cookie
  async function apiFetch(url, options = {}) {
    const res = await fetch(url, {
      ...options,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
    })

    if (res.status === 401 || res.status === 403) {
      localStorage.removeItem("staffRole")
      localStorage.removeItem("staffName")
      localStorage.removeItem("staffId")
      window.location.href = "/staff"
      throw new Error("Unauthorized")
    }

    return res
  }

  // Load staff list
  async function fetchStaff() {
    try {
      const res = await apiFetch("/api/staff", { method: "GET" })

      if (!res.ok) {
        staffList.innerHTML =
          '<p class="info-text">Failed to load staff list.</p>'
        return
      }

      const staff = await res.json()
      staffList.innerHTML = ""

      if (!Array.isArray(staff) || staff.length === 0) {
        staffList.innerHTML = '<p class="info-text">No staff yet.</p>'
        return
      }

      // Debug: Log all staff IDs and roles to help diagnose issues
      console.log("Loaded staff IDs:", staff.map(s => ({
        name: s.name,
        role: s.role,
        roleType: typeof s.role,
        _id: s._id,
        id: s.id,
        _idType: typeof s._id,
        _idLength: s._id ? String(s._id).length : 0
      })))

      staff.forEach((s) => {
        const card = document.createElement("div")
        card.className = "staff-card"

        const roleClass =
          s.role === "doctor"
            ? "doctor"
            : s.role === "receptionist"
            ? "receptionist"
            : "admin"

        const isActive =
          s.is_active === undefined ? true : Boolean(s.is_active)

        // Ensure staffId is a string - prefer _id, then id, then fallback
        let staffId = ""
        if (s._id) {
          staffId = String(s._id)
        } else if (s.id) {
          staffId = String(s.id)
        }
        
        // Validate staffId before proceeding - MongoDB ObjectIds are 24 hex chars
        // But allow IDs between 20-24 chars in case of formatting differences
        if (!staffId || staffId.length < 20) {
          console.error("Invalid staff ID - too short:", { 
            staffId, 
            length: staffId.length,
            expected: 24,
            staff: s 
          })
          return // Skip this staff member
        }
        
        // Warn if ID length is unusual but still proceed
        if (staffId.length !== 24) {
          console.warn("Staff ID has unusual length (expected 24):", {
            staffId,
            length: staffId.length,
            name: s.name
          })
        }
        
        const safeName = (s.name || "").replace(/'/g, "&#39;").replace(/"/g, "&quot;")
        const roleLabel = s.role ? s.role.charAt(0).toUpperCase() + s.role.slice(1) : "Staff"
        
        // Ensure role is properly escaped for onclick attribute
        const safeRole = (s.role || "").replace(/'/g, "&#39;").replace(/"/g, "&quot;")
        
        // Add edit and delete buttons for all staff types
        const actionButtons = `
          <div class="staff-actions" style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #f3f4f6; display: flex; gap: 8px;">
            <button class="btn-edit-staff" onclick="editStaff('${staffId}')" style="flex: 1; padding: 8px 12px; background: #28a745; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 600;">
              Edit
            </button>
            <button class="btn-delete-staff" onclick="deleteStaff('${staffId}', '${safeName}', '${safeRole}')" style="flex: 1; padding: 8px 12px; background: #dc3545; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 600;">
              Delete
            </button>
          </div>
        `

        card.innerHTML = `
          <div class="staff-header">
            <div class="staff-name-role">
              <div class="staff-icon">
                <span>${(s.name || "?").charAt(0).toUpperCase()}</span>
              </div>
              <div class="staff-info">
                <h3>${s.name || ""}</h3>
                <span class="role-badge ${roleClass}">${s.role.toUpperCase()}</span>
              </div>
            </div>
            <span class="status-badge ${isActive ? "active" : "inactive"}">
              ${isActive ? "Active" : "Inactive"}
            </span>
          </div>
          <div class="staff-details">
            <div class="staff-detail-item">
              <strong>CID</strong>
              <span>${s.cid || "-"}</span>
            </div>
            <div class="staff-detail-item">
              <strong>Email</strong>
              <span>${s.email || "-"}</span>
            </div>
            <div class="staff-detail-item">
              <strong>ID</strong>
              <span>${s._id || s.id || "-"}</span>
            </div>
          </div>
          ${actionButtons}
        `
        staffList.appendChild(card)
      })
    } catch (e) {
      console.error("Error loading staff:", e)
      staffList.innerHTML =
        '<p class="info-text">Failed to load staff list.</p>'
    }
  }

  // Load specializations into the doctor section
  async function loadSpecializations() {
    if (!specializationSelect) return

    specializationSelect.innerHTML =
      '<option value="">Select specialization</option>'

    try {
      const res = await apiFetch("/api/doctor/specializations", {
        method: "GET",
      })

      if (!res.ok) {
        return
      }

      const specs = await res.json()

      ;(Array.isArray(specs) ? specs : []).forEach((spec) => {
        const opt = document.createElement("option")
        opt.value = spec.id || spec._id
        opt.textContent = spec.name || ""
        specializationSelect.appendChild(opt)
      })
    } catch (err) {
      console.error("Error loading specializations:", err)
    }
  }

  // Load chambers into the doctor section
  async function loadChambers() {
    if (!chamberSelect) return

    chamberSelect.innerHTML =
      '<option value="">Select chamber</option>'

    try {
      const res = await apiFetch("/api/doctor/chambers", {
        method: "GET",
      })

      if (!res.ok) {
        return
      }

      const chambers = await res.json()

      ;(Array.isArray(chambers) ? chambers : []).forEach((ch) => {
        const id = ch.id || ch._id
        const number = ch.chamber_number
        const floor = ch.floor
        const building = ch.building
        const extra = `${floor ? ` - ${floor}` : ""}${
          building ? ` - ${building}` : ""
        }`

        const opt = document.createElement("option")
        opt.value = id
        opt.textContent = `${number}${extra}`
        chamberSelect.appendChild(opt)
      })
    } catch (err) {
      console.error("Error loading chambers:", err)
    }
  }

  async function loadDoctorMetadata() {
    await Promise.all([loadSpecializations(), loadChambers()])
  }

  function resetDoctorFields() {
    if (specializationSelect) {
      specializationSelect.value = ""
    }
    if (chamberSelect) {
      chamberSelect.value = ""
    }
  }

  function handleRoleChange() {
    if (!roleSelect || !doctorFields) return

    const value = roleSelect.value

    if (value === "doctor") {
      doctorFields.style.display = "block"
      loadDoctorMetadata()
    } else {
      doctorFields.style.display = "none"
      resetDoctorFields()
    }
  }

  roleSelect?.addEventListener("change", handleRoleChange)

  // Edit staff function
  window.editStaff = async function (staffId) {
    try {
      if (!staffId) {
        alert("Invalid staff ID")
        return
      }
      
      console.log("Fetching staff with ID:", staffId)
      const res = await apiFetch(`/api/staff/${staffId}`, { method: "GET" })
      
      if (!res.ok) {
        let errorData
        try {
          errorData = await res.json()
        } catch (e) {
          errorData = { message: `HTTP ${res.status}: ${res.statusText}` }
        }
        
        const errorMsg = errorData.error || errorData.message || `Failed to load staff data (Status: ${res.status})`
        console.error("Failed to load staff - Full error:", {
          status: res.status,
          statusText: res.statusText,
          errorData: JSON.stringify(errorData, null, 2),
          staffId,
          staffIdLength: staffId.length,
          isValidFormat: /^[0-9a-fA-F]{24}$/.test(staffId)
        })
        
        let alertMsg = `${errorMsg}\n\nStaff ID: ${staffId}\nID Length: ${staffId.length} characters`
        if (staffId.length !== 24) {
          alertMsg += `\n\n⚠️ Warning: Expected 24 characters for MongoDB ObjectId, got ${staffId.length}`
        }
        if (errorData.availableIds && Array.isArray(errorData.availableIds)) {
          alertMsg += `\n\nAvailable IDs in database: ${errorData.availableIds.length}`
        }
        alert(alertMsg)
        return
      }

      const staff = await res.json()
      const editingInput = document.getElementById("editingStaffId")
      const cidInput = document.getElementById("cid")
      const nameInput = document.getElementById("name")
      const emailInput = document.getElementById("email")
      const roleInput = document.getElementById("role")
      const statusInput = document.getElementById("status")
      const passwordInput = document.getElementById("password")
      const passwordHint = document.getElementById("passwordHint")
      const staffFormTitle = document.getElementById("staffFormTitle")
      const staffFormEditHint = document.getElementById("staffFormEditHint")
      const staffSubmitBtn = document.getElementById("staffSubmitBtn")
      const staffCancelEditBtn = document.getElementById("staffCancelEditBtn")

      if (editingInput) editingInput.value = staffId
      if (cidInput) {
        cidInput.value = staff.cid || ""
        cidInput.disabled = true
      }
      if (nameInput) nameInput.value = staff.name || ""
      if (emailInput) emailInput.value = staff.email || ""
      if (roleInput) roleInput.value = staff.role || ""
      if (statusInput) statusInput.value = staff.is_active !== false ? "active" : "inactive"
      if (passwordInput) {
        passwordInput.value = ""
        passwordInput.required = false
      }
      if (passwordHint) passwordHint.style.display = "block"

      // Load doctor profile if it's a doctor
      if (staff.role === "doctor") {
        handleRoleChange()
        try {
          const profileRes = await apiFetch(`/api/doctor/profile/${staffId}`, { method: "GET" })
          if (profileRes.ok) {
            const profile = await profileRes.json()
            if (specializationSelect && profile.specialization?.id) {
              specializationSelect.value = profile.specialization.id
            }
            if (chamberSelect && profile.chamber?.id) {
              chamberSelect.value = profile.chamber.id
            }
          } else if (profileRes.status === 404) {
            // Doctor doesn't have a profile yet - this is fine, just clear the selects
            if (specializationSelect) specializationSelect.value = ""
            if (chamberSelect) chamberSelect.value = ""
          }
        } catch (err) {
          // Silently handle errors - doctor might not have a profile yet
          if (specializationSelect) specializationSelect.value = ""
          if (chamberSelect) chamberSelect.value = ""
        }
      } else {
        handleRoleChange()
      }

      // Update form UI
      if (staffFormTitle) staffFormTitle.textContent = "Edit Staff User"
      if (staffFormEditHint) staffFormEditHint.style.display = "block"
      if (staffSubmitBtn) staffSubmitBtn.textContent = "Update Staff"
      if (staffCancelEditBtn) staffCancelEditBtn.style.display = "inline-block"

      // Scroll to form
      const formCard = document.querySelector(".portal-card")
      if (formCard) formCard.scrollIntoView({ behavior: "smooth" })
    } catch (error) {
      console.error("Error loading staff:", error)
      alert("Failed to load staff data")
    }
  }

  // Delete staff function for all staff types
  window.deleteStaff = async function (staffId, name, role) {
    // Decode HTML entities
    const tempDiv = document.createElement("div")
    tempDiv.innerHTML = name
    const decodedName = tempDiv.textContent || tempDiv.innerText || name
    
    // Normalize role (handle case differences)
    const normalizedRole = role ? String(role).toLowerCase().trim() : ""
    const roleLabel = normalizedRole ? normalizedRole.charAt(0).toUpperCase() + normalizedRole.slice(1) : "Staff"
    const isDoctor = normalizedRole === "doctor"
    
    console.log("deleteStaff called:", { staffId, name: decodedName, role, normalizedRole, isDoctor })

    // Different confirmation messages for doctors vs other staff
    let confirmMessage
    if (isDoctor) {
      confirmMessage = `Are you sure you want to PERMANENTLY DELETE doctor "${decodedName}"?\n\n` +
        `This will:\n` +
        `- Delete the doctor profile\n` +
        `- Permanently delete the doctor account\n\n` +
        `This action cannot be undone!`
    } else {
      confirmMessage = `Are you sure you want to DELETE ${roleLabel.toLowerCase()} "${decodedName}"?\n\n` +
        `This will deactivate their account.\n\n` +
        `This action can be reversed by editing the staff member.`
    }

    const confirmed = confirm(confirmMessage)

    if (!confirmed) return

    try {
      let res
      if (isDoctor) {
        // Permanently delete doctor (profile + staff record)
        res = await apiFetch(`/api/doctor/delete/${staffId}`, {
          method: "DELETE",
        })
      } else {
        // Soft delete (deactivate) for non-doctors
        res = await apiFetch(`/api/staff/${staffId}`, {
          method: "DELETE",
        })
      }

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.error || errorData.message || "Failed to delete staff")
      }

      const successMessage = isDoctor 
        ? `Doctor "${decodedName}" has been permanently deleted!`
        : `${roleLabel} "${decodedName}" has been deleted!`
      
      alert(successMessage)
      fetchStaff()
    } catch (error) {
      console.error("Error deleting staff:", error)
      alert("Error: " + error.message)
    }
  }

  // Cancel edit button
  if (staffCancelEditBtn) {
    staffCancelEditBtn.addEventListener("click", () => {
      const editingInput = document.getElementById("editingStaffId")
      const cidInput = document.getElementById("cid")
      const passwordInput = document.getElementById("password")
      const passwordHint = document.getElementById("passwordHint")
      
      if (editingInput) editingInput.value = ""
      if (cidInput) {
        cidInput.value = ""
        cidInput.disabled = false
      }
      if (passwordInput) {
        passwordInput.value = ""
        passwordInput.required = true
      }
      if (passwordHint) passwordHint.style.display = "none"
      
      form.reset()
      resetDoctorFields()
      handleRoleChange()
      
      if (staffFormTitle) staffFormTitle.textContent = "Create Staff User"
      if (staffFormEditHint) staffFormEditHint.style.display = "none"
      if (staffSubmitBtn) staffSubmitBtn.textContent = "Create Staff"
      if (staffCancelEditBtn) staffCancelEditBtn.style.display = "none"
    })
  }

  // Main form submit
  form?.addEventListener("submit", async (e) => {
    e.preventDefault()

    result.style.display = "none"
    resultTitle.textContent = ""
    resultText.textContent = ""

    const editingInput = document.getElementById("editingStaffId")
    const editingId = editingInput ? editingInput.value.trim() : ""
    const isEdit = !!editingId

    const roleValue = document.getElementById("role").value

    const data = {
      name: document.getElementById("name").value.trim(),
      email: document.getElementById("email").value.trim(),
      role: roleValue,
      is_active: document.getElementById("status").value === "active",
    }

    // Only include CID and password for new staff
    if (!isEdit) {
      data.cid = document.getElementById("cid").value.trim()
      const password = document.getElementById("password").value
      if (password) {
        data.password = password
      }
    } else {
      // For updates, include password only if provided
      const password = document.getElementById("password").value
      if (password) {
        data.password = password
      }
    }

    // Optional doctor profile fields
    const selectedSpecId =
      roleValue === "doctor" && specializationSelect
        ? specializationSelect.value
        : ""
    const selectedChamberId =
      roleValue === "doctor" && chamberSelect
        ? chamberSelect.value
        : ""

    try {
      let res
      if (isEdit) {
        // Update existing staff
        res = await apiFetch(`/api/staff/${editingId}`, {
          method: "PUT",
          body: JSON.stringify(data),
        })
      } else {
        // Create new staff
        res = await apiFetch("/api/staff", {
          method: "POST",
          body: JSON.stringify(data),
        })
      }

      const body = await res.json()

      if (!res.ok) {
        throw new Error(
          body?.error || body?.message || `Failed to ${isEdit ? "update" : "create"} staff`
        )
      }

      // Show success
      result.style.display = "block"
      resultTitle.textContent = `Staff ${isEdit ? "updated" : "created"} successfully`
      resultText.textContent = `${data.role.toUpperCase()} • ${
        data.name
      }${!isEdit && data.cid ? ` (CID: ${data.cid})` : ""}`

      // If doctor and specialization + chamber are selected, create or update doctor profile
      if (
        roleValue === "doctor" &&
        selectedSpecId &&
        selectedChamberId
      ) {
        const staffId = isEdit ? editingId : (body._id || body.id)

        if (staffId) {
          try {
            const profilePayload = {
              staff_id: String(staffId),
              specialization_id: selectedSpecId,
              chamber_id: selectedChamberId,
            }

            // Use POST endpoint which does upsert (create or update)
            const profileRes = await apiFetch("/api/doctor/profile", {
              method: "POST",
              body: JSON.stringify(profilePayload),
            })

            const profileBody = await profileRes.json().catch(() => ({}))

            if (!profileRes.ok) {
              console.error(
                "Doctor profile update failed:",
                profileBody
              )
              resultTitle.textContent = `Staff ${isEdit ? "updated" : "created"}, but profile setup failed`
              resultText.textContent =
                `Doctor account ${isEdit ? "updated" : "created"}. Please use Doctor Profile Management to assign specialization and chamber.`
            } else {
              resultTitle.textContent = `Doctor and profile ${isEdit ? "updated" : "created"} successfully`
              resultText.textContent = `${
                data.name
              } is now linked to specialization and chamber.`
            }
          } catch (errProfile) {
            console.error("Error updating doctor profile:", errProfile)
            resultTitle.textContent = `Staff ${isEdit ? "updated" : "created"}, but profile setup failed`
            resultText.textContent =
              `Doctor account ${isEdit ? "updated" : "created"}. Please use Doctor Profile Management to assign specialization and chamber.`
          }
        }
      }

      // Reset form
      const cidInput = document.getElementById("cid")
      const passwordInput = document.getElementById("password")
      const passwordHint = document.getElementById("passwordHint")
      const staffFormTitle = document.getElementById("staffFormTitle")
      const staffFormEditHint = document.getElementById("staffFormEditHint")
      const staffSubmitBtn = document.getElementById("staffSubmitBtn")
      const staffCancelEditBtn = document.getElementById("staffCancelEditBtn")

      if (editingInput) editingInput.value = ""
      if (cidInput) {
        cidInput.value = ""
        cidInput.disabled = false
      }
      if (passwordInput) {
        passwordInput.value = ""
        passwordInput.required = true
      }
      if (passwordHint) passwordHint.style.display = "none"
      form.reset()
      resetDoctorFields()
      handleRoleChange()
      
      if (staffFormTitle) staffFormTitle.textContent = "Create Staff User"
      if (staffFormEditHint) staffFormEditHint.style.display = "none"
      if (staffSubmitBtn) staffSubmitBtn.textContent = "Create Staff"
      if (staffCancelEditBtn) staffCancelEditBtn.style.display = "none"

      await fetchStaff()
    } catch (err) {
      console.error(`Error ${isEdit ? "updating" : "creating"} staff:`, err)
      result.style.display = "block"
      resultTitle.textContent = "Error"
      resultText.textContent = err.message
    }
  })

  // Logout functionality
  const logoutBtn = document.getElementById("logoutBtn")
  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      try {
        // Call logout API to clear server-side cookie
        await fetch("/api/staff/logout", {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
        })
      } catch (error) {
        console.error("Error during logout:", error)
      } finally {
        // Clear local storage
        localStorage.removeItem("staffRole")
        localStorage.removeItem("staffName")
        localStorage.removeItem("staffId")
        // Redirect to staff portal
        window.location.href = "/staff"
      }
    })
  }

  // Initial load
  handleRoleChange()
  fetchStaff()
  loadDoctorMetadata()
})()
