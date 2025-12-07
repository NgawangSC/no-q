// Patient Portal JavaScript

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("patientForm")
  const messageContainer = document.getElementById("messageContainer")

  // Show message helper function
  function showMessage(message, type = 'error') {
    const messageDiv = document.createElement('div')
    messageDiv.className = `portal-${type}-message`
    
    const icon = type === 'success' 
      ? '<svg class="portal-message-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M9 12l2 2 4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
      : '<svg class="portal-message-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><line x1="15" y1="9" x2="9" y2="15" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><line x1="9" y1="9" x2="15" y2="15" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
    
    messageDiv.innerHTML = `${icon}<span>${message}</span>`
    messageContainer.innerHTML = ''
    messageContainer.appendChild(messageDiv)
    
    // Auto-remove message after 5 seconds
    setTimeout(() => {
      if (messageDiv.parentNode) {
        messageDiv.remove()
      }
    }, 5000)
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault()

    const cidNumber = document.getElementById("cidNumber").value.trim()
    const submitButton = form.querySelector(".form-submit-button")

    if (!cidNumber) {
      showMessage("Please enter your CID number", 'error')
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
          showMessage(error.error || "Patient not found. Please register at the receptionist desk.", 'error')
        } else {
          showMessage(error.error || "Failed to check status. Please try again.", 'error')
        }
      }
    } catch (error) {
      console.error("[v0] Error checking patient status:", error)
      showMessage("An error occurred. Please check your connection and try again.", 'error')
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
