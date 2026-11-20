-- Employee Directory schema
-- Run against any PostgreSQL 14+ database, including Supabase.

CREATE TABLE IF NOT EXISTS employees (
  id         SERIAL PRIMARY KEY,
  name       VARCHAR(120) NOT NULL,
  email      VARCHAR(255) NOT NULL,
  role       VARCHAR(100) NOT NULL,
  manager_id INTEGER REFERENCES employees (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Existing databases created before the hierarchy column need it added.
ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS manager_id INTEGER REFERENCES employees (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS employees_manager_id_idx
  ON employees (manager_id);

-- Emails are unique regardless of casing.
CREATE UNIQUE INDEX IF NOT EXISTS employees_email_lower_idx
  ON employees (LOWER(email));

CREATE INDEX IF NOT EXISTS employees_name_lower_idx
  ON employees (LOWER(name));

CREATE INDEX IF NOT EXISTS employees_created_at_idx
  ON employees (created_at DESC);

-- Accounts for signing in. Employees get an account linked through employee_id;
-- the environment-seeded super admin is an account without an employee record.
CREATE TABLE IF NOT EXISTS users (
  id             SERIAL PRIMARY KEY,
  email          VARCHAR(255) NOT NULL,
  password_hash  VARCHAR(255) NOT NULL,
  role           VARCHAR(20)  NOT NULL DEFAULT 'employee'
                   CHECK (role IN ('employee', 'manager', 'admin')),
  is_super_admin BOOLEAN      NOT NULL DEFAULT FALSE,
  employee_id    INTEGER      UNIQUE REFERENCES employees (id) ON DELETE CASCADE,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_idx
  ON users (LOWER(email));

CREATE INDEX IF NOT EXISTS users_employee_id_idx
  ON users (employee_id);
