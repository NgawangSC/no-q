document.addEventListener("DOMContentLoaded", () => {
  // State management
  let doctorProfile = null;
  let currentPatient = null;
  let queueList = [];
  let eventSource = null;
  let pollingIntervalId = null;

  // DOM elements
  const elements = {
    // Profile elements
    noProfileMessage: document.getElementById("noProfileMessage"),
    dashboardGrid: document.getElementById("dashboardGrid"),
    doctorAvatar: document.getElementById("doctorAvatar"),
    doctorName: document.getElementById("doctorName"),
    doctorEmail: document.getElementById("doctorEmail"),
    doctorSpecialization: document.getElementById("doctorSpecialization"),
    chamberInfo: document.getElementById("chamberInfo"),
    chamberLocation: document.getElementById("chamberLocation"),

    // Current patient elements
    noCurrentPatient: document.getElementById("noCurrentPatient"),
    currentPatientDetails: document.getElementById("currentPatientDetails"),
    currentToken: document.getElementById("currentToken"),
    enteredTime: document.getElementById("enteredTime"),
    patientName: document.getElementById("patientName"),
    patientCID: document.getElementById("patientCID"),
    patientAge: document.getElementById("patientAge"),
    patientGender: document.getElementById("patientGender"),
    patientComplaint: document.getElementById("patientComplaint"),

    // Buttons
    callNextBtn: document.getElementById("callNextBtn"),
    completePatientBtn: document.getElementById("completePatientBtn"),
    callNextFromCurrentBtn: document.getElementById("callNextFromCurrentBtn"),
    logoutBtn: document.getElementById("logoutBtn"),
    refreshBtn: document.getElementById("refreshBtn"),

    // Loading spinners
    callNextText: document.getElementById("callNextText"),
    callNextSpinner: document.getElementById("callNextSpinner"),
    completeText: document.getElementById("completeText"),
    completeSpinner: document.getElementById("completeSpinner"),
    callNextFromCurrentText: document.getElementById("callNextFromCurrentText"),
    callNextFromCurrentSpinner: document.getElementById("callNextFromCurrentSpinner"),

    // Queue elements
    queueLoading: document.getElementById("queueLoading"),
    queueList: document.getElementById("queueList"),
    emptyQueue: document.getElementById("emptyQueue"),

    // Prescription
    prescriptionInput: document.getElementById("prescriptionInput"),
  };

  // Helper for authenticated fetch using cookie
  async function apiFetch(url, options = {}) {
    const response = await fetch(url, {
      ...options,
      credentials: "include", // send auth_token cookie
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
    });

    if (response.status === 401 || response.status === 403) {
      // Not authorized, clear local state and force login
      localStorage.removeItem("staffRole");
      localStorage.removeItem("staffName");
      localStorage.removeItem("staffId");
      window.location.href = "/staff";
      throw new Error("Unauthorized");
    }

    return response;
  }

  // Initialize dashboard
  init();

  async function init() {
    try {
      // Use data set during login
      const staffRole = localStorage.getItem("staffRole");
      const staffId = localStorage.getItem("staffId");

      if (!staffRole || !staffId || staffRole !== "doctor") {
        window.location.href = "/staff";
        return;
      }

      // Load doctor profile; returns true if profile exists
      const hasProfile = await loadDoctorProfile(staffId);

      // Setup event listeners
      setupEventListeners();

      if (!hasProfile) {
        showNoProfileMessage();
        disableQueueActions();
        return;
      }

      showDashboard();

      // Connect to SSE for real-time updates (with polling fallback)
      const doctorContext = {
        staffId,
        chamberId: doctorProfile.chamber_id,
      };
      connectQueueStreamForDoctor(doctorContext);

      // Load initial data
      await loadDashboardData();
    } catch (error) {
      console.error("Initialization error:", error);
      showError("Failed to initialize dashboard");
    }
  }

  async function loadDoctorProfile(staffId) {
    try {
      const response = await apiFetch(`/api/doctor/profile/${staffId}`);

      if (!response.ok) {
        if (response.status === 404) {
          // No profile configured for this doctor
          console.warn("Doctor profile not found for staffId", staffId);
          if (elements.noProfileMessage)
            elements.noProfileMessage.style.display = "block";
          if (elements.dashboardGrid)
            elements.dashboardGrid.style.display = "none";
          return false;
        }
        throw new Error("Failed to load profile");
      }

      doctorProfile = await response.json();

      const doctorName = doctorProfile.name || "Doctor";
      const spec = doctorProfile.specialization;
      const chamber = doctorProfile.chamber;

      const specializationName =
        spec && spec.name ? spec.name : "Not assigned";
      const chamberLabel =
        chamber && chamber.chamber_number
          ? `Chamber ${chamber.chamber_number}`
          : "Not assigned";

      if (chamber && (chamber._id || chamber.id)) {
        doctorProfile.chamber_id = chamber._id || chamber.id;
      }

      if (elements.doctorName) elements.doctorName.textContent = doctorName;
      if (elements.doctorEmail)
        elements.doctorEmail.textContent = doctorProfile.email || "";
      if (elements.doctorSpecialization)
        elements.doctorSpecialization.textContent = specializationName;
      if (elements.chamberInfo) elements.chamberInfo.textContent = chamberLabel;
      if (elements.chamberLocation)
        elements.chamberLocation.textContent = chamberLabel;

      if (doctorName && elements.doctorAvatar) {
        elements.doctorAvatar.textContent = doctorName.charAt(0).toUpperCase();
      }

      return true;
    } catch (error) {
      throw error;
    }
  }

  function setupEventListeners() {
    // Call next patient (from no patient state)
    elements.callNextBtn?.addEventListener("click", () => callNextPatient());

    // Call next patient (from current patient state)
    elements.callNextFromCurrentBtn?.addEventListener("click", () =>
      callNextPatient()
    );

    // Complete current patient
    elements.completePatientBtn?.addEventListener("click", () =>
      completeCurrentPatient()
    );

    // Logout
    elements.logoutBtn?.addEventListener("click", () => {
      localStorage.removeItem("staffRole");
      localStorage.removeItem("staffName");
      localStorage.removeItem("staffId");
      window.location.href = "/staff";
    });

    // Refresh
    elements.refreshBtn?.addEventListener("click", () => loadDashboardData());

    // Hide spinners initially
    if (elements.callNextSpinner) elements.callNextSpinner.style.display = "none";
    if (elements.callNextFromCurrentSpinner)
      elements.callNextFromCurrentSpinner.style.display = "none";
    if (elements.completeSpinner) elements.completeSpinner.style.display = "none";
  }

  async function loadDashboardData() {
    if (!doctorProfile || !doctorProfile.chamber_id) return;

    try {
      await Promise.all([loadCurrentPatient(), loadQueueList()]);
    } catch (error) {
      console.error("Error loading dashboard data:", error);
    }
  }

  async function loadCurrentPatient() {
    if (!doctorProfile?.chamber_id) return;

    try {
      const response = await apiFetch(
        `/api/queue/current?chamber=${doctorProfile.chamber_id}`
      );

      if (!response.ok) {
        throw new Error("Failed to load current patient");
      }

      const data = await response.json();
      currentPatient = data.patient;

      if (currentPatient) {
        showCurrentPatient(currentPatient);
      } else {
        showNoCurrentPatient();
      }
    } catch (error) {
      console.error("Error loading current patient:", error);
      showNoCurrentPatient();
    }
  }

  async function loadQueueList() {
    if (!doctorProfile?.chamber_id) return;

    try {
      elements.queueLoading.style.display = "block";
      elements.queueList.style.display = "none";
      elements.emptyQueue.style.display = "none";

      const response = await apiFetch(
        `/api/queue/current?chamber=${doctorProfile.chamber_id}`
      );

      if (!response.ok) {
        throw new Error("Failed to load queue");
      }

      const data = await response.json();
      queueList = data.queue || [];

      elements.queueLoading.style.display = "none";

      if (queueList.length === 0) {
        elements.emptyQueue.style.display = "block";
      } else {
        elements.queueList.style.display = "block";
        renderQueueList(queueList);
      }
    } catch (error) {
      console.error("Error loading queue:", error);
      elements.queueLoading.style.display = "none";
      elements.emptyQueue.style.display = "block";
    }
  }

  function showCurrentPatient(patient) {
    currentPatient = patient;

    elements.noCurrentPatient.style.display = "none";
    elements.currentPatientDetails.style.display = "block";

    elements.currentToken.textContent = patient.tokenNumber || "-";
    elements.enteredTime.textContent = patient.enteredTime
      ? new Date(patient.enteredTime).toLocaleTimeString()
      : "-";
    elements.patientName.textContent = patient.name || "-";
    elements.patientCID.textContent = patient.cid || "-";
    elements.patientAge.textContent = patient.age
      ? `${patient.age} years`
      : "-";
    elements.patientGender.textContent = patient.gender || "-";
    elements.patientComplaint.textContent = patient.chiefComplaint || "-";

    if (elements.prescriptionInput) {
      elements.prescriptionInput.value = patient.prescription || "";
    }

    if (elements.completePatientBtn) {
      const isInProgress = patient.status === "in-progress";
      elements.completePatientBtn.disabled = !isInProgress;
    }
  }

  function showNoCurrentPatient() {
    currentPatient = null;
    elements.noCurrentPatient.style.display = "block";
    elements.currentPatientDetails.style.display = "none";

    if (elements.completePatientBtn) {
      elements.completePatientBtn.disabled = true;
    }
  }

  function renderQueueList(queue) {
    elements.queueList.innerHTML = "";

    queue.forEach((patient) => {
      const queueItem = document.createElement("div");
      queueItem.className = "queue-item";

      const statusClass =
        patient.status === "called" ? "status-called" : "status-waiting";
      const statusText = patient.status || "waiting";

      queueItem.innerHTML = `
        <div class="queue-token">${patient.tokenNumber || "-"}</div>
        <div class="queue-details">
          <div class="queue-name">${patient.name || "-"}</div>
          <div class="queue-complaint">${
            patient.chiefComplaint || "No complaint"
          }</div>
          <div class="queue-time">Joined: ${
            patient.enteredTime
              ? new Date(patient.enteredTime).toLocaleTimeString()
              : "-"
          }</div>
        </div>
        <div class="status-badge ${statusClass}">${statusText}</div>
      `;

      elements.queueList.appendChild(queueItem);
    });
  }

  async function callNextPatient() {
    if (!doctorProfile?.chamber_id) {
      alert("Chamber not assigned. Please contact administration.");
      return;
    }

    const button = currentPatient
      ? elements.callNextFromCurrentBtn
      : elements.callNextBtn;
    const textElement = currentPatient
      ? elements.callNextFromCurrentText
      : elements.callNextText;
    const spinnerElement = currentPatient
      ? elements.callNextFromCurrentSpinner
      : elements.callNextSpinner;

    try {
      button.disabled = true;
      if (textElement) textElement.style.display = "none";
      if (spinnerElement) spinnerElement.style.display = "inline-block";

      const response = await apiFetch("/api/queue/call-next", {
        method: "POST",
        body: JSON.stringify({
          chamber: doctorProfile.chamber_id,
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || "Failed to call next patient");
      }

      const result = await response.json();
      if (result.message) {
        console.log(result.message);
      }

      await loadDashboardData();
    } catch (error) {
      console.error("Error calling next patient:", error);
      alert(error.message || "Failed to call next patient. Please try again.");
    } finally {
      button.disabled = false;
      if (textElement) textElement.style.display = "inline";
      if (spinnerElement) spinnerElement.style.display = "none";
    }
  }

  async function completeCurrentPatient() {
    if (!currentPatient?.tokenNumber) {
      alert("No current patient to complete.");
      return;
    }

    try {
      elements.completePatientBtn.disabled = true;
      if (elements.completeText) elements.completeText.style.display = "none";
      if (elements.completeSpinner)
        elements.completeSpinner.style.display = "inline-block";

      const body = {
        prescription: elements.prescriptionInput
          ? elements.prescriptionInput.value || ""
          : "",
      };

      const response = await apiFetch(
        `/api/queue/complete/${currentPatient.tokenNumber}`,
        {
          method: "POST",
          body: JSON.stringify(body),
        }
      );

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));

        if (
          response.status === 404 &&
          (errorBody?.error === "Patient not found or not in progress" ||
            errorBody?.message === "Patient not found or not in progress")
        ) {
          alert(
            "No active patient to complete. Please call next patient first."
          );
          await loadDashboardData();
          return;
        }

        throw new Error(
          errorBody.message ||
            errorBody.error ||
            "Failed to complete patient"
        );
      }

      const result = await response.json();
      if (result.message) {
        console.log(result.message);
      }

      await loadDashboardData();
    } catch (error) {
      console.error("Error completing patient:", error);
      alert(error.message || "Failed to complete patient. Please try again.");
    } finally {
      elements.completePatientBtn.disabled = false;
      if (elements.completeText) elements.completeText.style.display = "inline";
      if (elements.completeSpinner)
        elements.completeSpinner.style.display = "none";
    }
  }

  function startDoctorQueuePolling(context, intervalMs = 10000) {
    // Clear any existing polling interval
    if (pollingIntervalId !== null) {
      clearInterval(pollingIntervalId);
      pollingIntervalId = null;
    }

    // Basic safeguard: only poll if we have a chamber
    if (!doctorProfile || !doctorProfile.chamber_id) {
      return;
    }

    pollingIntervalId = setInterval(() => {
      loadDashboardData();
    }, intervalMs);
  }

  function connectQueueStreamForDoctor(context) {
    // If SSE is not supported, immediately fall back to polling
    if (typeof window.EventSource === "undefined") {
      console.warn("EventSource is not supported. Falling back to polling.");
      startDoctorQueuePolling(context);
      return;
    }

    try {
      eventSource = new EventSource("/api/queue/stream");

      eventSource.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);

          // Initial handshake event from the server
          if (payload.type === "connected") {
            return;
          }

          // Broadcasts from queue routes when a patient is registered/called/completed/updated
          if (
            payload.type === "patient-registered" ||
            payload.type === "patient-called" ||
            payload.type === "patient-completed" ||
            payload.type === "patient-updated"
          ) {
            const eventPatient = payload.patient || null;

            // If we know the doctor's chamber, only react to events for that chamber
            if (doctorProfile && doctorProfile.chamber_id) {
              const doctorChamberId = String(doctorProfile.chamber_id);

              const eventChamberId =
                eventPatient &&
                (eventPatient.chamber_id != null || eventPatient.chamber != null)
                  ? String(eventPatient.chamber_id || eventPatient.chamber)
                  : null;

              if (eventChamberId !== null && eventChamberId !== doctorChamberId) {
                return; // Event is for another chamber; ignore
              }
            }

            // For relevant events, refresh the doctor's current patient and queue
            loadDashboardData();
          }
        } catch (error) {
          console.error("Error parsing SSE message:", error);
        }
      };

      eventSource.onerror = (error) => {
        console.error("SSE error:", error);
        try {
          eventSource.close();
        } catch (e) {
          // ignore
        }

        // Fall back to polling if SSE fails
        startDoctorQueuePolling(context);
      };
    } catch (error) {
      console.error("Error connecting to SSE:", error);
      // If creating the EventSource fails, immediately start polling
      startDoctorQueuePolling(context);
    }
  }

  function disableQueueActions() {
    if (elements.callNextBtn) elements.callNextBtn.disabled = true;
    if (elements.callNextFromCurrentBtn)
      elements.callNextFromCurrentBtn.disabled = true;
    if (elements.completePatientBtn)
      elements.completePatientBtn.disabled = true;
  }

  function showNoProfileMessage() {
    if (elements.noProfileMessage)
      elements.noProfileMessage.style.display = "block";
    if (elements.dashboardGrid)
      elements.dashboardGrid.style.display = "none";
  }

  function showDashboard() {
    if (elements.noProfileMessage)
      elements.noProfileMessage.style.display = "none";
    if (elements.dashboardGrid)
      elements.dashboardGrid.style.display = "grid";
  }

  function showError(message) {
    alert(message);
  }
});
