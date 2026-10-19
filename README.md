# Attendance Tracker

A full-stack employee attendance and leave management app with a purple dashboard UI, secure login, and role-based access (Admin / Employee).

**[Live Demo](https://chhoeutdarwin.github.io/attendance-tracker/)** · runs entirely in your browser (no server needed)

| Demo account | Username | Password |
|---|---|---|
| Admin (boss) | `admin` | `admin123` |
| Employee | `employee` | `employee123` |

> The live demo uses a simulated backend that stores data in your browser. The real app (this repo's `server.js`) uses Node.js + MySQL with hashed passwords.

## Screenshots

| Dashboard (Admin) | Attendance (Employee) | User Accounts (Admin) |
|---|---|---|
| ![Dashboard](docs/screenshots/dashboard.png) | ![Attendance](docs/screenshots/attendance.png) | ![User accounts](docs/screenshots/users.png) |

## Features

- **Login / Logout** with session cookies, bcrypt-hashed passwords, and login rate limiting
- **Role-based access**: the boss (Admin) manages everything, staff (Employee) only handle their own records
- **Dashboard**: today's overview (present, late, absent, checked-out, pending leaves)
- **Employee Directory**: add and remove employees
- **Attendance**: check in / check out, automatic *Late* detection (configurable with `LATE_AFTER`), times shown to the second
- **Leave Records**: request, approve, and reject leave
- **User Accounts** (Admin): create accounts, reset passwords, delete accounts
- **My Profile**: edit your details and change your password
- Light and dark mode, responsive layout (works on phones)

## Roles

| Action | Admin | Employee |
|---|:---:|:---:|
| Dashboard, Employee Directory, User Accounts | ✅ | ❌ |
| Create / delete accounts, reset passwords | ✅ | ❌ |
| Check in / out | ✅ anyone | ✅ own only |
| Mark someone Absent | ✅ | ❌ |
| Request leave | ✅ anyone | ✅ own only |
| Approve / reject leave | ✅ | ❌ |
| Edit profile | ✅ anyone | ✅ own name & email (not position) |
| Change own password | ✅ | ✅ |

Permissions are enforced **on the server**, not only by hiding buttons in the UI.

## Tech stack

- **Frontend**: HTML, CSS, vanilla JavaScript
- **Backend**: Node.js, Express, `express-session`, `bcryptjs`, `express-rate-limit`
- **Database**: MySQL (`mysql2`, parameterized queries)

## Folder structure

```
attendance-app/
├── server.js            # Backend: API + login + permissions
├── create-admin.js      # One-time script to create the first admin
├── schema.sql           # Database + employees / attendance / leave_requests
├── schema-users.sql     # Adds the users table (login accounts)
├── package.json
├── .env                 # Your secrets (NOT on GitHub)
├── .env.example         # Template for .env
├── .gitignore
├── public/              # Frontend served by the real server
│   ├── index.html       # The app (after login)
│   └── login.html       # Login page
└── docs/                # GitHub Pages live demo (no server)
    ├── index.html       # Demo with simulated backend + login
    └── screenshots/     # Images used by this README
```

## Getting started

**Requirements:** Node.js 18+ and MySQL.

1. Clone and install
   ```bash
   git clone https://github.com/chhoeutdarwin/attendance-tracker.git
   cd attendance-tracker
   npm install
   ```
2. Create the database: run `schema.sql`, then `schema-users.sql` in MySQL Workbench.
3. Create `.env` from the template and fill it in
   ```bash
   cp .env.example .env
   ```
   Generate a session secret:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
4. Create the first admin account
   ```bash
   node create-admin.js boss 'YourStrongPassword'
   ```
5. Start the server and open <http://localhost:3000>
   ```bash
   npm start
   ```
6. Log in as admin → **Employee Directory** (add staff) → **User Accounts** (create their logins).

### Environment variables

| Variable | Description |
|---|---|
| `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | MySQL connection (`DB_NAME=mytrackerapp`) |
| `PORT` | Server port (default `3000`) |
| `SESSION_SECRET` | Long random string used to sign session cookies |
| `LATE_AFTER` | Check-in after this time counts as *Late* (e.g. `09:05`; default `09:00`) |
| `NODE_ENV` | Set to `production` when deployed behind HTTPS |

## Security notes

- Passwords are hashed with bcrypt; plain passwords are never stored.
- SQL queries are parameterized (no SQL injection); user text is HTML-escaped in the UI.
- Session cookie is `httpOnly` and `sameSite=lax` (and `secure` in production).
- Login is limited to 10 attempts per 15 minutes per IP.
- Deleted accounts lose access immediately (the server re-checks the user on every request).
- Sessions are kept in memory: fine for development; use a database-backed session store when deploying.

## Roadmap

- Deploy with a managed MySQL database
- Server-side CSV export (the live demo already has it)
- Session store in MySQL, password policy and audit log

## License

MIT