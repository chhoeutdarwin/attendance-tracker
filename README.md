# Attendance Tracker

A full-stack employee attendance management app with a purple dashboard UI.

## Features
- Dashboard with today's overview (present, late, absent, pending leaves)
- Employee directory (add, delete, edit profile)
- Daily check-in / check-out with automatic late detection (after 09:00)
- Leave requests with approve / reject workflow

## Tech Stack
- **Frontend:** HTML, CSS, vanilla JavaScript
- **Backend:** Node.js, Express
- **Database:** MySQL (mysql2)

## Getting Started

### Requirements
- Node.js (LTS)
- MySQL Server and MySQL Workbench

### Setup
1. Clone the repo and install packages:
```
   git clone https://github.com/YOUR_USERNAME/attendance-tracker.git
   cd attendance-tracker
   npm install
```
2. Open `schema.sql` in MySQL Workbench and run it to create the database and tables.
3. Copy `.env.example` to `.env` and fill in your MySQL password and database name (`attendance_db`).
4. Start the server:
```
   npm start
```
5. Open http://localhost:3000

## Project Structure
```
server.js         Express API + MySQL connection
public/index.html Frontend UI
schema.sql        Database tables
.env.example      Environment variable template
```

## Notes
This is a learning/portfolio project and has no authentication.