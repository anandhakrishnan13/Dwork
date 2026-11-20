-- Employee Directory schema
-- Run against any PostgreSQL 14+ database, including Supabase.

CREATE TABLE IF NOT EXISTS employees (
  id         SERIAL PRIMARY KEY,
  name       VARCHAR(120) NOT NULL,
  email      VARCHAR(255) NOT NULL,
  role       VARCHAR(100) NOT NULL,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Emails are unique regardless of casing.
CREATE UNIQUE INDEX IF NOT EXISTS employees_email_lower_idx
  ON employees (LOWER(email));

CREATE INDEX IF NOT EXISTS employees_name_lower_idx
  ON employees (LOWER(name));

CREATE INDEX IF NOT EXISTS employees_created_at_idx
  ON employees (created_at DESC);
