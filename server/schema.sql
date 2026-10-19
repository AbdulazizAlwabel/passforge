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
-- Tool suggestions with public voting. No visitor identifiers are stored.
CREATE TABLE IF NOT EXISTS suggestions (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  title       VARCHAR(80)  NOT NULL,
  details     VARCHAR(500) NOT NULL DEFAULT '',
  lang        CHAR(2)      NOT NULL DEFAULT 'en',
  status      ENUM('pending','open','planned','done','declined') NOT NULL DEFAULT 'pending',
  votes       INT UNSIGNED NOT NULL DEFAULT 0,
  created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_status_votes (status, votes)
) ENGINE=InnoDB;
-- Two-factor authentication (TOTP) and the zero-knowledge vault.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS totp_enabled     TINYINT(1)   NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS totp_secret_enc  VARCHAR(255) NULL,      -- AES-256-GCM with TOTP_ENC_KEY
  ADD COLUMN IF NOT EXISTS totp_pending_enc VARCHAR(255) NULL,      -- secret awaiting confirmation
  ADD COLUMN IF NOT EXISTS totp_last_step   BIGINT       NOT NULL DEFAULT 0;   -- replay protection

CREATE TABLE IF NOT EXISTS recovery_codes (
  id        INT AUTO_INCREMENT PRIMARY KEY,
  user_id   INT      NOT NULL,
  code_hash CHAR(64) NOT NULL,
  used_at   DATETIME NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user (user_id)
) ENGINE=InnoDB;

-- Vault: the server stores only ciphertext. The vault key is generated in the browser
-- and stored here wrapped (encrypted) by the passphrase key and by the recovery key.
CREATE TABLE IF NOT EXISTS vaults (
  user_id        INT          NOT NULL PRIMARY KEY,
  kdf_salt       VARCHAR(32)  NOT NULL,
  kdf_iterations INT          NOT NULL,
  wrapped_pass   VARCHAR(255) NOT NULL,
  wrapped_recov  VARCHAR(255) NOT NULL,
  created_at     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS vault_items (
  id         VARCHAR(22)  NOT NULL PRIMARY KEY,
  user_id    INT          NOT NULL,
  data       MEDIUMTEXT   NOT NULL,
  updated_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user (user_id)
) ENGINE=InnoDB;
