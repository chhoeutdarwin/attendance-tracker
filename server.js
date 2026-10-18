// ===== server.js: បេះដូងរបស់ Backend =====
// ឯកសារនេះ: (1) ភ្ជាប់ទៅ MySQL (2) បង្កើត API (3) បម្រើឯកសារ Frontend ក្នុង public/
// dotenv: អាន Password ពីឯកសារ .env (កុំដាក់ Password ក្នុងកូដ)
require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const path = require('path');

// បង្កើតកម្មវិធី Express, express.json() ជួយអាន Data JSON ដែល Frontend ផ្ញើមក
// express.static: បង្ហាញ public/index.html នៅ http://localhost:3000
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Connection Pool: ការភ្ជាប់ MySQL ដែលប្រើឡើងវិញបាន (លឿនជាងភ្ជាប់ថ្មីរាល់ពេល)
// dateStrings: true = ឱ្យ DATE/TIME ត្រឡប់ជាអក្សរ ងាយបង្ហាញ
const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  dateStrings: true,
});

// wrap: ជួយចាប់ Error ដើម្បីកុំឱ្យ Server គាំង ហើយឆ្លើយ 'Server error' វិញ
// សារ Error ពិតនឹងបង្ហាញក្នុង Terminal (console.error)
const wrap = fn => (req, res) =>
  fn(req, res).catch(err => { console.error(err); res.status(500).json({ error: 'Server error' }); });

// Today's attendance for every employee
// [API] យកការចូលធ្វើការថ្ងៃនេះ របស់បុគ្គលិកទាំងអស់
// LEFT JOIN = បុគ្គលិកដែលមិនទាន់ Check-in ក៏នៅបង្ហាញ (ជា Absent)
// CURDATE() = កាលបរិច្ឆេទថ្ងៃនេះក្នុង MySQL
app.get('/api/attendance', wrap(async (req, res) => {
  const [rows] = await db.query(
    `SELECT e.id, e.name, COALESCE(a.status,'Absent') AS status, a.check_in, a.check_out
     FROM employees e
     LEFT JOIN attendance a ON a.employee_id = e.id AND a.work_date = CURDATE()
     ORDER BY e.id`);
  res.json(rows);
}));

// [API] បន្ថែមបុគ្គលិកថ្មី  (? ជាការការពារ SQL Injection ជានិច្ច ប្រើ ? កុំបូកអក្សរ)
app.post('/api/employees', wrap(async (req, res) => {
  const name = (req.body.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Name required' });
  const [r] = await db.query('INSERT INTO employees (name, position, email) VALUES (?,?,?)',
    [name, req.body.position || null, req.body.email || null]);
  res.status(201).json({ id: r.insertId, name });
}));

// [API] លុបបុគ្គលិក (ON DELETE CASCADE ក្នុង DB នឹងលុបទិន្នន័យ attendance របស់គេដែរ)
app.delete('/api/employees/:id', wrap(async (req, res) => {
  await db.query('DELETE FROM employees WHERE id = ?', [req.params.id]);
  res.json({ ok: true });
}));

// [API] Check-in: ប្តូរម៉ោង 09:00:00 ខាងក្រោមនេះ បើចង់ប្តូរម៉ោងចូលធ្វើការ
// ON DUPLICATE KEY UPDATE = បើថ្ងៃនេះមានជួររួចហើយ ឱ្យ Update ជំនួសការបង្កើតថ្មី
app.post('/api/attendance/:id/check-in', wrap(async (req, res) => {
  await db.query(
    `INSERT INTO attendance (employee_id, work_date, check_in, status)
     VALUES (?, CURDATE(), CURTIME(), IF(CURTIME() > '09:00:00','Late','Present'))
     ON DUPLICATE KEY UPDATE check_in = VALUES(check_in), check_out = NULL, status = VALUES(status)`,
    [req.params.id]);
  res.json({ ok: true });
}));

// [API] Check-out: ត្រូវ Check-in សិន ទើប Check-out បាន (check_in IS NOT NULL)
app.post('/api/attendance/:id/check-out', wrap(async (req, res) => {
  const [r] = await db.query(
    `UPDATE attendance SET check_out = CURTIME(), status = 'Checked-Out'
     WHERE employee_id = ? AND work_date = CURDATE() AND check_in IS NOT NULL`,
    [req.params.id]);
  if (!r.affectedRows) return res.status(400).json({ error: 'Check in first' });
  res.json({ ok: true });
}));

// [API] កំណត់ជា Absent និងលុបម៉ោង Check-in/out
app.post('/api/attendance/:id/absent', wrap(async (req, res) => {
  await db.query(
    `INSERT INTO attendance (employee_id, work_date, status) VALUES (?, CURDATE(), 'Absent')
     ON DUPLICATE KEY UPDATE check_in = NULL, check_out = NULL, status = 'Absent'`,
    [req.params.id]);
  res.json({ ok: true });
}));


// [API] បញ្ជីបុគ្គលិក (សម្រាប់ Employee Directory, Leave, Profile)
app.get('/api/employees', wrap(async (req, res) => {
  const [rows] = await db.query('SELECT id, name, position, email FROM employees ORDER BY id');
  res.json(rows);
}));

// [API] កែព័ត៌មានបុគ្គលិក (My Profile)
app.put('/api/employees/:id', wrap(async (req, res) => {
  const name = (req.body.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Name required' });
  await db.query('UPDATE employees SET name=?, position=?, email=? WHERE id=?',
    [name, req.body.position || null, req.body.email || null, req.params.id]);
  res.json({ ok: true });
}));

// [API] ទិន្នន័យសម្រាប់ Dashboard: ចំនួនសរុប, ចំនួនតាម Status, Leave ដែលរង់ចាំ
app.get('/api/dashboard', wrap(async (req, res) => {
  const [[t]] = await db.query('SELECT COUNT(*) AS total FROM employees');
  const [s] = await db.query(
    `SELECT COALESCE(a.status,'Absent') AS status, COUNT(*) AS n FROM employees e
     LEFT JOIN attendance a ON a.employee_id=e.id AND a.work_date=CURDATE() GROUP BY 1`);
  const [[p]] = await db.query("SELECT COUNT(*) AS n FROM leave_requests WHERE status='Pending'");
  res.json({ total: t.total, statuses: s, pendingLeaves: p.n });
}));

// [API] បញ្ជីសុំច្បាប់ទាំងអស់ (ថ្មីបំផុតមុន)
app.get('/api/leaves', wrap(async (req, res) => {
  const [rows] = await db.query(
    `SELECT l.id, e.name, l.leave_type, l.start_date, l.end_date, l.reason, l.status
     FROM leave_requests l JOIN employees e ON e.id=l.employee_id ORDER BY l.id DESC`);
  res.json(rows);
}));

// [API] ដាក់ពាក្យសុំច្បាប់ (មាន Validation: ថ្ងៃបញ្ចប់មិនអាចមុនថ្ងៃចាប់ផ្តើម)
app.post('/api/leaves', wrap(async (req, res) => {
  const b = req.body;
  if (!b.employee_id || !b.start_date || !b.end_date) return res.status(400).json({ error: 'Fill all fields' });
  if (b.end_date < b.start_date) return res.status(400).json({ error: 'End date is before start date' });
  await db.query(
    'INSERT INTO leave_requests (employee_id, leave_type, start_date, end_date, reason) VALUES (?,?,?,?,?)',
    [b.employee_id, b.leave_type || 'Annual', b.start_date, b.end_date, b.reason || null]);
  res.status(201).json({ ok: true });
}));

// [API] Approve ឬ Reject ច្បាប់ (:action = approve ឬ reject)
app.post('/api/leaves/:id/:action', wrap(async (req, res) => {
  const st = { approve: 'Approved', reject: 'Rejected' }[req.params.action];
  if (!st) return res.status(400).json({ error: 'Bad action' });
  await db.query('UPDATE leave_requests SET status=? WHERE id=?', [st, req.params.id]);
  res.json({ ok: true });
}));

// ចាប់ផ្តើម Server នៅ Port 3000 (ប្តូរបានក្នុង .env)
const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Running at http://localhost:${port}`));
