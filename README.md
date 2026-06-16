# File-View — File Share Access Management System

A web application for tracking **which people have access to which file shares**.
It provides a summary of all users, all file shares, an admin back-office for
creating users / servers / sub file shares, CSV import, reporting, and an
**admin-only** sign-in on the front page.

> ระบบบริหารจัดการไฟล์แชร์ — จัดเก็บว่าแต่ละบุคคลมีสิทธิเข้าถึงไฟล์แชร์ใดบ้าง
> มีหน้าสรุป user/ไฟล์แชร์ทั้งหมด ระบบหลังบ้านสำหรับเพิ่ม user / server / sub file share,
> นำเข้าข้อมูล (Import) ผ่าน CSV, ออกรายงาน (Report) และหน้าแรกมีระบบล็อกอินสำหรับ admin เท่านั้น

## Features

- **Admin-only login** on the home page (session based, bcrypt-hashed passwords).
- **Dashboard** — totals for users, servers, shares, access grants; top users /
  most-shared folders; recent activity log.
- **Users** — list, search, filter by department, add / edit / delete, and a
  per-user view of every file share they can access.
- **File shares** — manage **file share servers** and their **sub file shares**;
  per-share view of every user who has access.
- **Access control** — grant / revoke access with a permission level
  (read / write / full) from either the user or the share page.
- **Import** — bulk import **users** and **file share servers + sub shares**
  from CSV (with downloadable templates and per-row error reporting).
- **Reports** — full access matrix, access-by-department, users without access,
  shares without users; export everything to CSV.
- **Admin management** — create additional admins, change passwords, delete
  admins (the last admin and your own account are protected).
- **Audit log** — every change is recorded and shown on the dashboard.

## Tech stack

- Node.js + Express
- SQLite via `better-sqlite3` (file-backed, zero external services)
- EJS server-rendered views
- Session store persisted with `connect-sqlite3`

## Getting started

```bash
npm install          # install dependencies
npm run seed         # create the default admin + demo data
npm start            # start the server (http://localhost:3000)
```

Then open <http://localhost:3000> and sign in.

### Default admin credentials

| Username | Password    |
|----------|-------------|
| `admin`  | `admin1234` |

Change the password after first login (Admins page). You can override the
defaults when seeding:

```bash
ADMIN_USER=myadmin ADMIN_PASS='StrongPass!' SEED_DEMO=false npm run seed
```

### Configuration (environment variables)

| Variable         | Default                            | Purpose                          |
|------------------|------------------------------------|----------------------------------|
| `PORT`           | `3000`                             | HTTP port                        |
| `SESSION_SECRET` | `change-this-secret-in-production` | Session cookie signing secret    |
| `ADMIN_USER`     | `admin`                            | Seed admin username              |
| `ADMIN_PASS`     | `admin1234`                        | Seed admin password              |
| `SEED_DEMO`      | (enabled)                          | Set to `false` to skip demo data |

## CSV import formats

**Users** (`samples/users.csv`):

```
employee_id,username,full_name,email,department,title,status
```

Rows are matched/updated by `username`.

**File shares** (`samples/shares.csv`):

```
server,host,location,server_description,share,path,share_description
```

Servers are created on demand; each row may add one sub file share
(matched/updated by server + share name).

Templates are also downloadable from the **Import** page.

## Data storage

All data lives in `data/fileview.db` (SQLite). Sessions live in
`data/sessions.db`. The `data/` directory is git-ignored. Back up these files
to back up the system.

## Project layout

```
server.js            Express app + route wiring
db.js                SQLite schema + audit helper
seed.js              Default admin + demo data
middleware/auth.js   Session auth guards
routes/              auth, dashboard, users, shares, access, import, reports, admins
views/               EJS templates
public/css/          Stylesheet
samples/             Example CSV files for import
```
