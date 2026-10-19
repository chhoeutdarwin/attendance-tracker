CREATE DATABASE IF NOT EXISTS mytrackerapp;
USE mytrackerapp;

-- ១. Table បុគ្គលិក (employees)
CREATE TABLE IF NOT EXISTS employees (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    position VARCHAR(100) NULL,
    email VARCHAR(150) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ២. Table វត្តមាន (attendance)
CREATE TABLE IF NOT EXISTS attendance (
    id INT AUTO_INCREMENT PRIMARY KEY,
    employee_id INT NOT NULL,
    work_date DATE NOT NULL,
    check_in TIME NULL,
    check_out TIME NULL,
    status ENUM('Present', 'Late', 'Absent', 'Checked-Out') NOT NULL DEFAULT 'Absent',
    UNIQUE KEY uq_emp_day (employee_id, work_date),
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
);

-- ៣. Table សុំច្បាប់ (leave_requests)
CREATE TABLE IF NOT EXISTS leave_requests (
    id INT AUTO_INCREMENT PRIMARY KEY,
    employee_id INT NOT NULL,
    leave_type VARCHAR(30) NOT NULL DEFAULT 'Annual',
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    reason VARCHAR(255) NULL,
    status ENUM('Pending', 'Approved', 'Rejected') NOT NULL DEFAULT 'Pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
);

-- ៤. បុគ្គលិកគំរូ (Sample data)
INSERT INTO employees (name, position, email) VALUES
('Optimus Prime', 'Developer', 'Prime@example.com'),


-- ដំណើរការក្នុង MySQL Workbench (បន្ថែមតារាង users ប៉ុណ្ណោះ មិនប៉ះតារាងចាស់ទេ)
USE mytrackerapp;

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  password_hash VARCHAR(100) NOT NULL,            -- រក្សា Hash មិនមែន Password ពិតទេ
  role ENUM('admin','employee') NOT NULL DEFAULT 'employee',
  employee_id INT NULL UNIQUE,                    -- ភ្ជាប់គណនីនេះទៅបុគ្គលិកម្នាក់ (Admin អាចទទេ)
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);