// ===== create-admin.js: បង្កើត Admin ដំបូង (ដំណើរការម្តងតែប៉ុណ្ណោះ) =====
// របៀបប្រើ (PowerShell ប្រើ ' ' ព័ទ្ធ Password):
//   node create-admin.js boss 'MyStrongPass123'
require('dotenv').config();
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

(async () => {
  const [, , username, password] = process.argv;
  if (!username || !password || password.length < 8) {
    console.log("Usage: node create-admin.js <username> '<password, min 8 characters>'");
    process.exit(1);
  }
  const db = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });
  const hash = await bcrypt.hash(password, 10);
  await db.query("INSERT INTO users (username, password_hash, role) VALUES (?, ?, 'admin')", [username, hash]);
  console.log('Admin created: ' + username);
  await db.end();
})().catch(e => { console.error('Failed:', e.message); process.exit(1); });