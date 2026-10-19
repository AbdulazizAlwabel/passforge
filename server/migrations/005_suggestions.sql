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
