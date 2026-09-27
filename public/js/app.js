const API = '/api';

// ---------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------

async function api(path, options = {}) {
  const res = await fetch(API + path, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove('show'), 2600);
}

function el(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstChild;
}

function escapeHTML(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function fmtDate(d) {
  if (!d) return '';
  const dt = new Date(d + 'T00:00:00');
  return dt.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}

// ---------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------

const views = ['dashboard', 'patients', 'appointments', 'ambulance', 'blood', 'facilities'];

document.querySelectorAll('.nav-item').forEach((btn) => {
  btn.addEventListener('click', () => switchView(btn.dataset.view));
});

function switchView(name) {
  views.forEach((v) => {
    document.getElementById('view-' + v).classList.toggle('active', v === name);
  });
  document.querySelectorAll('.nav-item').forEach((b) => {
    b.classList.toggle('active', b.dataset.view === name);
  });
  loadView(name);
}

function loadView(name) {
  if (name === 'dashboard') loadDashboard();
  if (name === 'patients') { loadPatients(); loadPatientSelect(); }
  if (name === 'appointments') { loadAppointments(); loadPatientSelect(); }
  if (name === 'ambulance') loadAmbulance();
  if (name === 'blood') loadBlood();
  if (name === 'facilities') loadFacilities();
}

// ---------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------

async function loadDashboard() {
  const stats = await api('/dashboard');
  const grid = document.getElementById('statGrid');
  grid.innerHTML = '';
  const cards = [
    { label: 'Total patients', num: stats.totalPatients },
    { label: "Today's appointments", num: stats.todaysAppointments },
    { label: 'Upcoming appointments', num: stats.upcomingAppointments },
    { label: 'Pending ambulance requests', num: stats.pendingAmbulanceRequests, alert: stats.pendingAmbulanceRequests > 0 },
    { label: 'Active blood needs', num: stats.activeBloodRequests, alert: stats.activeBloodRequests > 0 }
  ];
  cards.forEach((c) => {
    grid.appendChild(el(`
      <div class="stat-card ${c.alert ? 'alert' : ''}">
        <div class="num">${c.num}</div>
        <div class="label">${c.label}</div>
      </div>
    `));
  });

  const appts = (await api('/appointments?status=scheduled')).slice(0, 6);
  const upcomingEl = document.getElementById('dashUpcoming');
  upcomingEl.innerHTML = appts.length ? '' : '<div class="empty-row">No upcoming appointments.</div>';
  appts.forEach((a) => {
    upcomingEl.appendChild(el(`
      <div class="mini-row">
        <span>${escapeHTML(a.patientName)}${a.reason ? ' — ' + escapeHTML(a.reason) : ''}</span>
        <span class="meta">${fmtDate(a.date)}, ${escapeHTML(a.time)}</span>
      </div>
    `));
  });

  const ambulance = (await api('/ambulance?status=pending')).slice(0, 6);
  const ambulanceEl = document.getElementById('dashAmbulance');
  ambulanceEl.innerHTML = ambulance.length ? '' : '<div class="empty-row">No pending requests.</div>';
  ambulance.forEach((r) => {
    ambulanceEl.appendChild(el(`
      <div class="mini-row">
        <span>${escapeHTML(r.requesterName)} — ${escapeHTML(r.location)}</span>
        <span class="meta">${escapeHTML(r.phone)}</span>
      </div>
    `));
  });
}

// ---------------------------------------------------------------------
// Patients
// ---------------------------------------------------------------------

document.getElementById('patientForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  const body = Object.fromEntries(new FormData(form).entries());
  try {
    await api('/patients', { method: 'POST', body: JSON.stringify(body) });
    toast('Patient registered.');
    form.reset();
    loadPatients();
    loadPatientSelect();
  } catch (err) {
    toast(err.message);
  }
});

document.getElementById('patientSearch').addEventListener('input', (e) => {
  loadPatients(e.target.value);
});

async function loadPatients(q = '') {
  const patients = await api('/patients' + (q ? '?q=' + encodeURIComponent(q) : ''));
  const container = document.getElementById('patientTable');
  if (!patients.length) {
    container.innerHTML = '<div class="empty-row">No patients found.</div>';
    return;
  }
  const rows = patients.map((p) => `
    <tr>
      <td>${escapeHTML(p.name)}</td>
      <td>${escapeHTML(p.phone)}</td>
      <td>${p.age ?? '—'}</td>
      <td>${escapeHTML(p.gender || '—')}</td>
      <td>${escapeHTML(p.bloodGroup || '—')}</td>
      <td>${escapeHTML(p.address || '—')}</td>
    </tr>
  `).join('');
  container.innerHTML = `
    <table>
      <thead><tr><th>Name</th><th>Phone</th><th>Age</th><th>Gender</th><th>Blood group</th><th>Address</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}

async function loadPatientSelect() {
  const patients = await api('/patients');
  const select = document.getElementById('apptPatientSelect');
  const current = select.value;
  select.innerHTML = '<option value="">Select a patient</option>' +
    patients.map((p) => `<option value="${p.id}">${escapeHTML(p.name)} — ${escapeHTML(p.phone)}</option>`).join('');
  if (current) select.value = current;
}

// ---------------------------------------------------------------------
// Appointments
// ---------------------------------------------------------------------

document.getElementById('appointmentForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  const body = Object.fromEntries(new FormData(form).entries());
  if (!body.patientId) { toast('Please select a patient.'); return; }
  try {
    await api('/appointments', { method: 'POST', body: JSON.stringify(body) });
    toast('Appointment booked.');
    form.reset();
    loadAppointments();
  } catch (err) {
    toast(err.message);
  }
});

let apptStatusFilter = '';
document.querySelectorAll('#apptFilters .chip').forEach((chip) => {
  chip.addEventListener('click', () => {
    document.querySelectorAll('#apptFilters .chip').forEach((c) => c.classList.remove('active'));
    chip.classList.add('active');
    apptStatusFilter = chip.dataset.status;
    loadAppointments();
  });
});

async function loadAppointments() {
  const appts = await api('/appointments' + (apptStatusFilter ? '?status=' + apptStatusFilter : ''));
  const container = document.getElementById('appointmentTable');
  if (!appts.length) {
    container.innerHTML = '<div class="empty-row">No appointments found.</div>';
    return;
  }
  const rows = appts.map((a) => `
    <tr>
      <td>${escapeHTML(a.patientName)}</td>
      <td>${fmtDate(a.date)}</td>
      <td>${escapeHTML(a.time)}</td>
      <td>${escapeHTML(a.reason || '—')}</td>
      <td><span class="badge badge-${a.status}">${a.status}</span></td>
      <td>
        <select class="status-select" data-id="${a.id}">
          <option value="scheduled" ${a.status === 'scheduled' ? 'selected' : ''}>Scheduled</option>
          <option value="completed" ${a.status === 'completed' ? 'selected' : ''}>Completed</option>
          <option value="cancelled" ${a.status === 'cancelled' ? 'selected' : ''}>Cancelled</option>
        </select>
      </td>
    </tr>
  `).join('');
  container.innerHTML = `
    <table>
      <thead><tr><th>Patient</th><th>Date</th><th>Time</th><th>Reason</th><th>Status</th><th>Update</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;

  container.querySelectorAll('.status-select').forEach((sel) => {
    sel.addEventListener('change', async () => {
      try {
        await api('/appointments/' + sel.dataset.id, { method: 'PATCH', body: JSON.stringify({ status: sel.value }) });
        toast('Appointment updated.');
        loadAppointments();
      } catch (err) {
        toast(err.message);
      }
    });
  });
}

// ---------------------------------------------------------------------
// Ambulance
// ---------------------------------------------------------------------

document.getElementById('ambulanceForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  const body = Object.fromEntries(new FormData(form).entries());
  try {
    await api('/ambulance', { method: 'POST', body: JSON.stringify(body) });
    toast('Ambulance request submitted.');
    form.reset();
    loadAmbulance();
  } catch (err) {
    toast(err.message);
  }
});

async function loadAmbulance() {
  const requests = await api('/ambulance');
  const container = document.getElementById('ambulanceTable');
  if (!requests.length) {
    container.innerHTML = '<div class="empty-row">No ambulance requests yet.</div>';
    return;
  }
  const rows = requests.map((r) => `
    <tr>
      <td>${escapeHTML(r.requesterName)}</td>
      <td>${escapeHTML(r.phone)}</td>
      <td>${escapeHTML(r.location)}</td>
      <td>${escapeHTML(r.notes || '—')}</td>
      <td><span class="badge badge-${r.status}">${r.status}</span></td>
      <td>
        <select class="status-select" data-id="${r.id}">
          <option value="pending" ${r.status === 'pending' ? 'selected' : ''}>Pending</option>
          <option value="dispatched" ${r.status === 'dispatched' ? 'selected' : ''}>Dispatched</option>
          <option value="completed" ${r.status === 'completed' ? 'selected' : ''}>Completed</option>
        </select>
      </td>
    </tr>
  `).join('');
  container.innerHTML = `
    <table>
      <thead><tr><th>Requester</th><th>Phone</th><th>Location</th><th>Notes</th><th>Status</th><th>Update</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;

  container.querySelectorAll('.status-select').forEach((sel) => {
    sel.addEventListener('change', async () => {
      try {
        await api('/ambulance/' + sel.dataset.id, { method: 'PATCH', body: JSON.stringify({ status: sel.value }) });
        toast('Request updated.');
        loadAmbulance();
        loadDashboard();
      } catch (err) {
        toast(err.message);
      }
    });
  });
}

// ---------------------------------------------------------------------
// Blood
// ---------------------------------------------------------------------

document.getElementById('bloodForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  const body = Object.fromEntries(new FormData(form).entries());
  try {
    await api('/blood', { method: 'POST', body: JSON.stringify(body) });
    toast('Report submitted.');
    form.reset();
    loadBlood();
  } catch (err) {
    toast(err.message);
  }
});

document.getElementById('bloodGroupFilter').addEventListener('change', loadBlood);
document.getElementById('bloodLocationFilter').addEventListener('input', debounce(loadBlood, 300));

function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

async function loadBlood() {
  const group = document.getElementById('bloodGroupFilter').value;
  const location = document.getElementById('bloodLocationFilter').value;
  const params = new URLSearchParams();
  if (group) params.set('group', group);
  if (location) params.set('location', location);
  const entries = await api('/blood?' + params.toString());
  const container = document.getElementById('bloodTable');
  if (!entries.length) {
    container.innerHTML = '<div class="empty-row">No matching reports.</div>';
    return;
  }
  const rows = entries.map((r) => `
    <tr>
      <td><span class="badge badge-${r.type}">${r.type === 'need' ? 'Needed' : 'Available'}</span></td>
      <td>${escapeHTML(r.bloodGroup)}</td>
      <td>${escapeHTML(r.contactName)}</td>
      <td>${escapeHTML(r.phone)}</td>
      <td>${escapeHTML(r.location)}</td>
      <td>${escapeHTML(r.notes || '—')}</td>
    </tr>
  `).join('');
  container.innerHTML = `
    <table>
      <thead><tr><th>Type</th><th>Group</th><th>Contact</th><th>Phone</th><th>Location</th><th>Notes</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}

// ---------------------------------------------------------------------
// Facilities
// ---------------------------------------------------------------------

document.getElementById('facilityTypeFilter').addEventListener('change', loadFacilities);
document.getElementById('facilityLocationFilter').addEventListener('input', debounce(loadFacilities, 300));

async function loadFacilities() {
  const type = document.getElementById('facilityTypeFilter').value;
  const location = document.getElementById('facilityLocationFilter').value;
  const params = new URLSearchParams();
  if (type) params.set('type', type);
  if (location) params.set('location', location);
  const facilities = await api('/facilities?' + params.toString());
  const container = document.getElementById('facilityCards');
  if (!facilities.length) {
    container.innerHTML = '<div class="empty-row">No facilities found.</div>';
    return;
  }
  container.innerHTML = facilities.map((f) => `
    <div class="facility-card">
      <span class="type-tag">${escapeHTML(f.type)}</span>
      <h3>${escapeHTML(f.name)}</h3>
      <p>${escapeHTML(f.location)}</p>
      <p>${escapeHTML(f.phone || 'No phone on file')}</p>
    </div>
  `).join('');
}

// ---------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------

loadDashboard();
