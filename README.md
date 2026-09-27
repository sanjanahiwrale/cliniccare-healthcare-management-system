# cliniccare-healthcare-management-system
A software-based healthcare management system for managing patient information, clinic appointments, ambulance requests, and blood-related requirements in one centralized platform.

Website is now live at : https://cliniccare-93q7.onrender.com/
# Sahayak — Clinic Appointment, Patient & Emergency Management System

A lightweight, single-clinic coordination tool covering patient registration,
appointment scheduling, ambulance requests, blood-requirement search/reporting,
and a directory of nearby hospitals/clinics/blood banks.

**Scope note:** This system is administrative and coordination-focused only.
It does **not** provide medical diagnosis, treatment recommendations, or any
clinical decision-making.

## Requirements

- [Node.js](https://nodejs.org) v14 or later (no other software needed)
- No `npm install` required — the app uses only Node's built-in modules and a
  local JSON file as its data store, so it runs immediately.

## Running it

```bash
node server.js
```

Then open **http://localhost:3000** in your browser.

To use a different port:

```bash
PORT=4000 node server.js
```

## What's included

| Area | Features |
|---|---|
| Dashboard | Live counts: patients, today's/upcoming appointments, pending ambulance requests, active blood needs; quick-glance lists |
| Patients | Register patients, search by name/phone, view directory |
| Appointments | Book appointments against a patient, filter by status, update status (scheduled / completed / cancelled) |
| Ambulance | Submit a pickup request, track and update status (pending / dispatched / completed) |
| Blood | Report a need or an availability by blood group, search/filter by group and location |
| Facilities | Browse a seeded directory of hospitals, clinics, blood banks and ambulance services; filter by type/location |

## Data storage

All data lives in `data/db.json`, created automatically on first run and
seeded with a couple of sample patients and facilities so the screens aren't
empty. Delete that file at any time to reset the system to a fresh seeded
state.

This is intentionally file-based rather than a real database, to keep the
project dependency-free and instantly runnable for a hackathon demo. For
production use, swap `data/db.json` persistence in `server.js` for a real
database (SQLite/Postgres/etc.) — the API route handlers are already
structured so that change is isolated to `loadDB()` / `saveDB()`.

## Project structure

```
clinic-system/
├── server.js           # HTTP server + all API routes (pure Node.js, no deps)
├── package.json
├── data/
│   └── db.json          # auto-created data store (JSON)
└── public/
    ├── index.html        # single-page app shell (all views)
    ├── css/style.css
    └── js/app.js          # frontend logic: fetch calls + rendering
```

## API reference (for extending it)

All endpoints are under `/api` and return JSON.

- `GET  /api/dashboard` — summary stats
- `GET/POST/DELETE /api/patients` (`GET /api/patients?q=search`)
- `GET/POST/PATCH/DELETE /api/appointments` (`GET ?status=scheduled|completed|cancelled`)
- `GET/POST/PATCH /api/ambulance` (`GET ?status=pending|dispatched|completed`)
- `GET/POST/PATCH /api/blood` (`GET ?group=O+&location=Pune&type=need|have`)
- `GET/POST /api/facilities` (`GET ?type=Hospital|Clinic|Blood+Bank|Ambulance&location=`)

## Ideas for extending within remaining time

- Follow-up reminder emails/SMS (would need a real messaging provider)
- Basic charts on the dashboard (appointments per day, request volume)
- Role-based login for staff vs. public-facing request submission
- Swap JSON file storage for SQLite if concurrent multi-user writes matter
