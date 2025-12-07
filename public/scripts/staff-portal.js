// Staff Portal JavaScript

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("staffForm")

  if (!form) {
    console.error("[No-Q] staffForm not found in DOM")
    return
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault()

    const role = document.getElementById("role")?.value
    const cidNumber = document.getElementById("cidNumber")?.value
    const password = document.getElementById("password")?.value

    const formData = { role, cidNumber, password }

    const submitButton = form.querySelector(".form-submit-button")

    if (!submitButton) {
      console.error("[No-Q] submit button not found")
      return
    }

    // Loading state
    submitButton.disabled = true
    submitButton.textContent = "Logging in..."

    try {
      const response = await fetch("/api/staff/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include", // important for auth_token cookie
        body: JSON.stringify(formData),
      })

      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        const msg =
          data?.message ||
          data?.error ||
          "Login failed. Please check your credentials."
        alert(msg)
        return
      }

      // Backend sets httpOnly auth_token cookie
      // Response body contains staff info only
      const staff = data.staff

      if (!staff || !staff.role) {
        console.error("[No-Q] Invalid login response:", data)
        alert("Login failed. Please try again.")
        return
      }

      console.log("[No-Q] Staff login successful:", staff)

      // Store only non-sensitive info in localStorage
      localStorage.setItem("staffRole", staff.role)
      localStorage.setItem("staffName", staff.name || "")
      localStorage.setItem("staffId", staff.id || staff._id || "")

      // Redirect by role
      if (staff.role === "receptionist") {
        window.location.href = "/receptionist-dashboard"
      } else if (staff.role === "doctor") {
        window.location.href = "/doctor-dashboard"
      } else if (staff.role === "admin") {
        window.location.href = "/admin-dashboard"
      } else {
        // Unknown role, send back to staff portal
        window.location.href = "/staff"
      }
    } catch (error) {
      console.error("[No-Q] Error during staff login:", error)
      alert("An error occurred. Please try again later.")
    } finally {
      submitButton.disabled = false
      submitButton.textContent = "Login"
    }
  })

  // Entrance animation
  const card = document.querySelector(".portal-form-card")
  if (card) {
    card.style.opacity = "0"
    card.style.transform = "translateY(20px)"

    setTimeout(() => {
      card.style.transition = "opacity 0.5s ease, transform 0.5s ease"
      card.style.opacity = "1"
      card.style.transform = "translateY(0)"
    }, 100)
  }
})
