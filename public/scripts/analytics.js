// Analytics Dashboard JavaScript

let analyticsData = null

document.addEventListener("DOMContentLoaded", () => {
  // Check authentication
  const staffToken = localStorage.getItem("staffToken")
  if (!staffToken) {
    window.location.href = "/staff"
    return
  }

  // Set default date range (last 7 days)
  const endDate = new Date()
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - 7)

  document.getElementById("startDate").valueAsDate = startDate
  document.getElementById("endDate").valueAsDate = endDate

  // Load initial data
  loadAnalytics()

  // Real-time refresh when queue changes
  try {
    const es = new EventSource("/api/queue/stream")
    let refreshTimeout = null
    es.onmessage = (event) => {
      const data = JSON.parse(event.data)
      if (
        data.type === "patient-registered" ||
        data.type === "patient-called" ||
        data.type === "patient-completed" ||
        data.type === "patient-updated"
      ) {
        // debounce reload to avoid thrashing
        if (refreshTimeout) clearTimeout(refreshTimeout)
        refreshTimeout = setTimeout(loadAnalytics, 1000)
      }
    }
  } catch (e) {
    // ignore SSE errors; manual refresh still works
  }

  // Apply filter button
  document.getElementById("applyFilter").addEventListener("click", loadAnalytics)

  // Logout handler
  document.getElementById("logoutBtn").addEventListener("click", () => {
    localStorage.clear()
    window.location.href = "/staff"
  })
})

async function loadAnalytics() {
  const startDate = document.getElementById("startDate").value
  const endDate = document.getElementById("endDate").value
  const staffToken = localStorage.getItem("staffToken")

  try {
    const response = await fetch(`/api/analytics?startDate=${startDate}&endDate=${endDate}`, {
      headers: {
        Authorization: `Bearer ${staffToken}`,
      },
    })

    if (response.ok) {
      analyticsData = await response.json()
      updateDashboard(analyticsData)
    } else {
      alert("Failed to load analytics data")
    }
  } catch (error) {
    console.error("Error loading analytics:", error)
    alert("An error occurred while loading analytics")
  }
}

function updateDashboard(data) {
  // Update overview cards
  document.getElementById("totalPatients").textContent = data.overview.totalPatients
  document.getElementById("completedPatients").textContent = data.overview.completedPatients
  document.getElementById("avgWaitTime").textContent = data.overview.avgWaitTime
  document.getElementById("completionRate").textContent = data.overview.completionRate + "%"

  // Draw charts
  drawDailyChart(data.dailyStats)
  drawHourlyChart(data.hourlyStats)
  drawWaitTimeChart(data.waitTimeByHour)
  drawStatusChart(data.statusStats)
}

function drawDailyChart(dailyStats) {
  const canvas = document.getElementById("dailyChart")
  const ctx = canvas.getContext("2d")

  // Set canvas size
  canvas.width = canvas.offsetWidth
  canvas.height = 300

  if (!dailyStats || dailyStats.length === 0) {
    ctx.fillStyle = "#6b7280"
    ctx.font = "14px sans-serif"
    ctx.textAlign = "center"
    ctx.fillText("No data available", canvas.width / 2, canvas.height / 2)
    return
  }

  const padding = 40
  const chartWidth = canvas.width - padding * 2
  const chartHeight = canvas.height - padding * 2

  const maxValue = Math.max(...dailyStats.map((d) => d.total))
  const barWidth = chartWidth / dailyStats.length - 10

  // Draw bars
  dailyStats.forEach((day, index) => {
    const barHeight = (day.total / maxValue) * chartHeight
    const x = padding + index * (barWidth + 10)
    const y = canvas.height - padding - barHeight

    // Draw bar
    ctx.fillStyle = "#3b82f6"
    ctx.fillRect(x, y, barWidth, barHeight)

    // Draw label
    ctx.fillStyle = "#6b7280"
    ctx.font = "10px sans-serif"
    ctx.textAlign = "center"
    const date = new Date(day._id)
    ctx.fillText(`${date.getMonth() + 1}/${date.getDate()}`, x + barWidth / 2, canvas.height - padding + 15)

    // Draw value
    ctx.fillStyle = "#1f2937"
    ctx.font = "12px sans-serif"
    ctx.fillText(day.total, x + barWidth / 2, y - 5)
  })
}

function drawHourlyChart(hourlyStats) {
  const canvas = document.getElementById("hourlyChart")
  const ctx = canvas.getContext("2d")

  canvas.width = canvas.offsetWidth
  canvas.height = 300

  if (!hourlyStats || hourlyStats.length === 0) {
    ctx.fillStyle = "#6b7280"
    ctx.font = "14px sans-serif"
    ctx.textAlign = "center"
    ctx.fillText("No data available", canvas.width / 2, canvas.height / 2)
    return
  }

  const padding = 40
  const chartWidth = canvas.width - padding * 2
  const chartHeight = canvas.height - padding * 2

  const maxValue = Math.max(...hourlyStats.map((h) => h.count))
  const barWidth = chartWidth / 24 - 5

  // Draw all 24 hours
  for (let hour = 0; hour < 24; hour++) {
    const stat = hourlyStats.find((h) => h._id === hour)
    const count = stat ? stat.count : 0
    const barHeight = maxValue > 0 ? (count / maxValue) * chartHeight : 0
    const x = padding + hour * (barWidth + 5)
    const y = canvas.height - padding - barHeight

    // Draw bar
    ctx.fillStyle = count > 0 ? "#10b981" : "#e5e7eb"
    ctx.fillRect(x, y, barWidth, barHeight || 1)

    // Draw hour label (every 3 hours)
    if (hour % 3 === 0) {
      ctx.fillStyle = "#6b7280"
      ctx.font = "10px sans-serif"
      ctx.textAlign = "center"
      ctx.fillText(`${hour}:00`, x + barWidth / 2, canvas.height - padding + 15)
    }
  }
}

function drawWaitTimeChart(waitTimeData) {
  const canvas = document.getElementById("waitTimeChart")
  const ctx = canvas.getContext("2d")

  canvas.width = canvas.offsetWidth
  canvas.height = 300

  if (!waitTimeData || waitTimeData.length === 0) {
    ctx.fillStyle = "#6b7280"
    ctx.font = "14px sans-serif"
    ctx.textAlign = "center"
    ctx.fillText("No data available", canvas.width / 2, canvas.height / 2)
    return
  }

  const padding = 40
  const chartWidth = canvas.width - padding * 2
  const chartHeight = canvas.height - padding * 2

  const maxWaitTime = Math.max(...waitTimeData.map((d) => d.avgWaitTime))

  // Draw line chart
  ctx.beginPath()
  ctx.strokeStyle = "#f59e0b"
  ctx.lineWidth = 2

  waitTimeData.forEach((data, index) => {
    const x = padding + (data.hour / 23) * chartWidth
    const y = canvas.height - padding - (data.avgWaitTime / maxWaitTime) * chartHeight

    if (index === 0) {
      ctx.moveTo(x, y)
    } else {
      ctx.lineTo(x, y)
    }

    // Draw point
    ctx.fillStyle = "#f59e0b"
    ctx.beginPath()
    ctx.arc(x, y, 4, 0, Math.PI * 2)
    ctx.fill()
  })

  ctx.stroke()

  // Draw labels
  waitTimeData.forEach((data) => {
    const x = padding + (data.hour / 23) * chartWidth
    ctx.fillStyle = "#6b7280"
    ctx.font = "10px sans-serif"
    ctx.textAlign = "center"
    if (data.hour % 3 === 0) {
      ctx.fillText(`${data.hour}:00`, x, canvas.height - padding + 15)
    }
  })
}

function drawStatusChart(statusStats) {
  const container = document.getElementById("statusChart")
  container.innerHTML = ""

  if (!statusStats || statusStats.length === 0) {
    container.innerHTML = '<p style="text-align: center; color: #6b7280;">No data available</p>'
    return
  }

  const total = statusStats.reduce((sum, stat) => sum + stat.count, 0)

  const colors = {
    waiting: "#fbbf24",
    "in-progress": "#3b82f6",
    completed: "#10b981",
    cancelled: "#ef4444",
  }

  statusStats.forEach((stat) => {
    const percentage = ((stat.count / total) * 100).toFixed(1)

    const item = document.createElement("div")
    item.className = "status-item"
    item.innerHTML = `
      <div class="status-bar-container">
        <div class="status-bar" style="width: ${percentage}%; background: ${colors[stat._id] || "#6b7280"}"></div>
      </div>
      <div class="status-info">
        <span class="status-name">${stat._id}</span>
        <span class="status-value">${stat.count} (${percentage}%)</span>
      </div>
    `
    container.appendChild(item)
  })
}
