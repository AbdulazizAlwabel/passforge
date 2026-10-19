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
