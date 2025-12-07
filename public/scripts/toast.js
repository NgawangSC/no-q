;(function () {
  function ensureContainer() {
    let container = document.querySelector(".toast-container")
    if (!container) {
      container = document.createElement("div")
      container.className = "toast-container"
      document.body.appendChild(container)
    }
    return container
  }

  function createToast(message, type, duration) {
    const container = ensureContainer()
    const toast = document.createElement("div")
    toast.className = `toast toast-${type || "info"}`

    const msgSpan = document.createElement("span")
    msgSpan.className = "toast-message"
    msgSpan.textContent = message

    const closeBtn = document.createElement("button")
    closeBtn.type = "button"
    closeBtn.className = "toast-close"
    closeBtn.innerHTML = "&times;"

    toast.appendChild(msgSpan)
    toast.appendChild(closeBtn)
    container.appendChild(toast)

    // small delay so transition works
    requestAnimationFrame(() => {
      toast.classList.add("show")
    })

    function removeToast() {
      toast.classList.remove("show")
      setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast)
        }
      }, 200)
    }

    closeBtn.addEventListener("click", removeToast)

    if (duration > 0) {
      setTimeout(removeToast, duration)
    }
  }

  window.NoQ = window.NoQ || {}

  window.NoQ.toast = function (message, type = "info", options = {}) {
    const safeMessage =
      typeof message === "string" ? message : String(message || "")
    const duration =
      typeof options.duration === "number" ? options.duration : 4000

    createToast(safeMessage, type, duration)
  }
})()
