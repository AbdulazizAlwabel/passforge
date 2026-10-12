-- Nicely Done (formerly PassForge) database schema — unchanged, existing databases keep working.
-- Note: v2 stores SHA-256 hashes of email tokens in `tokens.token` (64 hex chars, same column).
-- Run this on your MySQL server to recreate the database

CREATE DATABASE IF NOT EXISTS passforge CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE passforge;

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  email VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  verified TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS tokens (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  token VARCHAR(64) NOT NULL UNIQUE,
  type ENUM('verify_email','reset_password') NOT NULL,
  used TINYINT(1) NOT NULL DEFAULT 0,
  expires_at DATETIME NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_token (token),
  INDEX idx_user_type (user_id, type)
) ENGINE=InnoDB;

-- Create a dedicated MySQL user for the app (run as root)
-- CREATE USER 'passforge_app'@'localhost' IDENTIFIED BY 'CHANGE_ME_STRONG_PASSWORD';
-- GRANT ALL PRIVILEGES ON passforge.* TO 'passforge_app'@'localhost';
-- FLUSH PRIVILEGES;
