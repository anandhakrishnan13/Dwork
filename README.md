# Employee Directory

A full-stack employee directory: add, search, paginate, edit and delete employee
records. The API owns pagination and validation; the UI renders the pagination
metadata it receives.

## Stack

| Layer    | Choice                                                            |
| -------- | ----------------------------------------------------------------- |
| Frontend | Next.js 16 (App Router) · TypeScript · Tailwind CSS · shadcn/ui   |
| Data     | Axios · Sonner toasts                                             |
| Backend  | Node.js · Express 5 · TypeScript · Zod                            |
| Database | PostgreSQL (Supabase or any Postgres 14+)                         |
| Tests    | Vitest · Supertest · embedded PostgreSQL                          |

## Features

- Create, edit and delete employees with confirmation dialogs.
- Paginated table driven entirely by backend metadata (`page`, `totalPages`,
  `totalRecords`); the client cannot choose a page size.
- Search combobox populated with employee names, plus free-text search across
  name, email and role.
- Toast feedback for fetch, create, update and delete outcomes.
- Loading skeletons, empty states, inline retry, keyboard-accessible dialogs.
- Responsive layout (stacked on mobile, two columns on desktop).
- Case-insensitive unique emails, field-level validation errors, 409/404 handling.

## Project structure

```
.
├── backend/
│   ├── db/
│   │   ├── schema.sql          # table + indexes (migration)
│   │   └── seed.sql            # 13 sample employees
│   ├── scripts/local-db.ts     # optional embedded Postgres for development
│   ├── src/
│   │   ├── app.ts              # Express app factory (CORS, helmet, errors)
│   │   ├── config.ts           # env validation
│   │   ├── db/pool.ts          # pg pool, SSL for Supabase
│   │   ├── employees/
│   │   │   ├── repository.ts   # parameterized SQL, fixed PAGE_SIZE
│   │   │   ├── routes.ts       # REST endpoints
│   │   │   └── schema.ts       # Zod validation
│   │   └── server.ts
│   └── tests/api.test.ts       # 19 integration tests against real Postgres
├── frontend/
│   ├── app/                    # App Router pages, layout, global styles
│   ├── components/
│   │   ├── employees/          # feature components
│   │   └── ui/                 # shadcn/ui primitives
│   ├── hooks/                  # data fetching + mutation hooks
│   ├── lib/                    # Axios client, formatters, cn
│   └── types/                  # shared TypeScript types
```

## 1. Database (Supabase)

1. Create a project at [supabase.com](https://supabase.com).
2. Open **SQL Editor**, paste the contents of `backend/db/schema.sql`, and run it.
   Optionally run `backend/db/seed.sql` for sample data.
3. Copy the connection string from **Project Settings → Database → Connection
   string → URI**. Prefer the **Session pooler** URI if your network needs IPv4.
   Replace `[YOUR-PASSWORD]` with the database password.

Using `psql` instead:

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

## 2. Backend

```bash
cd backend
npm install
cp .env.example .env      # fill in DATABASE_URL
npm run dev               # http://localhost:4000
```

Environment variables:

| Variable       | Required | Description                                              |
| -------------- | -------- | -------------------------------------------------------- |
| `DATABASE_URL` | yes      | PostgreSQL connection string                             |
| `DB_SSL`       | no       | `true` for Supabase/hosted Postgres, `false` locally     |
| `PORT`         | no       | API port (default `4000`)                                |
| `CORS_ORIGIN`  | no       | Comma-separated allowed origins (default `http://localhost:3000`) |
| `SUPER_ADMIN_EMAIL`    | no | Super admin login email (default `default@example.com`) |
| `SUPER_ADMIN_PASSWORD` | no | Super admin password (default `kaam-chor-majdoor`)      |

On every start the API creates or refreshes the super admin account from these
values and stores its password as a bcrypt hash. Change both credentials before
deploying.

Health check: `GET http://localhost:4000/health`.

## 3. Frontend

```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev               # http://localhost:3000
```

`NEXT_PUBLIC_API_URL` must point at the API (default `http://localhost:4000`).

## Run everything from the root

```bash
npm install               # root tooling (concurrently)
npm run dev               # API + web together
npm run test              # backend integration tests
npm run build             # typecheck + production builds
```

## API

Base URL: `http://localhost:4000`

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

```json
{ "name": "Ada Lovelace", "email": "ada@example.com", "role": "Mathematician" }
```

- `201` with `{ "data": { ...employee } }`
- `400` `{ "message": "Validation failed", "errors": { "email": ["..."] } }`
- `409` duplicate email (case-insensitive)

### `PUT /employees/{id}`

Same body as create. `200` with the updated record, `404` if missing, `409` on a
duplicate email.

### `DELETE /employees/{id}`

`204` on success, `404` if missing.

All errors use `{ "message": string, "errors"?: Record<string, string[]> }`.

## Tests

```bash
cd backend
npm test
```

The suite boots an embedded PostgreSQL instance, applies `db/schema.sql`, and
exercises validation, pagination metadata, client-supplied limit rejection,
search, combobox names, create/update/delete, duplicate emails, 404s and CORS.

## Deployment

- **Database:** Supabase (already hosted).
- **API:** deploy `backend/` to Render, Railway or Fly.io with `DATABASE_URL`,
  `DB_SSL=true`, `CORS_ORIGIN=https://your-frontend.vercel.app`. Build with
  `npm run build`, start with `npm start`.
- **Frontend:** deploy `frontend/` to Vercel with
  `NEXT_PUBLIC_API_URL=https://your-api.example.com`.

## Design notes

- Pagination is computed from a `COUNT(*)` and `LIMIT/OFFSET` in one repository
  call; page size is a server constant (`PAGE_SIZE = 10`).
- Emails are unique on `LOWER(email)` so casing cannot create duplicates.
- LIKE wildcards in search terms are escaped, so `%` and `_` are literal.
- `helmet`, strict JSON body limits, parameterized queries and Zod `.strict()`
  payloads keep the API surface small and safe.
