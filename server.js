/**
 * Clinic Appointment, Patient & Emergency Management System
 * ------------------------------------------------------------
 * Pure Node.js (no npm install required) — uses only built-in modules.
 * Data is stored in a local JSON file (data/db.json), created & seeded
 * automatically on first run.
 *
 * Run:   node server.js
 * Open:  http://localhost:3000
 *
 * NOTE: This system is for administrative / coordination purposes only.
 * It does not provide medical diagnosis, treatment advice, or medical
 * decision-making of any kind.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, 'data', 'db.json');
const PUBLIC_DIR = path.join(__dirname, 'public');

// ---------------------------------------------------------------------
// Simple JSON "database"
// ---------------------------------------------------------------------

function seedData() {
  return {
    patients: [
      { id: genId(), name: 'Asha Patil', age: 34, gender: 'Female', phone: '9876500001', address: 'FC Road, Pune', bloodGroup: 'B+', createdAt: nowISO() },
      { id: genId(), name: 'Ravi Kumar', age: 45, gender: 'Male', phone: '9876500002', address: 'Kothrud, Pune', bloodGroup: 'O+', createdAt: nowISO() }
    ],
    appointments: [],
    ambulanceRequests: [],
    bloodRequests: [],
    facilities: [
      { id: genId(), name: 'City Care Hospital', type: 'Hospital', location: 'Shivajinagar, Pune', phone: '02012345001' },
      { id: genId(), name: 'Sunrise Multispeciality Clinic', type: 'Clinic', location: 'Kothrud, Pune', phone: '02012345002' },
      { id: genId(), name: 'LifeLine Blood Bank', type: 'Blood Bank', location: 'FC Road, Pune', phone: '02012345003' },
      { id: genId(), name: 'Hope Community Hospital', type: 'Hospital', location: 'Hadapsar, Pune', phone: '02012345004' },
      { id: genId(), name: 'Red Cross Blood Bank', type: 'Blood Bank', location: 'Camp, Pune', phone: '02012345005' },
      { id: genId(), name: 'Metro Ambulance Service', type: 'Ambulance', location: 'Deccan, Pune', phone: '02012345006' }
    ]
  };
}

function genId() {
  return crypto.randomBytes(6).toString('hex');
}

function nowISO() {
  return new Date().toISOString();
}

function loadDB() {
  if (!fs.existsSync(DB_PATH)) {
    const seeded = seedData();
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    fs.writeFileSync(DB_PATH, JSON.stringify(seeded, null, 2));
    return seeded;
  }
  try {
    return JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
  } catch (e) {
    console.error('Failed to parse db.json, reseeding.', e);
    const seeded = seedData();
    fs.writeFileSync(DB_PATH, JSON.stringify(seeded, null, 2));
    return seeded;
  }
}

function saveDB(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

let db = loadDB();

// ---------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------

function sendJSON(res, statusCode, data) {
  const body = JSON.stringify(data);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
    'Access-Control-Allow-Origin': '*'
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let chunks = '';
    req.on('data', (c) => (chunks += c));
    req.on('end', () => {
      if (!chunks) return resolve({});
      try {
        resolve(JSON.parse(chunks));
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

const MIME = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.svg': 'image/svg+xml'
};

function serveStatic(req, res, pathname) {
  let filePath = pathname === '/' ? '/index.html' : pathname;
  filePath = path.join(PUBLIC_DIR, filePath);

  // Prevent path traversal
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end('Not found');
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(content);
  });
}

// ---------------------------------------------------------------------
// Route handlers
// ---------------------------------------------------------------------

function matchRoute(method, pathname) {
  // /api/patients/:id  ->  { collection: 'patients', id: '...' }
  const parts = pathname.split('/').filter(Boolean); // ['api','patients', ':id']
  if (parts[0] !== 'api') return null;
  const collection = parts[1];
  const id = parts[2] || null;
  return { collection, id };
}

async function handleAPI(req, res, parsedUrl) {
  const { collection, id } = matchRoute(req.method, parsedUrl.pathname) || {};
  const query = parsedUrl.query;

  try {
    // -------------------- DASHBOARD --------------------
    if (collection === 'dashboard') {
      const today = new Date().toISOString().slice(0, 10);
      const stats = {
        totalPatients: db.patients.length,
        todaysAppointments: db.appointments.filter(a => a.date === today).length,
        upcomingAppointments: db.appointments.filter(a => a.status === 'scheduled').length,
        pendingAmbulanceRequests: db.ambulanceRequests.filter(r => r.status === 'pending').length,
        activeBloodRequests: db.bloodRequests.filter(r => r.type === 'need').length
      };
      return sendJSON(res, 200, stats);
    }

    // -------------------- PATIENTS --------------------
    if (collection === 'patients') {
      if (req.method === 'GET' && !id) {
        let results = db.patients;
        if (query.q) {
          const q = query.q.toLowerCase();
          results = results.filter(p =>
            p.name.toLowerCase().includes(q) || (p.phone || '').includes(q)
          );
        }
        return sendJSON(res, 200, results);
      }
      if (req.method === 'GET' && id) {
        const p = db.patients.find(p => p.id === id);
        return p ? sendJSON(res, 200, p) : sendJSON(res, 404, { error: 'Patient not found' });
      }
      if (req.method === 'POST') {
        const body = await readBody(req);
        if (!body.name || !body.phone) {
          return sendJSON(res, 400, { error: 'name and phone are required' });
        }
        const patient = {
          id: genId(),
          name: body.name,
          age: body.age || null,
          gender: body.gender || '',
          phone: body.phone,
          address: body.address || '',
          bloodGroup: body.bloodGroup || '',
          createdAt: nowISO()
        };
        db.patients.push(patient);
        saveDB(db);
        return sendJSON(res, 201, patient);
      }
      if (req.method === 'DELETE' && id) {
        db.patients = db.patients.filter(p => p.id !== id);
        saveDB(db);
        return sendJSON(res, 200, { success: true });
      }
    }

    // -------------------- APPOINTMENTS --------------------
    if (collection === 'appointments') {
      if (req.method === 'GET' && !id) {
        let results = db.appointments;
        if (query.status) results = results.filter(a => a.status === query.status);
        // attach patient name for display convenience
        results = results.map(a => ({
          ...a,
          patientName: (db.patients.find(p => p.id === a.patientId) || {}).name || 'Unknown'
        }));
        results.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
        return sendJSON(res, 200, results);
      }
      if (req.method === 'POST') {
        const body = await readBody(req);
        if (!body.patientId || !body.date || !body.time) {
          return sendJSON(res, 400, { error: 'patientId, date and time are required' });
        }
        const appt = {
          id: genId(),
          patientId: body.patientId,
          date: body.date,
          time: body.time,
          reason: body.reason || '',
          status: 'scheduled',
          notes: body.notes || '',
          createdAt: nowISO()
        };
        db.appointments.push(appt);
        saveDB(db);
        return sendJSON(res, 201, appt);
      }
      if (req.method === 'PATCH' && id) {
        const body = await readBody(req);
        const appt = db.appointments.find(a => a.id === id);
        if (!appt) return sendJSON(res, 404, { error: 'Appointment not found' });
        if (body.status) appt.status = body.status;
        if (body.notes !== undefined) appt.notes = body.notes;
        if (body.date) appt.date = body.date;
        if (body.time) appt.time = body.time;
        saveDB(db);
        return sendJSON(res, 200, appt);
      }
      if (req.method === 'DELETE' && id) {
        db.appointments = db.appointments.filter(a => a.id !== id);
        saveDB(db);
        return sendJSON(res, 200, { success: true });
      }
    }

    // -------------------- AMBULANCE REQUESTS --------------------
    if (collection === 'ambulance') {
      if (req.method === 'GET' && !id) {
        let results = db.ambulanceRequests;
        if (query.status) results = results.filter(r => r.status === query.status);
        results.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        return sendJSON(res, 200, results);
      }
      if (req.method === 'POST') {
        const body = await readBody(req);
        if (!body.requesterName || !body.phone || !body.location) {
          return sendJSON(res, 400, { error: 'requesterName, phone and location are required' });
        }
        const reqst = {
          id: genId(),
          requesterName: body.requesterName,
          phone: body.phone,
          location: body.location,
          notes: body.notes || '',
          status: 'pending',
          createdAt: nowISO()
        };
        db.ambulanceRequests.push(reqst);
        saveDB(db);
        return sendJSON(res, 201, reqst);
      }
      if (req.method === 'PATCH' && id) {
        const body = await readBody(req);
        const r = db.ambulanceRequests.find(r => r.id === id);
        if (!r) return sendJSON(res, 404, { error: 'Request not found' });
        if (body.status) r.status = body.status;
        saveDB(db);
        return sendJSON(res, 200, r);
      }
    }

    // -------------------- BLOOD REQUESTS / DONORS --------------------
    if (collection === 'blood') {
      if (req.method === 'GET' && !id) {
        let results = db.bloodRequests;
        if (query.group) results = results.filter(r => r.bloodGroup === query.group);
        if (query.location) {
          const loc = query.location.toLowerCase();
          results = results.filter(r => r.location.toLowerCase().includes(loc));
        }
        if (query.type) results = results.filter(r => r.type === query.type);
        results.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        return sendJSON(res, 200, results);
      }
      if (req.method === 'POST') {
        const body = await readBody(req);
        if (!body.bloodGroup || !body.location || !body.contactName || !body.phone || !body.type) {
          return sendJSON(res, 400, { error: 'type, bloodGroup, location, contactName and phone are required' });
        }
        const entry = {
          id: genId(),
          type: body.type, // 'need' or 'have'
          bloodGroup: body.bloodGroup,
          location: body.location,
          contactName: body.contactName,
          phone: body.phone,
          notes: body.notes || '',
          status: 'active',
          createdAt: nowISO()
        };
        db.bloodRequests.push(entry);
        saveDB(db);
        return sendJSON(res, 201, entry);
      }
      if (req.method === 'PATCH' && id) {
        const body = await readBody(req);
        const r = db.bloodRequests.find(r => r.id === id);
        if (!r) return sendJSON(res, 404, { error: 'Entry not found' });
        if (body.status) r.status = body.status;
        saveDB(db);
        return sendJSON(res, 200, r);
      }
    }

    // -------------------- FACILITIES (hospitals/clinics/blood banks) --------------------
    if (collection === 'facilities') {
      if (req.method === 'GET' && !id) {
        let results = db.facilities;
        if (query.type) results = results.filter(f => f.type === query.type);
        if (query.location) {
          const loc = query.location.toLowerCase();
          results = results.filter(f => f.location.toLowerCase().includes(loc));
        }
        return sendJSON(res, 200, results);
      }
      if (req.method === 'POST') {
        const body = await readBody(req);
        if (!body.name || !body.type || !body.location) {
          return sendJSON(res, 400, { error: 'name, type and location are required' });
        }
        const f = {
          id: genId(),
          name: body.name,
          type: body.type,
          location: body.location,
          phone: body.phone || ''
        };
        db.facilities.push(f);
        saveDB(db);
        return sendJSON(res, 201, f);
      }
    }

    return sendJSON(res, 404, { error: 'Unknown API route' });
  } catch (err) {
    console.error(err);
    return sendJSON(res, 500, { error: 'Server error', detail: String(err.message || err) });
  }
}

// ---------------------------------------------------------------------
// HTTP server
// ---------------------------------------------------------------------

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    return res.end();
  }

  if (parsedUrl.pathname.startsWith('/api/')) {
    return handleAPI(req, res, parsedUrl);
  }

  return serveStatic(req, res, parsedUrl.pathname);
});

server.listen(PORT, () => {
  console.log(`\nClinic Management System running at http://localhost:${PORT}\n`);
  console.log(`Data file: ${DB_PATH}\n`);
});
