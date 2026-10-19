// ===== server.js (កំណែមាន Login/Logout + Role: admin / employee) =====
// (1) ភ្ជាប់ MySQL (2) Login ដោយ Session Cookie (3) API ត្រូវពិនិត្យសិទ្ធិរាល់ពេល
require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const path = require('path');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');

// SESSION_SECRET = ពាក្យសម្ងាត់សម្រាប់ចុះហត្ថលេខា Cookie (ដាក់ក្នុង .env)
if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 16) {
  console.error('Missing SESSION_SECRET in .env (at least 16 characters)');
  process.exit(1);
}

const app = express();
if (process.env.NODE_ENV === 'production') app.set('trust proxy', 1); // ពេលនៅពីក្រោយ Railway/Render
app.use(express.json());

// Session: ចាំថាអ្នកណា Login. Cookie ជា httpOnly (JavaScript អានមិនបាន) ហើយផុតកំណត់ក្រោយ ៨ ម៉ោង
app.use(session({
  name: 'sid',
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production', // HTTPS តែពេល Deploy
    maxAge: 8 * 60 * 60 * 1000,
  },
}));

const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  dateStrings: true,
});

const wrap = fn => (req, res) =>
  fn(req, res).catch(err => {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Already exists (username or employee already has an account)' });
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  });

// ===== Frontend =====
// "/" ត្រូវ Login សិន បើមិនទាន់ក៏ទៅទំព័រ Login
app.get('/', (req, res) =>
  req.session.userId
    ? res.sendFile(path.join(__dirname, 'public', 'index.html'))
    : res.redirect('/login.html'));
app.use(express.static(path.join(__dirname, 'public'), { index: false }));

// ===== Helpers សិទ្ធិ =====
const isAdmin = req => req.user.role === 'admin';
const canAct = (req, id) => isAdmin(req) || Number(id) === req.user.employeeId; // Admin ឬខ្លួនឯង
const adminOnly = (req, res, next) =>
  isAdmin(req) ? next() : res.status(403).json({ error: 'Admins only' });

const LEAVE_TYPES = ['Annual', 'Sick', 'Unpaid', 'Other'];
// LATE_AFTER ក្នុង .env (ឧ. 09:05 ឬ 09:05:00). Late = Check-in ក្រោយម៉ោងនេះ. បើអត់ដាក់ ឬខុសទម្រង់ ប្រើ 09:00:00
const _la = String(process.env.LATE_AFTER || '09:00').trim();
const LATE_AFTER = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(_la) ? (_la.length === 5 ? _la + ':00' : _la) : '09:00:00';
console.log('Late after ' + LATE_AFTER);
const USERNAME_RE = /^[A-Za-z0-9_.-]{3,30}$/;
const goodPassword = p => typeof p === 'string' && p.length >= 8 && p.length <= 72;
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10); // ឱ្យពេល Login ខុសមានល្បឿនដូចគ្នា

// ===== Login (កំណត់ ១០ ដងក្នុង ១៥ នាទី ក្នុងមួយ IP ការពារការទាយ Password) =====
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts. Try again in 15 minutes.' },
});

app.post('/api/login', loginLimiter, wrap(async (req, res) => {
  const username = String(req.body.username || '').trim();
  const password = String(req.body.password || '');
  const [rows] = await db.query('SELECT id, password_hash FROM users WHERE username = ?', [username]);
  const u = rows[0];
  const ok = await bcrypt.compare(password, u ? u.password_hash : DUMMY_HASH);
  if (!u || !ok) return res.status(401).json({ error: 'Wrong username or password' });
  // regenerate = ID Session ថ្មី (ការពារ Session Fixation)
  req.session.regenerate(err => {
    if (err) { console.error(err); return res.status(500).json({ error: 'Server error' }); }
    req.session.userId = u.id;
    res.json({ ok: true });
  });
}));

// ===== ទ្វារត្រួតពិនិត្យ: គ្រប់ /api ក្រៅពី /login ត្រូវ Login ហើយ =====
// ពិនិត្យ DB រាល់ពេល ដូច្នេះបើ Admin លុបគណនី អ្នកនោះត្រូវចេញភ្លាម
app.use('/api', async (req, res, next) => {
  try {
    if (req.path === '/login') return next();
    const uid = req.session.userId;
    if (!uid) return res.status(401).json({ error: 'Please log in' });
    const [rows] = await db.query('SELECT id, username, role, employee_id FROM users WHERE id = ?', [uid]);
    if (!rows.length) return req.session.destroy(() => res.status(401).json({ error: 'Please log in' }));
    const u = rows[0];
    req.user = { id: u.id, username: u.username, role: u.role, employeeId: u.employee_id, lateAfter: LATE_AFTER };
    next();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => { res.clearCookie('sid'); res.json({ ok: true }); });
});

app.get('/api/me', (req, res) => res.json(req.user));

// ប្តូរ Password ខ្លួនឯង
app.post('/api/me/password', wrap(async (req, res) => {
  const { current, password } = req.body;
  if (!goodPassword(password)) return res.status(400).json({ error: 'New password must be 8-72 characters' });
  const [rows] = await db.query('SELECT password_hash FROM users WHERE id = ?', [req.user.id]);
  if (!(await bcrypt.compare(String(current || ''), rows[0].password_hash)))
    return res.status(400).json({ error: 'Current password is wrong' });
  await db.query('UPDATE users SET password_hash = ? WHERE id = ?', [await bcrypt.hash(password, 10), req.user.id]);
  res.json({ ok: true });
}));

// ===== គ្រប់គ្រងគណនី (Admin ប៉ុណ្ណោះ) =====
app.get('/api/users', adminOnly, wrap(async (req, res) => {
  const [rows] = await db.query(
    `SELECT u.id, u.username, u.role, u.employee_id, e.name AS employee_name
     FROM users u LEFT JOIN employees e ON e.id = u.employee_id ORDER BY u.id`);
  res.json(rows);
}));

app.post('/api/users', adminOnly, wrap(async (req, res) => {
  const { username, password, role } = req.body;
  const empId = req.body.employee_id ? Number(req.body.employee_id) : null;
  if (!USERNAME_RE.test(username || '')) return res.status(400).json({ error: 'Username: 3-30 characters (letters, numbers, . _ -)' });
  if (!goodPassword(password)) return res.status(400).json({ error: 'Password must be 8-72 characters' });
  if (!['admin', 'employee'].includes(role)) return res.status(400).json({ error: 'Bad role' });
  if (role === 'employee' && !empId) return res.status(400).json({ error: 'Choose an employee for this account' });
  if (empId) {
    const [e] = await db.query('SELECT id FROM employees WHERE id = ?', [empId]);
    if (!e.length) return res.status(400).json({ error: 'Employee not found' });
  }
  await db.query('INSERT INTO users (username, password_hash, role, employee_id) VALUES (?,?,?,?)',
    [username, await bcrypt.hash(password, 10), role, empId]);
  res.status(201).json({ ok: true });
}));

app.post('/api/users/:id/reset-password', adminOnly, wrap(async (req, res) => {
  if (!goodPassword(req.body.password)) return res.status(400).json({ error: 'Password must be 8-72 characters' });
  await db.query('UPDATE users SET password_hash = ? WHERE id = ?',
    [await bcrypt.hash(req.body.password, 10), req.params.id]);
  res.json({ ok: true });
}));

app.delete('/api/users/:id', adminOnly, wrap(async (req, res) => {
  if (Number(req.params.id) === req.user.id) return res.status(400).json({ error: 'You cannot delete your own account' });
  await db.query('DELETE FROM users WHERE id = ?', [req.params.id]);
  res.json({ ok: true });
}));

// ===== Attendance =====
// Admin ឃើញទាំងអស់ / Employee ឃើញតែខ្លួនឯង
app.get('/api/attendance', wrap(async (req, res) => {
  const admin = isAdmin(req);
  const [rows] = await db.query(
    `SELECT e.id, e.name, COALESCE(a.status,'Absent') AS status, a.check_in, a.check_out
     FROM employees e
     LEFT JOIN attendance a ON a.employee_id = e.id AND a.work_date = CURDATE()
     ${admin ? '' : 'WHERE e.id = ?'}
     ORDER BY e.id`,
    admin ? [] : [req.user.employeeId]);
  res.json(rows);
}));

app.post('/api/attendance/:id/check-in', wrap(async (req, res) => {
  if (!canAct(req, req.params.id)) return res.status(403).json({ error: 'Not allowed' });
  await db.query(
    `INSERT INTO attendance (employee_id, work_date, check_in, status)
     VALUES (?, CURDATE(), CURTIME(), IF(CURTIME() > ?,'Late','Present'))
     ON DUPLICATE KEY UPDATE check_in = VALUES(check_in), check_out = NULL, status = VALUES(status)`,
    [req.params.id, LATE_AFTER]);
  res.json({ ok: true });
}));

app.post('/api/attendance/:id/check-out', wrap(async (req, res) => {
  if (!canAct(req, req.params.id)) return res.status(403).json({ error: 'Not allowed' });
  const [r] = await db.query(
    `UPDATE attendance SET check_out = CURTIME(), status = 'Checked-Out'
     WHERE employee_id = ? AND work_date = CURDATE() AND check_in IS NOT NULL`,
    [req.params.id]);
  if (!r.affectedRows) return res.status(400).json({ error: 'Check in first' });
  res.json({ ok: true });
}));

// កំណត់ Absent: Admin ប៉ុណ្ណោះ
app.post('/api/attendance/:id/absent', adminOnly, wrap(async (req, res) => {
  await db.query(
    `INSERT INTO attendance (employee_id, work_date, status) VALUES (?, CURDATE(), 'Absent')
     ON DUPLICATE KEY UPDATE check_in = NULL, check_out = NULL, status = 'Absent'`,
    [req.params.id]);
  res.json({ ok: true });
}));

// ===== Employees =====
app.get('/api/employees', wrap(async (req, res) => {
  const admin = isAdmin(req);
  const [rows] = await db.query(
    `SELECT id, name, position, email FROM employees ${admin ? '' : 'WHERE id = ?'} ORDER BY id`,
    admin ? [] : [req.user.employeeId]);
  res.json(rows);
}));

app.post('/api/employees', adminOnly, wrap(async (req, res) => {
  const name = (req.body.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Name required' });
  const [r] = await db.query('INSERT INTO employees (name, position, email) VALUES (?,?,?)',
    [name, req.body.position || null, req.body.email || null]);
  res.status(201).json({ id: r.insertId, name });
}));

app.delete('/api/employees/:id', adminOnly, wrap(async (req, res) => {
  if (Number(req.params.id) === req.user.employeeId)
    return res.status(400).json({ error: 'You cannot delete your own employee record' });
  await db.query('DELETE FROM users WHERE employee_id = ?', [req.params.id]); // លុបគណនីរបស់គេដែរ
  await db.query('DELETE FROM employees WHERE id = ?', [req.params.id]);
  res.json({ ok: true });
}));

// Admin កែបានទាំងអស់ / Employee កែបានតែ Name និង Email របស់ខ្លួន (មិនអាចកែ Position)
app.put('/api/employees/:id', wrap(async (req, res) => {
  if (!canAct(req, req.params.id)) return res.status(403).json({ error: 'Not allowed' });
  const name = (req.body.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Name required' });
  if (isAdmin(req)) {
    await db.query('UPDATE employees SET name=?, position=?, email=? WHERE id=?',
      [name, req.body.position || null, req.body.email || null, req.params.id]);
  } else {
    await db.query('UPDATE employees SET name=?, email=? WHERE id=?',
      [name, req.body.email || null, req.params.id]);
  }
  res.json({ ok: true });
}));

// ===== Dashboard (Admin ប៉ុណ្ណោះ) =====
app.get('/api/dashboard', adminOnly, wrap(async (req, res) => {
  const [[t]] = await db.query('SELECT COUNT(*) AS total FROM employees');
  const [s] = await db.query(
    `SELECT COALESCE(a.status,'Absent') AS status, COUNT(*) AS n FROM employees e
     LEFT JOIN attendance a ON a.employee_id=e.id AND a.work_date=CURDATE() GROUP BY 1`);
  const [[p]] = await db.query("SELECT COUNT(*) AS n FROM leave_requests WHERE status='Pending'");
  res.json({ total: t.total, statuses: s, pendingLeaves: p.n });
}));

// ===== Leaves =====
app.get('/api/leaves', wrap(async (req, res) => {
  const admin = isAdmin(req);
  const [rows] = await db.query(
    `SELECT l.id, e.name, l.leave_type, l.start_date, l.end_date, l.reason, l.status
     FROM leave_requests l JOIN employees e ON e.id=l.employee_id
     ${admin ? '' : 'WHERE l.employee_id = ?'} ORDER BY l.id DESC`,
    admin ? [] : [req.user.employeeId]);
  res.json(rows);
}));

// Employee សុំបានតែសម្រាប់ខ្លួនឯង (មិនអើពើ employee_id ដែលផ្ញើមក)
app.post('/api/leaves', wrap(async (req, res) => {
  const b = req.body;
  const empId = isAdmin(req) ? Number(b.employee_id) : req.user.employeeId;
  if (!empId || !b.start_date || !b.end_date) return res.status(400).json({ error: 'Fill all fields' });
  if (b.end_date < b.start_date) return res.status(400).json({ error: 'End date is before start date' });
  if (b.leave_type && !LEAVE_TYPES.includes(b.leave_type)) return res.status(400).json({ error: 'Bad leave type' });
  await db.query(
    'INSERT INTO leave_requests (employee_id, leave_type, start_date, end_date, reason) VALUES (?,?,?,?,?)',
    [empId, b.leave_type || 'Annual', b.start_date, b.end_date, b.reason || null]);
  res.status(201).json({ ok: true });
}));

// Approve / Reject: Admin ប៉ុណ្ណោះ
app.post('/api/leaves/:id/:action', adminOnly, wrap(async (req, res) => {
  const st = { approve: 'Approved', reject: 'Rejected' }[req.params.action];
  if (!st) return res.status(400).json({ error: 'Bad action' });
  await db.query('UPDATE leave_requests SET status=? WHERE id=?', [st, req.params.id]);
  res.json({ ok: true });
}));

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Running at http://localhost:${port}`));