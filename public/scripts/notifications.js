document.addEventListener("DOMContentLoaded", () => {
  const markAllReadBtn = document.getElementById("markAllReadBtn")
  const notificationBanner = document.getElementById("notificationBanner")

  // Mark all as read
  markAllReadBtn.addEventListener("click", () => {
    notificationBanner.innerHTML = "<span>All notifications marked as read</span>"
    notificationBanner.style.backgroundColor = "#D1FAE5"
    notificationBanner.style.color = "#065F46"

    setTimeout(() => {
      notificationBanner.style.display = "none"
    }, 2000)
  })
})
