// Patient Portal JavaScript

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("patientForm")

  form.addEventListener("submit", async (e) => {
    e.preventDefault()

    const cidNumber = document.getElementById("cidNumber").value.trim()
    const submitButton = form.querySelector(".form-submit-button")

    if (!cidNumber) {
      alert("Please enter your CID number")
      return
    }

    // Add loading state
    submitButton.disabled = true
    submitButton.textContent = "Checking..."

    try {
      const response = await fetch(`/api/patients/check/${cidNumber}`)

      if (response.ok) {
        const data = await response.json()
        sessionStorage.setItem("patientData", JSON.stringify(data))
        window.location.href = `/patient-status.html?cid=${cidNumber}`
      } else {
        const error = await response.json()
        if (response.status === 404) {
          const register = confirm(error.error + "\n\nWould you like to register for the queue?")
          if (register) {
            window.location.href = `/patient-register.html?cid=${cidNumber}`
          }
        } else {
          alert(error.error || "Failed to check status. Please try again.")
        }
      }
    } catch (error) {
      console.error("[v0] Error checking patient status:", error)
      alert("An error occurred. Please check your connection and try again.")
    } finally {
      // Reset button state
      submitButton.disabled = false
      submitButton.textContent = "Check Status"
    }
  })

  // Add entrance animation
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
