;(function () {
  const form = document.getElementById("staffForm")
  const result = document.getElementById("result")
  const resultTitle = document.getElementById("resultTitle")
  const resultText = document.getElementById("resultText")
  const staffList = document.getElementById("staffList")

  async function fetchStaff() {
    try {
      const res = await fetch("/api/staff")
      const staff = await res.json()
      staffList.innerHTML = ""
      if (!Array.isArray(staff) || staff.length === 0) {
        staffList.innerHTML = '<p class="info-text">No staff yet.</p>'
        return
      }
      staff.forEach((s) => {
        const item = document.createElement("div")
        item.className = "info-box"
        item.innerHTML = `
          <div class="info-content">
            <h3 class="info-title">${s.role.toUpperCase()} • ${s.name}</h3>
            <p class="info-text">Username: ${s.username}${s.email ? ` • Email: ${s.email}` : ""}</p>
          </div>
        `
        staffList.appendChild(item)
      })
    } catch (e) {
      staffList.innerHTML = '<p class="info-text">Failed to load staff list.</p>'
    }
  }

  form?.addEventListener("submit", async (e) => {
    e.preventDefault()
    const data = {
      username: document.getElementById("username").value.trim(),
      password: document.getElementById("password").value,
      name: document.getElementById("name").value.trim(),
      email: document.getElementById("email").value.trim(),
      role: document.getElementById("role").value,
      isActive: true,
    }
    try {
      const res = await fetch("/api/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      const body = await res.json()
      if (!res.ok) {
        throw new Error(body?.error || body?.message || "Failed to create staff")
      }
      result.style.display = "block"
      resultTitle.textContent = "Staff created successfully"
      resultText.textContent = `${data.role.toUpperCase()} • ${data.name} (username: ${data.username})`
      form.reset()
      await fetchStaff()
    } catch (err) {
      result.style.display = "block"
      resultTitle.textContent = "Error"
      resultText.textContent = err.message
    }
  })

  fetchStaff()
})()


