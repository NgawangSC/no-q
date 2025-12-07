// Admin Registration JavaScript

document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("adminRegisterForm");
    const messageContainer = document.getElementById("messageContainer");

    // Load staff list on page load
    loadStaffList();

    // Form submission
    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        // Get basic form data
        const formData = {
            cid: document.getElementById("cidNumber").value.trim(),
            name: document.getElementById("fullName").value.trim(),
            email: document.getElementById("email").value.trim(),
            role: document.getElementById("role").value,
            password: document.getElementById("password").value,
            confirmPassword: document.getElementById("confirmPassword").value
        };

        // Add doctor-specific fields if role is doctor
        if (formData.role === 'doctor') {
            formData.doctorProfile = {
                specialization_id: document.getElementById("specialization").value,
                chamber_id: document.getElementById("chamber").value
            };
        }

        // Validation
        if (!validateForm(formData)) {
            return;
        }

        const submitButton = form.querySelector(".btn-primary");
        const originalButtonText = submitButton.querySelector(".btn-text").textContent;

        // Add loading state
        submitButton.disabled = true;
        submitButton.querySelector(".btn-text").textContent = "Creating Account...";

        try {
            // Prepare the request body
            const requestBody = {
                cid: formData.cid,
                name: formData.name,
                email: formData.email,
                role: formData.role,
                password: formData.password
            };

            // Add doctor profile if creating a doctor
            if (formData.role === 'doctor' && formData.doctorProfile) {
                requestBody.doctorProfile = formData.doctorProfile;
            }

            // API call to create staff account
            const response = await fetch("/api/staff", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${localStorage.getItem("staffToken")}`
                },
                body: JSON.stringify(requestBody),
            });

            const data = await response.json();

            if (response.ok) {
                showMessage("success", `Staff account created successfully for ${formData.name} (${formData.role})`);
                clearForm();
                loadStaffList(); // Refresh the staff list
            } else {
                showMessage("error", data.error || data.message || "Failed to create staff account");
            }
        } catch (error) {
            console.error("Error creating staff account:", error);
            showMessage("error", "Network error. Please try again.");
        } finally {
            // Reset button state
            submitButton.disabled = false;
            submitButton.querySelector(".btn-text").textContent = originalButtonText;
        }
    });
});

// Form validation
function validateForm(formData) {
    const errors = [];

    // Check if all fields are filled
    if (!formData.cid) errors.push("CID number is required");
    if (!formData.name) errors.push("Full name is required");
    if (!formData.email) errors.push("Email is required");
    if (!formData.role) errors.push("Role is required");
    if (!formData.password) errors.push("Password is required");
    if (!formData.confirmPassword) errors.push("Password confirmation is required");

    // Validate CID number (should be numeric and reasonable length)
    if (formData.cid && !/^\d+$/.test(formData.cid)) {
        errors.push("CID number must contain only digits");
    }

    // Validate email format
    if (formData.email && !isValidEmail(formData.email)) {
        errors.push("Please enter a valid email address");
    }

    // Validate password
    if (formData.password && formData.password.length < 6) {
        errors.push("Password must be at least 6 characters long");
    }

    // Check if passwords match
    if (formData.password !== formData.confirmPassword) {
        errors.push("Passwords do not match");
    }

    // Validate doctor-specific fields if role is doctor
    if (formData.role === 'doctor') {
        const doctorProfile = formData.doctorProfile;
        
        if (!doctorProfile.specialization_id) {
            errors.push("Specialization is required for doctors");
        }
        if (!doctorProfile.chamber_id) {
            errors.push("Chamber assignment is required for doctors");
        }
    }

    if (errors.length > 0) {
        showMessage("error", errors.join("<br>"));
        return false;
    }

    return true;
}

// Email validation
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

// Show message
function showMessage(type, message) {
    const messageContainer = document.getElementById("messageContainer");
    const messageClass = type === "success" ? "message-success" : "message-error";
    
    messageContainer.innerHTML = `
        <div class="message ${messageClass}">
            <div class="message-icon">
                ${type === "success" 
                    ? '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M9 12L11 14L15 10M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
                    : '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 8V12M12 16H12.01M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
                }
            </div>
            <div class="message-content">
                ${message}
            </div>
            <button class="message-close" onclick="this.parentElement.remove()">
                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            </button>
        </div>
    `;

    // Auto-hide success messages after 5 seconds
    if (type === "success") {
        setTimeout(() => {
            const message = messageContainer.querySelector(".message");
            if (message) {
                message.remove();
            }
        }, 5000);
    }
}

// Clear form
function clearForm() {
    const form = document.getElementById("adminRegisterForm");
    form.reset();
    
    // Clear any existing messages
    const messageContainer = document.getElementById("messageContainer");
    messageContainer.innerHTML = "";
}

// Load staff list
async function loadStaffList() {
    const staffListContainer = document.getElementById("staffList");
    
    try {
        const response = await fetch("/api/staff", {
            headers: {
                "Authorization": `Bearer ${localStorage.getItem("staffToken")}`
            }
        });

        if (response.ok) {
            const staff = await response.json();
            displayStaffList(staff);
        } else {
            staffListContainer.innerHTML = `
                <div class="error-message">
                    Failed to load staff list. Please try refreshing.
                </div>
            `;
        }
    } catch (error) {
        console.error("Error loading staff list:", error);
        staffListContainer.innerHTML = `
            <div class="error-message">
                Network error. Please check your connection.
            </div>
        `;
    }
}

// Display staff list
function displayStaffList(staff) {
    const staffListContainer = document.getElementById("staffList");
    
    if (!staff || staff.length === 0) {
        staffListContainer.innerHTML = `
            <div class="empty-state">
                <svg class="empty-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M20 21V19C20 17.9391 19.5786 16.9217 18.8284 16.1716C18.0783 15.4214 17.0609 15 16 15H8C6.93913 15 5.92172 15.4214 5.17157 16.1716C4.42143 16.9217 4 17.9391 4 19V21M16 7C16 9.20914 14.2091 11 12 11C9.79086 11 8 9.20914 8 7C8 4.79086 9.79086 3 12 3C14.2091 3 16 4.79086 16 7Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                <p>No staff members found</p>
            </div>
        `;
        return;
    }

    const staffTable = `
        <div class="staff-table-container">
            <table class="staff-table">
                <thead>
                    <tr>
                        <th>CID Number</th>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Role</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    ${staff.map(member => `
                        <tr class="staff-row">
                            <td class="staff-cid">${member.cid}</td>
                            <td class="staff-name">${member.name}</td>
                            <td class="staff-email">${member.email}</td>
                            <td class="staff-role">
                                <span class="role-badge role-${member.role}">
                                    ${member.role.charAt(0).toUpperCase() + member.role.slice(1)}
                                </span>
                            </td>
                            <td class="staff-status">
                                <span class="status-badge status-active">
                                    Active
                                </span>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;

    staffListContainer.innerHTML = staffTable;
}

// Check admin authentication
function checkAdminAuth() {
    const staffRole = localStorage.getItem("staffRole");
    const staffToken = localStorage.getItem("staffToken");
    
    if (!staffToken || staffRole !== "admin") {
        window.location.href = "/staff-portal";
        return false;
    }
    
    return true;
}

// Initialize page
document.addEventListener("DOMContentLoaded", () => {
    // Check if user is admin
    if (!checkAdminAuth()) {
        return;
    }
});
