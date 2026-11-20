-- Optional sample data: 13 employees (two pages at the fixed page size of 10).
INSERT INTO employees (name, email, role)
VALUES
  ('Aarav Sharma',      'aarav.sharma@example.com',      'Frontend Engineer'),
  ('Bianca Rossi',      'bianca.rossi@example.com',      'Product Designer'),
  ('Chen Wei',          'chen.wei@example.com',          'Backend Engineer'),
  ('Diego Fernández',   'diego.fernandez@example.com',   'DevOps Engineer'),
  ('Emeka Okafor',      'emeka.okafor@example.com',      'QA Engineer'),
  ('Fatima Al-Sayed',   'fatima.alsayed@example.com',    'Engineering Manager'),
  ('Grace Kim',         'grace.kim@example.com',         'Data Analyst'),
  ('Hiroshi Tanaka',    'hiroshi.tanaka@example.com',    'Full Stack Developer'),
  ('Isabela Costa',     'isabela.costa@example.com',     'Product Manager'),
  ('Jonas Berg',        'jonas.berg@example.com',        'Security Engineer'),
  ('Kavya Nair',        'kavya.nair@example.com',        'UX Researcher'),
  ('Liam O''Connor',    'liam.oconnor@example.com',      'Mobile Developer'),
  ('Maya Haddad',       'maya.haddad@example.com',       'Technical Writer')
ON CONFLICT DO NOTHING;
