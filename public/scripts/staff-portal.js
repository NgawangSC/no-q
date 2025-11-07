// Staff Portal JavaScript

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("staffForm")

  form.addEventListener("submit", async (e) => {
    e.preventDefault()

    const formData = {
      role: document.getElementById("role").value,
      cidNumber: document.getElementById("cidNumber").value,
      password: document.getElementById("password").value,
    }

    const submitButton = form.querySelector(".form-submit-button")

    // Add loading state
    submitButton.disabled = true
    submitButton.textContent = "Logging in..."

    try {
      // API call to authenticate staff
      const response = await fetch("/api/staff/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      })

      const data = await response.json()

      if (response.ok) {
        // Success - store token and redirect to dashboard
        console.log("[v0] Staff login successful:", data)
        localStorage.setItem("staffToken", data.token)
        localStorage.setItem("staffRole", data.staff.role)
        localStorage.setItem("staffName", data.staff.name)
        localStorage.setItem("staffId", data.staff._id)

        if (data.staff.role === "receptionist") {
          window.location.href = "/receptionist-dashboard"
        } else if (data.staff.role === "doctor") {
          window.location.href = "/doctor-dashboard"
        } else {
          window.location.href = "/staff-dashboard"
        }
      } else {
        // Error handling
        alert(data.message || "Login failed. Please check your credentials.")
      }
    } catch (error) {
      console.error("[v0] Error during staff login:", error)
      alert("An error occurred. Please try again later.")
    } finally {
      // Reset button state
      submitButton.disabled = false
      submitButton.textContent = "Login"
    }
  })

  // Add entrance animation
  const card = document.querySelector(".portal-form-card")
  card.style.opacity = "0"
  card.style.transform = "translateY(20px)"

  setTimeout(() => {
    card.style.transition = "opacity 0.5s ease, transform 0.5s ease"
    card.style.opacity = "1"
    card.style.transform = "translateY(0)"
  }, 100)
})
