// Main JavaScript file for No-Q application

// Add smooth scroll behavior
document.documentElement.style.scrollBehavior = "smooth"

// Add loading animation for buttons
document.addEventListener("DOMContentLoaded", () => {
  const buttons = document.querySelectorAll(".portal-button")

  buttons.forEach((button) => {
    button.addEventListener("click", function (e) {
      // Add loading state
      this.style.opacity = "0.7"
      this.style.pointerEvents = "none"

      // Reset after navigation (in case navigation is prevented)
      setTimeout(() => {
        this.style.opacity = "1"
        this.style.pointerEvents = "auto"
      }, 2000)
    })
  })

  // Add entrance animations
  const cards = document.querySelectorAll(".portal-card")
  cards.forEach((card, index) => {
    card.style.opacity = "0"
    card.style.transform = "translateY(20px)"

    setTimeout(
      () => {
        card.style.transition = "opacity 0.5s ease, transform 0.5s ease"
        card.style.opacity = "1"
        card.style.transform = "translateY(0)"
      },
      100 * (index + 1),
    )
  })
})

// Add console message for developers
console.log("%cNo-Q Healthcare Queue Management System", "color: #14B8A6; font-size: 20px; font-weight: bold;")
console.log("%cBuilt with HTML, CSS, JavaScript, Express.js, and MongoDB", "color: #6b7280; font-size: 12px;")
