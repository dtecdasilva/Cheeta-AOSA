# Backend

The backend lives in the same Next.js app as the three portals: API route
handlers under `src/app/api`, everything else under `src/server`. It reuses
the frontend's own types, constants and validators from `src/lib` rather
than keeping a second copy of any business rule.

| Concern | Choice |
|---|---|
| Database | PostgreSQL. With no `DATABASE_URL` in development, an embedded Postgres ([PGlite](https://pglite.dev)) stored in `.data/pglite` — same SQL, same migrations, nothing to install |
| Data access, migrations | [Drizzle ORM](https://orm.drizzle.team) + drizzle-kit |
| Validation | [zod](https://zod.dev), plus the existing validators in `src/lib` |
| Auth | The existing signed-token sessions (`src/lib/auth`), now backed by the `users` table |
| Files | `StorageDriver` interface; local disk today |
| Logging | Structured logger with request ids (JSON in production) |

## Running it

```bash
npm install
npm run dev          # migrates and seeds .data/pglite on first start
```

That's all for local work. On first start the server applies migrations and,
because the database is empty, loads the reference data plus demo data
(institutions, the demo accounts in the README, 84 sample applicants and 113
applications). The screens' sample data and the database's are the same
records with the same ids.

Against a real Postgres, copy `.env.example` to `.env.local` and set
`DATABASE_URL` and `SESSION_SECRET`.

| Command | What it does |
|---|---|
| `npm run db:generate` | Write a new SQL migration after changing `src/server/db/schema` |
| `npm run db:migrate` | Apply pending migrations (the production deploy step) |
| `npm run db:seed` | Seed an empty database |
| `npm run db:reset` | Drop everything, migrate, seed. Refuses in production |
| `npm run db:studio` | Browse the database (drizzle-kit studio) |
| `npm run typecheck` | Type-check the project |

With PGlite, stop `next dev` before running a `db:*` command: only one
process may open its data folder.

## Layout

```
db/migrations/                 Generated SQL migrations (source of truth for the deployed schema)
drizzle.config.ts              drizzle-kit settings
scripts/db.ts                  migrate | seed | reset CLI
src/instrumentation.ts         Runs src/server/bootstrap.ts once per server start
src/app/api/**/route.ts        HTTP endpoints — thin: parse, call a service, respond
src/server/
  bootstrap.ts                 Validate env, migrate (AUTO_MIGRATE), seed an empty database
  config/env.ts                Every environment variable, validated with zod
  logging/                     logger.ts (structured, redacting) and request context (AsyncLocalStorage)
  http/
    handler.ts                 Wraps every route: request id, auth, CSRF check, access log, error mapping
    errors.ts                  AppError and subclasses → HTTP status + JSON body
    validate.ts                parseBody / parseQuery / pagination
    respond.ts                 ok / created / paged / noContent
    rateLimit.ts               Per-IP limit for sign-in, registration, password reset
  auth/session.ts              Session cookie → user (shared by API handlers and page guards)
  audit/audit.ts               Append to audit_log inside the same transaction as the change
  db/
    schema/*.ts                Tables, by domain
    client.ts                  pg Pool or PGlite behind one handle
    migrate.ts, seed.ts, ids.ts
  storage/
    driver.ts                  StorageDriver interface + local disk driver
    files.service.ts           Upload checks, metadata, signed download links
  notifications/               In-app notifications; credential email/SMS delivery records
  modules/
    resource.ts                Generic list/get/create/update for configurable records
    checks.ts                  Cross-record checks (town in region, department in faculty, …)
    institutions/              Institution, faculty, department, program, payment method, upload requirement resources
    reference/                 Parameters, countries, currencies, exchange rates
    accounts/                  Staff invitations, account updates, admin password resets
    settings/                  System and payment settings
    student/                   Demographic profile, education records, education levels
    applications/              Student, institution and admin application services + the status workflow
```

## Data model

43 tables in `src/server/db/schema`, grouped as:

- **identity** — `users` (every account, any portal), `applicant_profiles`, `institution_staff`, `credential_deliveries`
- **reference** — `parameters` (every option list, keyed by category), `countries`, `currencies`, `exchange_rates` (one row per change), `settings`, `education_levels`/`education_qualifications`, `counters`
- **institutions** — `institutions`, `faculties`, `departments`, `programs`, `institution_payment_methods`, `upload_requirements`, `fee_configs`
- **applications** — `demographic_profiles`, `education_records`, `examination_records`, `applications` (an applicant's bundle for an intake), `application_institutions` (one per institution applied to — "an application" in the institution and admin portals), `application_status_events`, `program_choices`, `application_documents`
- **payments** — `fee_payments`
- **enrolment** — `admission_rules`/`admission_rule_versions`, `deliberation_runs`, `admissions`, `tuition_accounts`/`tuition_payments`/`tuition_payment_reviews`, `medical_records`/`medical_events`, `matriculations`
- **notifications** — `notification_templates`, `notifications`, `notification_deliveries`
- `files`, `audit_log`

Conventions: text ids (seeded rows keep the frontend's ids such as `inst-1`;
new rows get `<prefix>_<hex>`), `created_at`/`updated_at` on configurable
records, `status` `ACTIVE`/`INACTIVE` instead of deletes, money as integer XAF.

## API

All endpoints answer JSON. Lists take `?page=&pageSize=` (max 200), most take
`?q=` and filters, and answer `{ data, meta: { page, pageSize, total } }`.
Single records answer `{ data }`. The endpoints the frontend already called
keep their original response keys.

**Errors** always look like this, with the status from the table below:

```json
{ "error": "Some fields need attention.", "code": "VALIDATION_FAILED", "requestId": "…", "fieldErrors": { "email": "Enter a valid email address." } }
```

| Status | `code` | When |
|---|---|---|
| 400 | `BAD_REQUEST`, `VALIDATION_FAILED` | Malformed JSON; failed validation (`fieldErrors` names each field) |
| 401 | `UNAUTHENTICATED` | No valid session |
| 403 | `FORBIDDEN` | Wrong role, wrong institution, missing staff permission, cross-site write |
| 404 | `NOT_FOUND` | Doesn't exist — or belongs to someone else (ownership is never confirmed) |
| 409 | `CONFLICT` | Duplicate, already reviewed, locked after submission |
| 413 | `PAYLOAD_TOO_LARGE` | Upload over the limit |
| 429 | `TOO_MANY_REQUESTS` | Rate limit or account lockout |
| 500 | `INTERNAL` | Unexpected; details are in the server log under `requestId` |

### Public and shared

| Method & path | Who | Purpose |
|---|---|---|
| `GET /api/health` | anyone | Database and storage check (503 when degraded) |
| `POST /api/auth/login`, `logout`, `register`, `forgot-password`, `reset-password`; `GET /api/auth/session` | anyone | Unchanged contracts used by the auth screens |
| `GET /api/reference/countries`, `/currencies` | anyone | Pickers on public forms; currencies carry the current rate |
| `GET /api/reference/parameters?category=` | signed in | Active options of one parameter list |
| `GET /api/reference/institutions`, `/institutions/:id/programs` | signed in | Discovery and program selection |
| `GET /api/config/education-levels` | signed in | Education form dropdowns |
| `GET /api/notifications`, `PATCH /api/notifications/:id` | signed in | Own notifications; `{ read, archived }` |
| `POST /api/files` (multipart `file`, `purpose`) | signed in | Standalone upload, e.g. a payment receipt |
| `GET /api/files/:id[?t=]`, `DELETE /api/files/:id` | signed link or permitted session | Download (inline for PDF/images); soft delete |

### Student portal (`STUDENT`)

| Method & path | Purpose |
|---|---|
| `GET/POST /api/student/demographic` | Read; save draft or `mode: "submit"` |
| `GET/POST /api/student/education`, `PATCH/DELETE /api/student/education/:id` | Education history |
| `GET /api/student/applications` | Applications by intake |
| `POST /api/student/applications` `{ institutionId }` | Apply to an institution in the current intake |
| `GET/DELETE /api/student/applications/:id` | One institution application (with the submission checklist); withdraw before submission |
| `PUT /api/student/applications/:id/choices` `{ choices: [{ programId, rank }] }` | Ranked program choices |
| `POST /api/student/applications/:id/documents` (multipart `requirementId`, `file`) | Upload a required document |
| `DELETE /api/student/applications/:id/documents/:documentId` | Remove one |
| `POST /api/student/applications/:id/payments` `{ method, reference, paidAt, receiptFileId? }` | Record the fee paid (amount computed server-side) |
| `POST /api/student/applications/:id/submit` `{ declaration: true }` | Submit or resubmit; refused with the failing checklist items |
| `POST /api/student/applications/:id/offer` `{ decision }` | Accept or decline an offer |

### Institution portal (`INSTITUTION_ADMIN`, `INSTITUTION_ADMISSION_USER`)

Everything is scoped to the caller's institution. Admission users read;
writes to structure need `INSTITUTION_ADMIN`; decisions need the matching
staff permission.

| Method & path | Purpose |
|---|---|
| `GET /api/institution/applications`, `/applications/summary` | Applications (masked until the fee is approved), counts by status |
| `GET /api/institution/applications/:id` | Detail; documents and applicant details only once paid and submitted |
| `POST /api/institution/applications/:id/decision` | `{ action: "acknowledge" }`, `{ action: "reject", reasonId, note? }`, `{ action: "accept", programId }` |
| `PATCH /api/institution/applications/:id/documents/:documentId` | `{ decision: "approve" }` or `{ decision: "reject", reason }` |
| `GET/POST …/faculties`, `…/departments`, `…/programs`, `…/payment-methods`, `…/upload-requirements` and `GET/PATCH …/:id` | Own structure (prefix `/api/institution`) |

### Administration portal (`AOSA_ADMIN`)

| Method & path | Purpose |
|---|---|
| `GET/POST` and `GET/PATCH /:id` on `/api/admin/institutions`, `faculties`, `departments`, `programs`, `payment-methods`, `parameters`, `countries`, `currencies` | Platform-wide configuration |
| `GET/POST /api/admin/exchange-rates` | Current rates + history; set a rate |
| `GET/PUT /api/admin/settings/system`, `/settings/payment` | Settings (merged over the defaults in `src/lib/admin/settings.ts`) |
| `GET/POST /api/admin/accounts`, `GET/PATCH /api/admin/accounts/:id`, `POST …/:id/reset-password` | Accounts and invitations |
| `GET /api/admin/applications`, `/applications/:id`, `POST …/:id/decision` | All applications, unmasked; act as admin |
| `GET /api/admin/fee-payments`, `PATCH /api/admin/fee-payments/:id` | Approval desk; approving issues the bank code |
| `GET /api/admin/audit-log` | Who changed what (filters: entity, actor, institution, action, dates) |

## Rules enforced server-side

- **Payment privacy** (`src/lib/payments/privacy.ts`): institutions never receive the web fee; until AOSA approves the fee they see only "First L. — awaiting payment", with no contact details, documents or program, and searching by name can't reveal a masked applicant.
- **Status flow** (`src/lib/applications/statusFlow.ts`): each status change is checked against who may make it, recorded in `application_status_events`, audited and notified. Resubmission after a rejection is allowed only when the rejection reason says so.
- **Submission checklist**: demographic submitted, at least one school, a program chosen, every required document present and none rejected, fee approved.
- **Uploads**: type checked against the requirement, size limit, and the file's first bytes must match its extension. Documents for an institution are readable by that institution's staff; download links are signed and expire.
- **Sessions**: a password reset, deactivation, role or institution change ends existing sessions (session version in the token). Reset links work once. Accounts lock after repeated failed sign-ins (system setting).
- **Writes**: cross-site requests are refused; every create/update/status change writes an audit row in the same transaction.

## Adding to it

- **A configurable record type** (a list screen with add/edit/deactivate): add a table in `src/server/db/schema`, run `npm run db:generate`, write a `ResourceDef` (schema, filters, `check` for cross-record rules), and export `collectionRoutes`/`itemRoutes` from two route files. See `src/server/modules/institutions/institutions.resources.ts`.
- **Anything with workflow**: a service function that starts from the signed-in user, runs in one transaction, uses `transition()` for status changes and `audit()` for everything else, and throws `AppError`s.
- **A route**: `export const POST = handler({ auth: [...] }, async ({ req, user, params }) => …)`. Parse input with `parseBody`/`parseQuery`; never trust ids or amounts from the client.

## Connecting the screens

The admin screens keep their data in `createCollection` stores
(`src/lib/admin/store.ts`), and several student and institution screens still
read mock data. The API is shaped to replace them one screen at a time: the
resource endpoints mirror the collections' list/add/update, records keep the
same ids and field names, and the seed loads the same data the screens show.

## Before production

- Set `DATABASE_URL`, `SESSION_SECRET` (32+ random characters) and `APP_URL`; run `npm run db:migrate` on deploy (`AUTO_MIGRATE` is off in production).
- File storage: mount a persistent volume for `STORAGE_LOCAL_DIR`, or add an object-storage driver in `src/server/storage/driver.ts` (required on serverless hosting).
- Email and SMS are logged, not sent, until a provider is added in `src/lib/notifications`. Registration and password reset depend on it in production.
- The rate limiter is per server instance; with several instances move it to Redis or the database.
- Not built yet: endpoints for examinations/results, deliberation runs, tuition, medical checks, matriculation, notification templates and staff management. Their tables exist; the services follow the same patterns as applications.
