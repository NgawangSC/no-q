// Doctor Profile Management JavaScript

let currentDoctors = [];
let currentSpecializations = [];
let currentChambers = [];
let editingStaffId = null;

// Run on page load
document.addEventListener('DOMContentLoaded', function () {
  checkAuthentication();
  setupFormListeners();
});

function checkAuthentication() {
  const role = localStorage.getItem('staffRole');

  const errorMessage = document.getElementById('errorMessage');
  const mainContent = document.getElementById('mainContent');

  if (role !== 'admin') {
    if (errorMessage) errorMessage.style.display = 'block';
    if (mainContent) mainContent.style.display = 'none';
    return;
  }

  if (errorMessage) errorMessage.style.display = 'none';
  if (mainContent) mainContent.style.display = 'block';

  loadInitialData();
}

function getAuthHeaders() {
  return {
    'Content-Type': 'application/json',
  };
}

function setupFormListeners() {
  const form = document.getElementById('doctorProfileForm');
  const cancelBtn = document.getElementById('cancelBtn');

  if (form) {
    form.addEventListener('submit', handleFormSubmit);
  }

  if (cancelBtn) {
    cancelBtn.addEventListener('click', resetForm);
  }
}

function showLoading(show) {
  const loading = document.getElementById('loadingMessage');
  const container = document.getElementById('tableContainer');
  if (loading) loading.style.display = show ? 'block' : 'none';
  if (container) container.style.display = show ? 'none' : 'block';
}

async function loadInitialData() {
  try {
    showLoading(true);

    const [doctorsResponse, specResponse, chambersResponse] = await Promise.all([
      fetch('/api/doctor/doctors', { headers: getAuthHeaders(), credentials: 'include' }),
      fetch('/api/doctor/specializations', { headers: getAuthHeaders(), credentials: 'include' }),
      fetch('/api/doctor/chambers', { headers: getAuthHeaders(), credentials: 'include' }),
    ]);

    if (!doctorsResponse.ok || !specResponse.ok || !chambersResponse.ok) {
      throw new Error('Failed to load initial data');
    }

    currentDoctors = await doctorsResponse.json();
    currentSpecializations = await specResponse.json();
    currentChambers = await chambersResponse.json();

    displayDoctors(currentDoctors);
    populateDoctorDropdown(currentDoctors);
    populateSpecializationDropdown(currentSpecializations);
    populateChamberDropdown(currentChambers);

    showLoading(false);
  } catch (error) {
    console.error('Error loading initial data:', error);
    showAlert('Error loading data: ' + error.message, 'error');
    showLoading(false);
  }
}

// Dropdown population

function populateDoctorDropdown(doctors) {
  const select = document.getElementById('doctorSelect');
  if (!select) return;

  select.innerHTML = '<option value="">Choose a doctor...</option>';

  const list = Array.isArray(doctors) ? doctors : [];
  const doctorsWithoutProfiles = list.filter(d => !d.specialization_id);

  doctorsWithoutProfiles.forEach(doctor => {
    const option = document.createElement('option');
    const id = doctor.id || doctor._id;
    option.value = id;
    option.textContent = `${doctor.name || ''} (${doctor.email || ''})`;
    select.appendChild(option);
  });
}

function populateSpecializationDropdown(specializations) {
  const select = document.getElementById('specializationSelect');
  if (!select) return;

  select.innerHTML = '<option value="">Choose a specialization...</option>';

  (Array.isArray(specializations) ? specializations : []).forEach(spec => {
    const option = document.createElement('option');
    option.value = spec.id || spec._id;
    option.textContent = spec.name;
    select.appendChild(option);
  });
}

function populateChamberDropdown(chambers) {
  const select = document.getElementById('chamberSelect');
  if (!select) return;

  select.innerHTML = '<option value="">Choose a chamber...</option>';

  const list = Array.isArray(chambers) ? chambers : [];

  list.forEach(chamber => {
    const option = document.createElement('option');
    const id = chamber.id || chamber._id;
    const number = chamber.chamber_number;
    const floor = chamber.floor;
    const building = chamber.building;
    const extra = `${floor ? ` - ${floor}` : ''}${building ? ` - ${building}` : ''}`;
    option.value = id;
    option.textContent = `${number}${extra}`;
    select.appendChild(option);
  });
}

// Table

function displayDoctors(doctors) {
  const tbody = document.getElementById('doctorsTableBody');
  if (!tbody) return;

  tbody.innerHTML = '';

  if (!Array.isArray(doctors) || doctors.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: #666;">No doctors found</td></tr>';
    return;
  }

  doctors.forEach(doctor => {
    const row = document.createElement('tr');
    const hasProfile = !!doctor.specialization_id;
    const id = doctor.id || doctor._id;
    const safeName = (doctor.name || '').replace(/'/g, '&#39;').replace(/"/g, '&quot;');

    row.innerHTML = `
      <td>
        <div class="doctor-info">
          <div class="doctor-avatar">${(doctor.name || '?').charAt(0).toUpperCase()}</div>
          <div>
            <div>${doctor.name || ''}</div>
            <small style="color: #666;">ID: ${id}</small>
          </div>
        </div>
      </td>
      <td>${doctor.email || ''}</td>
      <td>${doctor.specialization_name || '<span class="no-profile">Not assigned</span>'}</td>
      <td>${doctor.chamber_number ? `${doctor.chamber_number}${doctor.floor ? ` (${doctor.floor})` : ''}` : '<span class="no-profile">Not assigned</span>'}</td>
      <td>
        ${hasProfile ? '<span class="profile-badge">Profile Active</span>' : '<span class="no-profile">No Profile</span>'}
      </td>
      <td class="actions">
        ${hasProfile ? `
          <button class="btn btn-sm btn-edit" onclick="editDoctorProfile('${id}')">Edit</button>
          <button class="btn btn-sm btn-delete" onclick="deleteDoctorProfile('${id}', '${safeName}')">Delete</button>
        ` : '-'}
      </td>
    `;
    tbody.appendChild(row);
  });
}

// Form submit (create + update)

async function handleFormSubmit(event) {
  event.preventDefault();

  const form = event.target;
  const formData = new FormData(form);

  const editingInput = document.getElementById('editingStaffId');
  const doctorSelect = document.getElementById('doctorSelect');

  const editingValue = editingInput ? editingInput.value.trim() : '';
  let staff_id = editingValue || '';

  if (!staff_id && doctorSelect) {
    staff_id = (doctorSelect.value || '').trim();
  }

  const specialization_id = (formData.get('specialization_id') || '').trim();
  const chamber_id = (formData.get('chamber_id') || '').trim();

  if (!staff_id || !specialization_id || !chamber_id) {
    showAlert('Please fill in all required fields', 'error');
    return;
  }

  const isEdit = !!editingValue;
  let data;
  let url;
  let method;

  if (isEdit) {
    // For updates, only send specialization_id and chamber_id
    data = { specialization_id, chamber_id };
    url = `/api/doctor/profile/${staff_id}`;
    method = 'PUT';
  } else {
    // For creates, send staff_id, specialization_id, and chamber_id
    data = { staff_id, specialization_id, chamber_id };
    url = '/api/doctor/profile';
    method = 'POST';
  }

  try {
    const response = await fetch(url, {
      method: method,
      headers: getAuthHeaders(),
      credentials: 'include',
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || errorData.message || 'Failed to save doctor profile');
    }

    await response.json();

    showAlert(isEdit ? 'Doctor profile updated successfully!' : 'Doctor profile created successfully!', 'success');

    resetForm();
    loadInitialData();
  } catch (error) {
    console.error('Error saving doctor profile:', error);
    showAlert('Error: ' + error.message, 'error');
  }
}

// Edit and delete

function editDoctorProfile(staffId) {
  const doctor = currentDoctors.find(d => (d.id || d._id) === staffId);
  if (!doctor) return;

  editingStaffId = staffId;

  const editingInput = document.getElementById('editingStaffId');
  const doctorSelect = document.getElementById('doctorSelect');
  const specializationSelect = document.getElementById('specializationSelect');
  const chamberSelect = document.getElementById('chamberSelect');
  const formTitle = document.getElementById('formTitle');
  const submitBtn = document.getElementById('submitBtn');
  const cancelBtn = document.getElementById('cancelBtn');

  if (editingInput) editingInput.value = staffId;

  // In edit mode we do not use doctorSelect for staff_id
  if (doctorSelect) {
    doctorSelect.value = '';
    doctorSelect.disabled = true;
  }

  if (specializationSelect) {
    specializationSelect.value = doctor.specialization_id || '';
  }

  if (chamberSelect) {
    chamberSelect.value = doctor.chamber_id || '';
  }

  if (formTitle) formTitle.textContent = 'Update Doctor Profile';
  if (submitBtn) submitBtn.textContent = 'Update Profile';
  if (cancelBtn) cancelBtn.style.display = 'inline-block';

  const formSection = document.querySelector('.form-section');
  if (formSection) {
    formSection.scrollIntoView({ behavior: 'smooth' });
  }
}

function resetForm() {
  const form = document.getElementById('doctorProfileForm');
  const editingInput = document.getElementById('editingStaffId');
  const doctorSelect = document.getElementById('doctorSelect');
  const formTitle = document.getElementById('formTitle');
  const submitBtn = document.getElementById('submitBtn');
  const cancelBtn = document.getElementById('cancelBtn');

  if (form) form.reset();
  if (editingInput) editingInput.value = '';
  editingStaffId = null;

  if (doctorSelect) {
    doctorSelect.disabled = false;
    // refresh options
    populateDoctorDropdown(currentDoctors);
  }

  if (formTitle) formTitle.textContent = 'Create Doctor Profile';
  if (submitBtn) submitBtn.textContent = 'Create Profile';
  if (cancelBtn) cancelBtn.style.display = 'none';
}

async function deleteDoctorProfile(staffId, name) {
  // Decode HTML entities for display
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = name;
  const decodedName = tempDiv.textContent || tempDiv.innerText || name;

  const confirmed = confirm(
    `Are you sure you want to PERMANENTLY DELETE doctor "${decodedName}"?\n\n` +
    `This will:\n` +
    `- Delete the doctor profile\n` +
    `- Permanently delete the doctor account\n\n` +
    `This action cannot be undone!`
  );

  if (!confirmed) {
    return;
  }

  try {
    // Permanently delete doctor (profile + staff record)
    const response = await fetch(`/api/doctor/delete/${staffId}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
      credentials: 'include',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || errorData.message || 'Failed to delete doctor');
    }

    showAlert(`Doctor "${decodedName}" has been permanently deleted!`, 'success');
    resetForm();
    loadInitialData();
  } catch (error) {
    console.error('Error deleting doctor:', error);
    showAlert('Error: ' + error.message, 'error');
  }
}

// Alerts

function showAlert(message, type) {
  // Use toast if available, otherwise fallback to alert container
  if (window.NoQ && window.NoQ.toast) {
    const toastType = type === 'error' ? 'error' : 'success';
    window.NoQ.toast(message, toastType);
  } else {
    const container = document.getElementById('alertContainer');
    if (!container) return;

    const div = document.createElement('div');
    div.className = `alert alert-${type}`;
    div.textContent = message;

    container.innerHTML = '';
    container.appendChild(div);

    setTimeout(() => {
      if (div.parentNode) div.parentNode.removeChild(div);
    }, 5000);

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}
