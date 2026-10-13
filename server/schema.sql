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
-- One-time secret sharing. Payloads are AES-GCM ciphertext produced in the browser;
-- the decryption key never reaches the server (it lives in the link's #fragment).
CREATE TABLE IF NOT EXISTS secrets (
  id            VARCHAR(22)  NOT NULL PRIMARY KEY,
  payload       MEDIUMTEXT   NULL,                 -- ciphertext; NULLed when viewed/burned/expired
  salt          VARCHAR(32)  NULL,                 -- PBKDF2 salt when a password is set
  verifier_hash CHAR(64)     NULL,                 -- SHA-256 of the password-derived verifier
  burn_hash     CHAR(64)     NOT NULL,             -- SHA-256 of the creator's burn token
  user_id       INT          NULL,
  attempts      TINYINT      NOT NULL DEFAULT 0,
  created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at    DATETIME     NOT NULL,
  viewed_at     DATETIME     NULL,
  burned_at     DATETIME     NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_user (user_id, created_at),
  INDEX idx_expires (expires_at)
) ENGINE=InnoDB;
-- Bytes sent by the speed test per calendar month (UTC), for the egress budget.
CREATE TABLE IF NOT EXISTS speed_usage (
  month CHAR(7)          NOT NULL PRIMARY KEY,  -- 'YYYY-MM'
  bytes BIGINT UNSIGNED  NOT NULL DEFAULT 0,
  tests INT UNSIGNED     NOT NULL DEFAULT 0
) ENGINE=InnoDB;
