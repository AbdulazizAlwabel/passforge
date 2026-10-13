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
