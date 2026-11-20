# Employee Directory

A full-stack employee directory: add, search, paginate, edit and delete employee
records. The API owns pagination and validation; the UI renders the pagination
metadata it receives.

## Stack

| Layer    | Choice                                                            |
| -------- | ----------------------------------------------------------------- |
| Frontend | Next.js 16 (App Router) · TypeScript · Tailwind CSS · shadcn/ui   |
| Data     | Axios · Sonner toasts                                             |
| Auth     | JWT bearer tokens · bcryptjs password hashing                     |
| Backend  | Node.js · Express 5 · TypeScript · Zod                            |
| Database | PostgreSQL (Supabase or any Postgres 14+)                         |
| Tests    | Vitest · Supertest · embedded PostgreSQL                          |

## Features

- Email/password sign-in with JWT sessions; passwords are stored as bcrypt hashes.
- Role-based access: employees read the directory, managers manage their direct
  reports, admins manage everyone. The environment-configured super admin is an
  admin that is recreated on every start.
- Employee hierarchy via a **Reports to** picker when creating/editing someone;
  reporting loops are rejected by the API.
- Add-employee modal creates a login account automatically with the default
  password `Majdoor-hu-mai` (configurable).
- Create, edit and delete employees with confirmation dialogs.
- Paginated table driven entirely by backend metadata (`page`, `totalPages`,
  `totalRecords`); the client cannot choose a page size.
- Search combobox populated with employee names, plus free-text search across
  name, email and role.
- Toast feedback for login, fetch, create, update and delete outcomes.
- Loading skeletons, empty states, inline retry, keyboard-accessible dialogs.
- Responsive layout (stacked on mobile, two columns on desktop).
- Case-insensitive unique emails, field-level validation errors, 409/404 handling.

## Project structure

```
.
├── .env.example                # single shared env template for both apps
├── backend/
│   ├── db/
│   │   ├── schema.sql          # table + indexes (migration)
│   │   └── seed.sql            # 13 sample employees
│   ├── scripts/
│   │   ├── apply-schema.ts      # applies db/schema.sql to DATABASE_URL
│   │   └── local-db.ts          # optional embedded Postgres for development
│   ├── src/
│   │   ├── app.ts              # Express app factory (CORS, helmet, errors)
│   │   ├── auth/               # login, JWT middleware, password seeding
│   │   ├── config.ts           # env validation
│   │   ├── db/
│   │   │   ├── apply-schema.ts # idempotent startup migration
│   │   │   └── pool.ts         # pg pool, SSL for Supabase
│   │   ├── employees/
│   │   │   ├── repository.ts   # parameterized SQL, fixed PAGE_SIZE
│   │   │   ├── routes.ts       # REST endpoints + role checks
│   │   │   └── schema.ts       # Zod validation
│   │   └── server.ts
│   └── tests/                  # 37 integration tests against real Postgres
├── frontend/
│   ├── app/                    # App Router pages, layout, login page
│   ├── components/
│   │   ├── auth/               # session provider + route guard
│   │   ├── employees/          # feature components
│   │   └── ui/                 # shadcn/ui primitives
│   ├── hooks/                  # data fetching + mutation hooks
│   ├── lib/                    # Axios client, auth storage, formatters, cn
│   └── types/                  # shared TypeScript types
```

## 1. Environment

There is one `.env` at the repository root, shared by the API and the web app.
Create it once:

```bash
cp .env.example .env
```

Both apps load it automatically; you do not need `backend/.env` or
`frontend/.env.local`. Environment variables already set in your shell take
precedence over the file.

## 2. Database (Supabase)

1. Create a project at [supabase.com](https://supabase.com).
2. Copy the connection string from **Project Settings → Database → Connection
   string → URI**. Prefer the **Session pooler** URI if your network needs IPv4;
   the direct database host may be IPv6-only. The pooler username looks like
   `postgres.<project-ref>` and uses port `5432`. Replace `[YOUR-PASSWORD]` with
   the database password.
3. That is it. On startup the API applies `backend/db/schema.sql` automatically
   (it is idempotent), so a fresh database gets the `employees` and `users`
   tables. You can also apply it yourself before starting:

```bash
cd backend
npm run db:schema
```

To add the 13 sample employees, run `backend/db/seed.sql` in the Supabase SQL
Editor, or with `psql`:

```bash
psql "$DATABASE_URL" -f backend/db/schema.sql
psql "$DATABASE_URL" -f backend/db/seed.sql   # optional
```

### Local Postgres without Docker

If you do not have a Postgres server, the backend can download and run one:

```bash
cd backend
npm install
npm run db:local          # creates .pgdata, applies schema, seeds 13 rows
```

Then use:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/employees
DB_SSL=false
```

## 3. Backend

```bash
cd backend
npm install
npm run dev               # http://localhost:4000
```

The API reads the root `.env` (and still accepts normal shell environment
variables).

Environment variables:

| Variable       | Required | Description                                              |
| -------------- | -------- | -------------------------------------------------------- |
| `DATABASE_URL` | yes      | PostgreSQL connection string                             |
| `DB_SSL`       | no       | `true` for Supabase/hosted Postgres, `false` locally     |
| `PORT`         | no       | API port (default `4000`)                                |
| `CORS_ORIGIN`  | no       | Comma-separated allowed origins (default `http://localhost:3000`) |
| `SUPER_ADMIN_EMAIL`    | no | Super admin login email (default `default@example.com`) |
| `SUPER_ADMIN_PASSWORD` | no | Super admin password (default `kaam-chor-majdoor`)      |
| `JWT_SECRET`           | no | Token signing secret (default is development-only; set a long random value in production) |
| `DEFAULT_EMPLOYEE_PASSWORD` | no | Password for new employee accounts (default `Majdoor-hu-mai`) |
| `NEXT_PUBLIC_API_URL`  | no | Frontend API base URL (default `http://localhost:4000`)  |

On every start the API applies the idempotent schema, then creates or refreshes
the super admin account from these
values, stores its password as a bcrypt hash, and gives any employee without a
login an account using the default employee password. Change the credentials and
secret before deploying.

Sign in at `/login` with the super admin credentials. Newly created employees can
sign in with their work email and the default password. Passwords are never
returned by the API.

Health check: `GET http://localhost:4000/health`.

## 4. Frontend

```bash
cd frontend
npm install
npm run dev               # http://localhost:3000
```

`NEXT_PUBLIC_API_URL` from the root `.env` must point at the API (default
`http://localhost:4000`). The app starts on `/login`; the directory at `/`
requires a valid session.

### Role model

| Role | Directory | Create | Edit | Delete | Access level picker |
| ---- | --------- | ------ | ---- | ------ | ------------------- |
| Employee | read/search | no | no | no | no |
| Manager | read/search | yes (direct reports) | direct reports only | no | no |
| Admin | read/search | yes | everyone | yes | yes |

The super admin is an admin account with no linked employee record, so it cannot
be deleted or demoted through the employee API.

## Run everything from the root

```bash
npm install               # root tooling (concurrently)
cp .env.example .env      # one shared config file
npm run db:schema         # apply backend/db/schema.sql to DATABASE_URL
npm run dev               # API + web together
npm run test              # backend integration tests
npm run build             # typecheck + production builds
```

## API

Base URL: `http://localhost:4000`

All `/employees` endpoints require `Authorization: Bearer <token>`.

### `POST /auth/login`

```json
{ "email": "default@example.com", "password": "kaam-chor-majdoor" }
```

Returns `{ "data": { "token": "...", "user": { ... } } }`. Invalid credentials
return `401` with a generic message.

### `GET /auth/me`

Returns the signed-in user: `{ "data": { "id", "email", "role",
"isSuperAdmin", "employeeId", "name" } }`.

### `GET /employees?page=1&search=ada`

Page size is fixed at **10** server-side. `limit`/`pageSize` query parameters are
ignored.

```json
{
  "data": [
    {
      "id": 1,
      "name": "Ada Lovelace",
      "email": "ada@example.com",
      "role": "Mathematician",
      "manager_id": 4,
      "manager_name": "Grace Hopper",
      "access_role": "employee",
      "created_at": "2026-11-20T13:00:00.000Z"
    }
  ],
  "currentPage": 1,
  "pageSize": 10,
  "totalPages": 2,
  "totalRecords": 13
}
```

`search` matches name, email or role, case-insensitively.

### `GET /employees/names?search=ada`

Compact list for the search combobox (max 50, alphabetical).

```json
{ "data": [{ "id": 1, "name": "Ada Lovelace", "email": "ada@example.com" }] }
```

### `POST /employees`

Admin or manager only.

```json
{
  "name": "Ada Lovelace",
  "email": "ada@example.com",
  "role": "Mathematician",
  "managerId": 4,
  "accessRole": "employee"
}
```

- `managerId` is optional (`null` for no manager) and must reference an existing
  employee. Self-management and reporting loops are rejected with `400`.
- `accessRole` is `employee`, `manager` or `admin`; it defaults to `employee`.
  Only admins may choose it — manager-created employees are always employees.
- A manager's new employee is forced to report to that manager.
- The employee gets a login account with the default password.
- `201` with `{ "data": { ...employee } }`
- `400` `{ "message": "Validation failed", "errors": { "email": ["..."] } }`
- `409` duplicate email (case-insensitive)

### `PUT /employees/{id}`

Same body as create. Admins may edit anyone and change `accessRole`; managers may
edit only their direct reports (their manager and access role stay fixed). `200`
with the updated record, `404` if missing, `409` on a duplicate email.

### `DELETE /employees/{id}`

Admin only. `204` on success, `404` if missing. Deleting an employee also removes
their login account and clears them as anyone's manager.

All errors use `{ "message": string, "errors"?: Record<string, string[]> }`.

## Tests

```bash
cd backend
npm test
```

The suite boots an embedded PostgreSQL instance, applies `db/schema.sql`, and
exercises login, JWT authentication, role-based access, hierarchy validation,
default employee accounts, validation, pagination metadata, client-supplied limit
rejection, search, combobox names, create/update/delete, duplicate emails, 404s
and CORS. A separate test starts from an empty database and proves the startup
schema migration creates both tables and can run twice. 37 tests run in roughly
10 seconds.

## Deployment

- **Database:** Supabase (already hosted).
- **API:** deploy `backend/` to Render, Railway or Fly.io with `DATABASE_URL`,
  `DB_SSL=true`, `CORS_ORIGIN=https://your-frontend.vercel.app`,
  `JWT_SECRET=<long random value>` and changed super-admin credentials. Build with
  `npm run build`, start with `npm start`.
- **Frontend:** deploy `frontend/` to Vercel with
  `NEXT_PUBLIC_API_URL=https://your-api.example.com`.

## Design notes

- Pagination is computed from a `COUNT(*)` and `LIMIT/OFFSET` in one repository
  call; page size is a server constant (`PAGE_SIZE = 10`).
- Emails are unique on `LOWER(email)` so casing cannot create duplicates.
- LIKE wildcards in search terms are escaped, so `%` and `_` are literal.
- Passwords use bcrypt (cost 12). Login tokens are signed JWTs with an 8-hour
  lifetime; the API reloads the user on each request so role changes apply
  immediately.
- `helmet`, strict JSON body limits, parameterized queries and Zod `.strict()`
  payloads keep the API surface small and safe.
- Manager edits are scoped in the API, not just hidden in the UI. Deleting an
  employee cascades to their login account via a foreign key.
