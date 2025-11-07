// Patient Registration JavaScript

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("registerForm")
  const cidInput = document.getElementById("cid")

  // Pre-fill CID if provided in URL
  const urlParams = new URLSearchParams(window.location.search)
  const cidFromUrl = urlParams.get("cid")
  if (cidFromUrl) {
    cidInput.value = cidFromUrl
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault()

    const formData = {
      cid: document.getElementById("cid").value.trim(),
      name: document.getElementById("name").value.trim(),
      phone: document.getElementById("phone").value.trim(),
      reason: document.getElementById("reason").value,
      priority: document.getElementById("priority").value,
    }

    const submitButton = form.querySelector(".form-submit-button")

    // Validate inputs
    if (!formData.cid || !formData.name || !formData.phone || !formData.reason) {
      alert("Please fill in all required fields")
      return
    }

    // Add loading state
    submitButton.disabled = true
    submitButton.textContent = "Registering..."

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
        // Success - redirect to queue status page
        alert(
          `Successfully registered!\n\nYour Queue Number: ${data.queueNumber}\n\nYou will be redirected to your status page.`,
        )
        sessionStorage.setItem("patientData", JSON.stringify({ patient: data }))
        window.location.href = `/patient-status.html?cid=${formData.cid}`
      } else {
        // Error handling
        alert(data.error || "Failed to register. Please try again.")
      }
    } catch (error) {
      console.error("[v0] Error registering patient:", error)
      alert("An error occurred. Please check your connection and try again.")
    } finally {
      // Reset button state
      submitButton.disabled = false
      submitButton.textContent = "Join Queue"
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
