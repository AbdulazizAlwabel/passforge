-- Bytes sent by the speed test per calendar month (UTC), for the egress budget.
CREATE TABLE IF NOT EXISTS speed_usage (
  month CHAR(7)          NOT NULL PRIMARY KEY,  -- 'YYYY-MM'
  bytes BIGINT UNSIGNED  NOT NULL DEFAULT 0,
  tests INT UNSIGNED     NOT NULL DEFAULT 0
) ENGINE=InnoDB;
