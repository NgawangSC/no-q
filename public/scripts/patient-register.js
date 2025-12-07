// Enhanced Patient Registration JavaScript

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("registerForm")
  const cidInput = document.getElementById("cid")
  const submitBtn = document.getElementById("submitBtn")
  const messageContainer = document.getElementById("messageContainer")
  const submitBtnText = submitBtn.querySelector(".btn-text")

  // Pre-fill CID if provided in URL
  const urlParams = new URLSearchParams(window.location.search)
  const cidFromUrl = urlParams.get("cid")
  if (cidFromUrl) {
    cidInput.value = cidFromUrl
  }

  // Show message helper function
  function showMessage(message, type = 'success') {
    const messageDiv = document.createElement('div')
    messageDiv.className = `${type}-message`
    
    const icon = type === 'success' 
      ? '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M9 12l2 2 4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
      : '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><line x1="15" y1="9" x2="9" y2="15" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><line x1="9" y1="9" x2="15" y2="15" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
    
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

  // Set loading state
  function setLoading(isLoading) {
    if (isLoading) {
      submitBtn.disabled = true
      submitBtn.classList.add('loading')
      submitBtnText.innerHTML = '<span class="loading-spinner"></span>Registering...'
    } else {
      submitBtn.disabled = false
      submitBtn.classList.remove('loading')
      submitBtnText.textContent = 'Join Queue'
    }
  }

  // Validate form
  function validateForm(formData) {
    // Check required fields
    if (!formData.cid || !formData.name || !formData.phone || !formData.reason) {
      showMessage('Please fill in all required fields', 'error')
      return false
    }

    // Validate CID (numeric only)
    if (!/^\d+$/.test(formData.cid)) {
      showMessage('CID must contain numbers only', 'error')
      return false
    }

    // Validate phone
    if (!/^[0-9+()\-\s]+$/.test(formData.phone)) {
      showMessage('Please enter a valid phone number', 'error')
      return false
    }

    return true
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault()

    // Clear any existing messages
    messageContainer.innerHTML = ''

    const formData = {
      cid: document.getElementById("cid").value.trim(),
      name: document.getElementById("name").value.trim(),
      phone: document.getElementById("phone").value.trim(),
      reason: document.getElementById("reason").value,
      priority: document.querySelector('input[name="priority"]:checked').value,
    }

    // Validate form
    if (!validateForm(formData)) {
      return
    }

    // Set loading state
    setLoading(true)

    try {
      const response = await fetch("/api/patients", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      })

      const data = await response.json()

      if (response.ok) {
        // Success - show message and redirect
        showMessage(
          `Successfully registered! Your Queue Number: ${data.queueNumber}. Redirecting to status page...`,
          'success'
        )
        
        // Store patient data and redirect after delay
        sessionStorage.setItem("patientData", JSON.stringify({ patient: data }))
        
        setTimeout(() => {
          window.location.href = `/patient-status.html?cid=${formData.cid}`
        }, 2000)
      } else {
        // Error handling
        showMessage(data.error || "Failed to register. Please try again.", 'error')
      }
    } catch (error) {
      console.error("[v0] Error registering patient:", error)
      showMessage("An error occurred. Please check your connection and try again.", 'error')
    } finally {
      // Reset button state
      setLoading(false)
    }
  })

  // Add input animations
  const inputs = document.querySelectorAll('.patient-form-input, .patient-form-select')
  inputs.forEach(input => {
    input.addEventListener('focus', () => {
      input.parentElement.classList.add('focused')
    })
    
    input.addEventListener('blur', () => {
      if (!input.value) {
        input.parentElement.classList.remove('focused')
      }
    })
  })

  // Add real-time validation
  cidInput.addEventListener('input', (e) => {
    const value = e.target.value
    if (value && !/^\d+$/.test(value)) {
      e.target.setCustomValidity('CID must contain numbers only')
    } else {
      e.target.setCustomValidity('')
    }
  })

  const phoneInput = document.getElementById('phone')
  phoneInput.addEventListener('input', (e) => {
    const value = e.target.value
    if (value && !/^[0-9+()\-\s]+$/.test(value)) {
      e.target.setCustomValidity('Please enter a valid phone number')
    } else {
      e.target.setCustomValidity('')
    }
  })

  // Add entrance animation
  const card = document.querySelector(".patient-register-card")
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
