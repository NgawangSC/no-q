// Patient Status JavaScript

let refreshInterval = null
let eventSource = null
let previousQueuePosition = null
let previousStatus = null
let currentCid = null
let notificationSound = null

document.addEventListener("DOMContentLoaded", () => {
  const urlParams = new URLSearchParams(window.location.search)
  currentCid = urlParams.get("cid")

  if (!currentCid) {
    showError("No CID provided. Please go back and enter your CID.")
    return
  }

  // Initialize notification sound
  initializeNotificationSound()

  // Request notification permission
  requestNotificationPermission()

  // Load initial status
  loadPatientStatus(currentCid)

  setupSSE(currentCid)

  // Set up auto-refresh every 30 seconds as fallback
  refreshInterval = setInterval(() => {
    loadPatientStatus(currentCid, true)
  }, 30000)

  // Manual refresh button
  document.getElementById("refreshButton").addEventListener("click", () => {
    loadPatientStatus(currentCid)
  })

  // Dismiss notification button
  const dismissBtn = document.getElementById("dismissNotification")
  if (dismissBtn) {
    dismissBtn.addEventListener("click", () => {
      hideNotificationBanner()
    })
  }
})

function setupSSE(cid) {
  eventSource = new EventSource("/api/queue/stream")

  eventSource.onmessage = (event) => {
    const data = JSON.parse(event.data)

    if (data.type === "connected") {
      console.log("[v0] Connected to real-time updates")
      return
    }

    // Check if this notification is for the current patient
    if (data.type === "patient-called" && data.patient) {
      const calledCid = data.patient.cid || data.patient.cidNumber || data.patient.cidNumber
      // Normalize CID for comparison (trim and lowercase)
      const normalizedCalledCid = calledCid ? String(calledCid).trim().toLowerCase() : null
      const normalizedCurrentCid = cid ? String(cid).trim().toLowerCase() : null
      
      if (normalizedCalledCid && normalizedCurrentCid && normalizedCalledCid === normalizedCurrentCid) {
        // This patient was called! Show immediate notification
        console.log("Patient called via SSE - showing notification")
        showTurnNotification()
      }
    }

    // Reload status when queue changes
    if (data.type === "patient-called" || data.type === "patient-completed" || data.type === "patient-registered") {
      const urlParams = new URLSearchParams(window.location.search)
      const currentCid = urlParams.get("cid")
      
      // Store current position before reload
      const positionNumberElement = document.getElementById("positionNumber")
      if (positionNumberElement) {
        const currentText = positionNumberElement.textContent
        previousQueuePosition = parseInt(currentText) || null
      }
      
      loadPatientStatus(currentCid, true)
    }
  }

  eventSource.onerror = (error) => {
    console.error("[v0] SSE connection error:", error)
    eventSource.close()
    // Reconnect after 5 seconds
    setTimeout(() => setupSSE(cid), 5000)
  }
}

async function loadPatientStatus(cid, silent = false) {
  const loadingState = document.getElementById("loadingState")
  const statusContent = document.getElementById("statusContent")
  const errorState = document.getElementById("errorState")

  if (!silent) {
    loadingState.style.display = "flex"
    statusContent.style.display = "none"
    errorState.style.display = "none"
  }

  try {
    const response = await fetch(`/api/patients/status/${cid}`)

    if (response.ok) {
      const data = await response.json()
      displayPatientStatus(data)

      loadingState.style.display = "none"
      statusContent.style.display = "block"
      errorState.style.display = "none"
    } else {
      const error = await response.json()
      showError(error.message || "Failed to load status")
    }
  } catch (error) {
    console.error("[v0] Error loading patient status:", error)
    showError("Connection error. Please check your internet connection.")
  }
}

function displayPatientStatus(data) {
  if (!data || !data.patient) {
    showError("No patient found for this CID. Please check your CID and try again.")
    return
  }

  const { patient } = data
  const queuePosition = data.queuePosition
  const estimatedWaitTime = data.estimatedWaitTime
  const totalWaiting = data.totalWaiting

  // Check if queue position has improved (tokens ahead cleared)
  const positionNumberElement = document.getElementById("positionNumber")
  if (positionNumberElement && previousQueuePosition !== null && queuePosition < previousQueuePosition) {
    const tokensCleared = previousQueuePosition - queuePosition
    if (tokensCleared > 0 && queuePosition > 1) {
      showNotification(`Good news! ${tokensCleared} token${tokensCleared > 1 ? 's' : ''} ahead of you have been cleared. Your position has improved!`)
    }
  }

  // Patient Info
  document.getElementById("patientName").textContent = patient.name || "-"
  document.getElementById("patientCid").textContent = patient.cid || "-"

  const tokenNumber =
    patient.tokenNumber ??
    data.queuePosition ??
    null

  const tokenElement = document.getElementById("tokenNumber")
  tokenElement.textContent = tokenNumber != null ? `#${tokenNumber}` : "-"
  
  // Update chamber display to show chamber number (handles object or primitive)
  let chamberText = '-'
  if (patient.chamberInfo && typeof patient.chamberInfo === "object") {
    const num = patient.chamberInfo.chamber_number ?? '-'
    chamberText = `Chamber ${num}`
    if (patient.chamberInfo.specialization_name) {
      chamberText += ` - ${patient.chamberInfo.specialization_name}`
    }
  } else if (patient.chamber && typeof patient.chamber === "object") {
    const num = patient.chamber.chamber_number ?? '-'
    chamberText = `Chamber ${num}`
  } else if (patient.chamber != null) {
    chamberText = `Chamber ${patient.chamber}`
  }
  document.getElementById("patientChamber").textContent = chamberText

  // Doctor & Specialization (from enriched status payload)
  const doctorElement = document.getElementById("patientDoctor")
  if (doctorElement) {
    const doctorName =
      patient.doctorName ||
      patient.doctor_name ||
      patient.assignedDoctor ||
      patient.assigned_doctor ||
      "-"

    doctorElement.textContent = doctorName
  }

  const specializationElement = document.getElementById("patientSpecialization")
  if (specializationElement) {
    const specialization =
      patient.specialization ||
      patient.specialization_name ||
      "-"

    specializationElement.textContent = specialization
  }

  // Debug logs for doctor & specialization mapping
  console.log("[STATUS] doctorName from API:", patient.doctorName)
  console.log("[STATUS] specialization from API:", patient.specialization)

  if (doctorElement) {
    console.log(
      "[STATUS] #patientDoctor innerText after set:",
      doctorElement.textContent
    )
  }

  if (specializationElement) {
    console.log(
      "[STATUS] #patientSpecialization innerText after set:",
      specializationElement.textContent
    )
  }

  // Status Badge
  const statusBadge = document.getElementById("statusBadge")
  const statusText = document.getElementById("statusText")
  statusBadge.className = `status-badge status-${patient.status}`

  const statusLabels = {
    waiting: "Waiting in Queue",
    "in-progress": "Being Served",
    completed: "Completed",
    cancelled: "Cancelled",
  }
  statusText.textContent = statusLabels[patient.status] || patient.status

  // Queue Position (only show if waiting)
  const queuePositionCard = document.getElementById("queuePositionCard")
  const peopleAheadRow = document.getElementById("peopleAheadRow")
  const peopleAheadElement = document.getElementById("peopleAhead")
  
  if (patient.status === "waiting") {
    queuePositionCard.style.display = "flex"
    
    // Calculate people ahead (queuePosition - 1 since position 1 means 0 people ahead)
    const peopleAhead = Math.max(0, (queuePosition || 1) - 1)
    
    // Update the position number (which is actually the queue position)
    document.getElementById("positionNumber").textContent = queuePosition
    
    // Show and update the people ahead count
    if (peopleAheadRow) {
      peopleAheadRow.style.display = "flex"
      peopleAheadElement.textContent = `${peopleAhead} in queue`
    }
  } else {
    queuePositionCard.style.display = "none"
    if (peopleAheadRow) {
      peopleAheadRow.style.display = "none"
    }
  }

  // Estimated Wait Time
  const waitTimeElement = document.getElementById("waitTime")
  if (patient.status === "waiting" && estimatedWaitTime > 0) {
    waitTimeElement.textContent = `${estimatedWaitTime} minutes`
  } else if (patient.status === "in-progress") {
    waitTimeElement.textContent = "You're being served now!"
  } else if (patient.status === "completed") {
    waitTimeElement.textContent = "Visit completed"
  } else {
    waitTimeElement.textContent = "Please wait"
  }

  // Additional Info
  if (document.getElementById("visitReason")) {
    document.getElementById("visitReason").textContent = patient.chiefComplaint || "Not specified"
  }
  if (document.getElementById("registeredTime")) {
    const registeredAtRaw =
      patient.registeredAt ||
      patient.enteredTime ||
      patient.createdAt ||
      patient.created_at ||
      null

    let registeredAtText = "Not available"
    if (registeredAtRaw) {
      const d = new Date(registeredAtRaw)
      if (!isNaN(d.getTime())) {
        registeredAtText = d.toLocaleString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })
      }
    }

    document.getElementById("registeredTime").textContent = registeredAtText
  }

  // Doctor Information
  const doctorInfo = document.getElementById("doctorInfo")
  const doctorName = document.getElementById("doctorName")
  if (patient.doctor && patient.doctor.doctor_name) {
    doctorInfo.style.display = "flex"
    let doctorText = patient.doctor.doctor_name
    if (patient.doctor.specialization_name) {
      doctorText += ` (${patient.doctor.specialization_name})`
    }
    doctorName.textContent = doctorText
  } else {
    doctorInfo.style.display = "none"
  }

  // Prescription Information
  const prescriptionInfo = document.getElementById("prescriptionInfo")
  const prescriptionText = document.getElementById("prescriptionText")
  if (patient.prescription && patient.status === "completed") {
    prescriptionInfo.style.display = "flex"
    prescriptionText.textContent = patient.prescription
  } else {
    prescriptionInfo.style.display = "none"
  }

  // Check if patient status changed to "in-progress" (being called)
  const wasWaiting = previousStatus === "waiting"
  const isInProgress = patient.status === "in-progress"
  
  if (wasWaiting && isInProgress) {
    // Status changed from waiting to in-progress - patient was just called!
    showTurnNotification()
  } else if (isInProgress && !previousStatus) {
    // First load and already in-progress - might have been called before page load
    const notifiedKey = `notified-${patient.cid || patient.cidNumber}`
    if (!sessionStorage.getItem(notifiedKey)) {
      showTurnNotification()
      sessionStorage.setItem(notifiedKey, "true")
    }
  }

  // Update previous status for next comparison
  previousStatus = patient.status
}

function showError(message) {
  document.getElementById("loadingState").style.display = "none"
  document.getElementById("statusContent").style.display = "none"
  document.getElementById("errorState").style.display = "flex"
  document.getElementById("errorMessage").textContent = message
}

// Initialize notification sound using Web Audio API
function initializeNotificationSound() {
  try {
    // Create a simple beep sound using Web Audio API
    const audioContext = new (window.AudioContext || window.webkitAudioContext)()
    
    // Store audio context for later use
    window.audioContext = audioContext
  } catch (error) {
    console.warn("Could not initialize audio context:", error)
  }
}

// Play notification sound
function playNotificationSound() {
  try {
    if (!window.audioContext) {
      initializeNotificationSound()
    }
    
    const ctx = window.audioContext || new (window.AudioContext || window.webkitAudioContext)()
    const oscillator = ctx.createOscillator()
    const gainNode = ctx.createGain()
    
    oscillator.connect(gainNode)
    gainNode.connect(ctx.destination)
    
    // Create a pleasant notification sound
    oscillator.frequency.value = 800
    oscillator.type = "sine"
    
    gainNode.gain.setValueAtTime(0.3, ctx.currentTime)
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5)
    
    oscillator.start(ctx.currentTime)
    oscillator.stop(ctx.currentTime + 0.5)
    
    // Play a second beep after a short delay
    setTimeout(() => {
      const oscillator2 = ctx.createOscillator()
      const gainNode2 = ctx.createGain()
      
      oscillator2.connect(gainNode2)
      gainNode2.connect(ctx.destination)
      
      oscillator2.frequency.value = 1000
      oscillator2.type = "sine"
      
      gainNode2.gain.setValueAtTime(0.3, ctx.currentTime)
      gainNode2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5)
      
      oscillator2.start(ctx.currentTime)
      oscillator2.stop(ctx.currentTime + 0.5)
    }, 300)
  } catch (error) {
    console.warn("Could not play notification sound:", error)
  }
}

// Show turn notification (when patient is called)
function showTurnNotification() {
  const banner = document.getElementById("notificationBanner")
  const title = document.getElementById("notificationTitle")
  const message = document.getElementById("notificationMessage")
  
  if (banner && title && message) {
    title.textContent = "It's Your Turn! 🎉"
    message.textContent = "Please proceed to the reception desk immediately."
    banner.className = "notification-banner urgent"
    banner.style.display = "block"
    
    // Scroll to notification
    banner.scrollIntoView({ behavior: "smooth", block: "nearest" })
  }

  // Play notification sound
  playNotificationSound()

  // Show browser notification
  showBrowserNotification("It's Your Turn!", "Please proceed to the reception desk immediately.")
  
  // Mark as notified
  if (currentCid) {
    sessionStorage.setItem(`notified-${currentCid}`, "true")
  }
}

// Hide notification banner
function hideNotificationBanner() {
  const banner = document.getElementById("notificationBanner")
  if (banner) {
    banner.style.display = "none"
  }
}

// Show browser notification
function showBrowserNotification(title, message) {
  if ("Notification" in window && Notification.permission === "granted") {
    const notification = new Notification(title, {
      body: message,
      icon: "/placeholder-logo.png",
      badge: "/placeholder-logo.png",
      tag: "patient-turn",
      requireInteraction: true,
      vibrate: [200, 100, 200],
    })
    
    // Close notification after 10 seconds
    setTimeout(() => {
      notification.close()
    }, 10000)
    
    // Handle click on notification
    notification.onclick = () => {
      window.focus()
      notification.close()
    }
  }
}

// Request notification permission
function requestNotificationPermission() {
  if ("Notification" in window && Notification.permission === "default") {
    Notification.requestPermission().then((permission) => {
      if (permission === "granted") {
        console.log("Notification permission granted")
      }
    })
  }
}

// Legacy notification function for other notifications
function showNotification(message) {
  showBrowserNotification("No-Q", message)
}

// Clean up on page unload
window.addEventListener("beforeunload", () => {
  if (refreshInterval) {
    clearInterval(refreshInterval)
  }
  if (eventSource) {
    eventSource.close()
  }
})
