// Chambers Management JavaScript
let currentChambers = [];
let editingId = null;

// Check authentication and admin role on page load
document.addEventListener('DOMContentLoaded', function() {
    checkAuthentication();
    setupFormListeners();
});

function checkAuthentication() {
    const token = localStorage.getItem('staffToken');
    const role = localStorage.getItem('staffRole');

    if (!token) {
        window.location.href = '/staff';
        return;
    }

    if (role !== 'admin') {
        document.getElementById('errorMessage').style.display = 'block';
        document.getElementById('mainContent').style.display = 'none';
        return;
    }

    document.getElementById('errorMessage').style.display = 'none';
    document.getElementById('mainContent').style.display = 'block';
    loadChambers();
}

function goToDashboard() {
    window.location.href = '/staff-dashboard';
}

function setupFormListeners() {
    const form = document.getElementById('chamberForm');
    form.addEventListener('submit', handleFormSubmit);
}

function getAuthHeaders() {
    const token = localStorage.getItem('staffToken');
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    };
}

async function loadChambers() {
    try {
        document.getElementById('loadingMessage').style.display = 'block';
        document.getElementById('tableContainer').style.display = 'none';

        const response = await fetch('/api/doctor/chambers', {
            headers: getAuthHeaders()
        });

        if (!response.ok) {
            throw new Error('Failed to load chambers');
        }

        const chambers = await response.json();
        currentChambers = chambers;
        displayChambers(chambers);

        document.getElementById('loadingMessage').style.display = 'none';
        document.getElementById('tableContainer').style.display = 'block';

    } catch (error) {
        console.error('Error loading chambers:', error);
        showAlert('Error loading chambers: ' + error.message, 'error');
        document.getElementById('loadingMessage').style.display = 'none';
    }
}

function displayChambers(chambers) {
    const tbody = document.getElementById('chambersTableBody');
    tbody.innerHTML = '';

    if (chambers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: #666;">No chambers found</td></tr>';
        return;
    }

    chambers.forEach(chamber => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${chamber.id}</td>
            <td>${chamber.chamber_number}</td>
            <td>${chamber.floor || '-'}</td>
            <td>${chamber.building || '-'}</td>
            <td>${chamber.capacity || 1}</td>
            <td>
                <span class="status-badge ${chamber.is_active ? 'status-active' : 'status-inactive'}">
                    ${chamber.is_active ? 'Active' : 'Inactive'}
                </span>
            </td>
            <td class="actions">
                <button class="btn btn-sm btn-edit" onclick="editChamber(${chamber.id})">Edit</button>
                <button class="btn btn-sm btn-delete" onclick="deleteChamber(${chamber.id}, '${chamber.chamber_number}')">Delete</button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

async function handleFormSubmit(event) {
    event.preventDefault();

    const formData = new FormData(event.target);
    const data = {
        chamber_number: formData.get('chamber_number').trim(),
        floor: formData.get('floor').trim() || null,
        building: formData.get('building').trim() || null,
        capacity: parseInt(formData.get('capacity')) || 1,
        is_active: formData.get('is_active') === 'true'
    };

    if (!data.chamber_number) {
        showAlert('Chamber number is required', 'error');
        return;
    }

    if (data.capacity < 1 || data.capacity > 50) {
        showAlert('Capacity must be between 1 and 50', 'error');
        return;
    }

    try {
        let response;
        const chamberId = document.getElementById('chamberId').value;

        if (chamberId) {
            // Update existing chamber
            response = await fetch(`/api/doctor/chambers/${chamberId}`, {
                method: 'PUT',
                headers: getAuthHeaders(),
                body: JSON.stringify(data)
            });
        } else {
            // Create new chamber
            response = await fetch('/api/doctor/chambers', {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify(data)
            });
        }

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to save chamber');
        }

        const savedChamber = await response.json();
        showAlert(chamberId ? 'Chamber updated successfully!' : 'Chamber added successfully!', 'success');
        resetForm();
        loadChambers();

    } catch (error) {
        console.error('Error saving chamber:', error);
        showAlert('Error: ' + error.message, 'error');
    }
}

function editChamber(id) {
    const chamber = currentChambers.find(c => c.id === id);
    if (!chamber) return;

    editingId = id;
    document.getElementById('chamberId').value = id;
    document.getElementById('chamber_number').value = chamber.chamber_number;
    document.getElementById('floor').value = chamber.floor || '';
    document.getElementById('building').value = chamber.building || '';
    document.getElementById('capacity').value = chamber.capacity || 1;
    document.getElementById('is_active').value = chamber.is_active ? 'true' : 'false';
    
    document.getElementById('formTitle').textContent = 'Update Chamber';
    document.getElementById('submitBtn').textContent = 'Update Chamber';
    document.getElementById('cancelBtn').style.display = 'inline-block';

    // Scroll to form
    document.querySelector('.form-section').scrollIntoView({ behavior: 'smooth' });
}

function resetForm() {
    document.getElementById('chamberForm').reset();
    document.getElementById('chamberId').value = '';
    editingId = null;
    
    document.getElementById('formTitle').textContent = 'Add New Chamber';
    document.getElementById('submitBtn').textContent = 'Add Chamber';
    document.getElementById('cancelBtn').style.display = 'none';
}

async function deleteChamber(id, chamberNumber) {
    if (!confirm(`Are you sure you want to delete chamber "${chamberNumber}"?`)) {
        return;
    }

    try {
        const response = await fetch(`/api/doctor/chambers/${id}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });

        if (!response.ok) {
            const errorData = await response.json();
            if (response.status === 400 && errorData.error && errorData.error.includes('assigned to doctors')) {
                showAlert(`Cannot delete chamber "${chamberNumber}" because it is currently assigned to doctors. Please reassign doctors to different chambers first.`, 'error');
            } else {
                throw new Error(errorData.error || 'Failed to delete chamber');
            }
            return;
        }

        showAlert('Chamber deleted successfully!', 'success');
        loadChambers();

    } catch (error) {
        console.error('Error deleting chamber:', error);
        showAlert('Error: ' + error.message, 'error');
    }
}

function showAlert(message, type) {
    const alertContainer = document.getElementById('alertContainer');
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type}`;
    alertDiv.textContent = message;
    
    alertContainer.innerHTML = '';
    alertContainer.appendChild(alertDiv);

    // Auto-hide after 5 seconds
    setTimeout(() => {
        if (alertDiv.parentNode) {
            alertDiv.parentNode.removeChild(alertDiv);
        }
    }, 5000);

    // Scroll to top to show alert
    window.scrollTo({ top: 0, behavior: 'smooth' });
}
