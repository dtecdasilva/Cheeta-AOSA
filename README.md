# Cheeta AOSA Platform — Frontend

Next.js 16 + TypeScript + Tailwind CSS v4.

## Serverless hosting note (Vercel, etc.) — cross-instance persistence

Vercel (and serverless hosting generally) runs this app as multiple
short-lived function instances rather than one persistent process. A
plain in-memory store — which is what every store in this codebase was
originally — only reliably reflects state for whichever instance happens
to handle a given request. Deployed as-is, that showed up as exactly the
bug you'd expect: register an account, then get redirected back to
`/login` right after seemingly signing in, because the Server Component
checking the session landed on a different instance than the one that
created the account.

**Fix, scoped deliberately to "make this not matter for a frontend demo"
rather than "add a database":** account records, demographic profiles,
and education records are now also written into signed, httpOnly cookies
(`src/lib/cookieStore.ts`, reusing the same HMAC signing already built for
sessions) whenever they're created or changed. Cookies travel with the
browser to whichever instance handles the *next* request, so the
`globalThis` stores still work as a same-instance fast path, but a
different instance can now reconstruct what it's missing from the
cookie instead of simply not finding it.

**Verified, not assumed** — by literally killing the server process and
starting a brand-new one (simulating a fresh Vercel instance with zero
shared memory) while reusing only the browser's cookies:
- ✅ A session created on the killed instance is still recognized as valid,
  and the protected dashboard renders directly (no redirect) on the new one
- ✅ Demographic info and an education record saved on the killed instance
  are both still there on the new one
- ✅ Registering on one instance, then logging in for the first time on a
  *different, fresh* instance, succeeds — and the same login attempt with
  no cookie sent correctly fails with `401`, proving the cookie is what
  makes the difference, not coincidence
- ✅ The five seeded demo accounts are unaffected (they're created
  identically on every instance at startup, so they never needed this)
- ✅ Password reset works end-to-end across instances too: the old
  password is rejected and the new one accepted, both checked on a third,
  never-before-seen instance

**Trade-off, stated plainly:** this puts (hashed) account records and
applicant-entered data into cookies, which is a reasonable, explicitly
scoped choice for a frontend demo with no backend infrastructure, and a
wrong one for anything handling real applicant data at scale. Replacing
it with a real database means deleting `src/lib/cookieStore.ts` and the
call sites that reference it (grep for `PERSISTENT_COOKIE_OPTIONS` and
`readSignedCookie`) — the `globalThis` stores and their shapes don't
change.

## Modules built so far

1. **Student Study Program Selection** (current module, frontend-only) —
   after selecting an institution, cascading Faculty/School → Department
   → Qualification → Study Program selection with ranked First/Second/
   Third Choice slots (shown only where that institution's own
   `maxProgramChoices` allows), available spaces shown per program.
   Extends the Institution Discovery module rather than duplicating its
   data or hierarchy.
2. Student Institution Discovery (frontend-only) — browse/search/filter
   institutions, view full details including the Faculty/School →
   Department → Qualification → Study Program hierarchy and available
   spaces, and select institutions.
3. Currency display system — six reusable components (selector, symbol,
   code, formatted amount, converted amount, exchange-rate info), wired
   into a real "Application Fee Summary" page.
4. Country selection components — one reusable, searchable `CountrySelect`
   combobox, wired into Country of Birth, Nationality, Country of
   Residence, Parent's Country, and Previous Education Country.
5. Student Results Information (frontend-only) — dynamic subject/grade/
   result entry, reusing the Examination Information module's mock config.
6. Student Examination Information (frontend-only) — add/edit/delete
   examination records with fields and result shape that dynamically
   adjust to the chosen qualification and number of sittings.
7. Education Information — full CRUD education history, with
   database-backed (mock, in-memory) configurable qualification options.
8. Student Demographic Information — full demographic form, backed by a
   real server-side store and API.
9. Student Dashboard and Process Flow — full student nav, Dashboard,
   Process Flow page, reusable progress component.
10. Student/Applicant registration — public registration form, account
    creation, temporary login code generation, simulated email/SMS delivery.
11. Authentication foundation — login/logout, session management, password
    recovery, role-based route protection across four user categories.
12. Student/Applicant portal UI (application wizard) — sits at
    `/student/applications/*`, built before the nav redesign; see "A note
    on the application wizard" below.

## Run it

```bash
npm install
npm run dev
```

Open http://localhost:3000 — you'll land on the marketing page. Register a
new applicant account at `/register`, or sign in with one of the seeded
demo accounts below (useful for the institution/admin roles, which have
no self-registration).

## Demo accounts

There is no real database yet — accounts live in `src/lib/auth/users.ts` as
an in-memory array (kept on `globalThis` so it's shared correctly across
Next.js's separate module graphs for Route Handlers vs Server Components —
see the comment in that file if you're curious why that matters), seeded
with **scrypt-hashed** passwords (not plaintext). This resets whenever the
dev/prod server restarts. New accounts created via `/register` are added
to the same store and behave identically to the seeded ones.

| Role | Email | Password | Status |
|---|---|---|---|
| Student/Applicant | `student@cheeta.local` | `Student123!` | Active |
| Student/Applicant (blocked) | `inactive.student@cheeta.local` | `Student123!` | **Inactive** — login is rejected |
| Institution Administrator | `admin@montfebe.cheeta.local` | `Institution123!` | Active |
| Institution Admission User | `admissions@montfebe.cheeta.local` | `Institution123!` | Active |
| Cheeta/AOSA Administrator | `root@aosa.cheeta.local` | `Aosa123!` | Active |

## What the Student Study Program Selection module includes

**Frontend-only, per this module's explicit scope** — choices live in
`InstitutionDiscovery`'s component state (lifted up so they survive
navigating back to browse and returning within the same session) and
don't persist past a refresh; "do not implement backend validation yet"
means the duplicate-program and completeness checks below are UI
conveniences, not an enforced rule.

- **Reuses the Institution Discovery hierarchy directly** — no second
  copy of institutions/faculties/departments/programs. A new
  `ProgramChoice` type was added to the same shared data module
  (`src/lib/institutionDiscovery/data.ts`) to describe one ranked choice;
  the tree itself is untouched.
- **The full cascade, as 4 independent steps**: Faculty/School →
  Department → Qualification → Study Program
  (`src/components/institutions/StudyProgramSelector.tsx`). Qualification
  is a genuine, separate selection step, not just inferred from the
  program — verified against a department that actually offers two
  qualification levels (Bachelor's and Master's Computer Science),
  confirming picking a qualification correctly narrows the Study Program
  options to just the matching one.
- **First/Second/Third Choice, "where applicable"** — the number of
  choice slots shown is driven by each institution's own
  `maxProgramChoices` (already defined on the base Institution type):
  verified all four mock institutions render the right count — 3 slots
  for the university, 2 for the polytechnic, 1 (no "second/third choice"
  language at all) for the two schools that only accept a single program.
- **Available spaces shown per program**, exactly as already modeled in
  Institution Discovery, with a "Full" state when a program has none left.
- **Wired into the existing Institution Discovery flow**, not a
  disconnected new page: once an institution is selected, its detail view
  gains a "Choose study programs" action, and each selected-institution
  chip shows live progress (e.g. "2/3 programs") and its own shortcut
  into program selection.
- **Verified no regressions** in the Dashboard or Fee Summary, which read
  the same underlying institution data; confirmed no backend route exists
  for program selection.

## What the Student Institution Discovery module includes

**Frontend-only, per this module's explicit scope** — no API route, no
store; selections live in local component state and don't persist past a
refresh, same as Examination/Results Information before it.

- **Extends, doesn't replace, the existing institution data.** The
  hierarchy (`src/lib/institutionDiscovery/data.ts`) is keyed by the same
  institution ids already defined in `src/lib/data.ts` and used by the
  Dashboard, Fee Summary, and the old application wizard — none of that
  had to change. New data (faculties, departments, per-program available
  spaces, overview text) is layered on top via a join function
  (`listInstitutionsWithProfiles()`), not a parallel, disconnected set of
  institutions.
- **The exact hierarchy specified**: Institution → Faculty/School →
  Department → Qualification → Study Program, rendered as a real nested
  tree in the detail view, not flattened.
- **Every listed capability, on one page** (`/student/institutions/add`,
  `src/components/institutions/InstitutionDiscovery.tsx`):
  - *Browse* — a card grid of all mock institutions
  - *Search* — by institution name
  - *Filter* — by institution type and location, plus a "has space"
    toggle computed from the real aggregated mock program capacity
  - *View institution details* — a dedicated detail view
    (`InstitutionDetail.tsx`) showing type, location, an overview,
    founding year, and the full faculty/department/program tree
  - *View available programs* and *available spaces* — shown both as
    aggregate counts on each browse card and broken out per program in
    the detail view (verified: Mont Fébé's 147 total spaces is the exact
    sum of its four programs' individual capacities)
  - *Select an institution* — from either the browse card or the detail
    view; selected institutions appear as a removable chip list at the
    top of the page
- **Verified against a live server**: all four mock institutions render
  with correct type/location/program/space data; confirmed no regression
  in the Dashboard or Fee Summary, which read the same underlying
  institution data; confirmed no backend route exists
  (`/api/institutions` and `/api/config/institutions` both `404`).

## What the Currency display system module includes

- **Six reusable components** (`src/components/currency/`):
  `CurrencySelector` (searchable combobox), `CurrencySymbol`,
  `CurrencyCode`, `FormattedCurrencyAmount`, `ConvertedAmount`, and
  `ExchangeRateInfo`. All read from one shared data module
  (`src/lib/currency/data.ts`) — no component has its own inline currency
  list or conversion math.
- **Deliberate split between async and sync data access.** Only
  `CurrencySelector`'s option list goes through the `Promise`-shaped
  `getCurrencies()` (matching the `getCountries()` pattern) — the right
  place for a real backend to plug in later, since a form control briefly
  loading is normal UX. The other five are small, frequently-inlined
  display atoms meant to render instantly wherever they're dropped in, so
  they call the synchronous helpers (`getCurrencyInfo`, `formatAmount`,
  `convertAmount`) directly rather than showing a loading flicker for
  what's currently static mock data either way.
- **Formatting respects each currency's own conventions** — decimal
  places and whether the symbol goes before or after the number (`$24.57`
  vs. `12,000 FCFA`), not a one-size-fits-all format string.
- **Conversion pivots through the base currency (XAF)**, the same way a
  real multi-currency system would, and returns `null` (not a wrong
  number) when a currency has no mock rate — verified directly: a
  15,000 XAF fee converts to $24.57, round-trips back to ~15,000 XAF, and
  the EUR rate (655.957) is the actual real-world CFA franc/EUR peg, so
  655.957 XAF converts to exactly 1 EUR.
- **No backend, as instructed** — "do not implement live exchange-rate
  APIs" and no API route was built for this; confirmed live that
  `/api/config/currencies` and `/api/config/exchange-rates` both `404`.
- **Wired into a real page, not left unused**: "Application Fee Summary"
  (`/student/fees/summary`) was a placeholder before this module — replaced
  with a working demonstration that lets an applicant view the mock
  institutions' real fee data (from `src/lib/data.ts`) in a currency of
  their choice, using all six components together. This is a display
  feature only: it doesn't change what's actually owed or process
  anything, per "do not implement real payment conversion yet".
- **Database structure documented, not just implied** — `db/schema.sql`
  gained `currencies` and `exchange_rates` tables (the latter one row per
  currency *per date*, preserving history, rather than overwriting a
  single rate column).

## What the Country selection components module includes

- **One reusable component** (`src/components/CountrySelect.tsx`) — a
  searchable combobox, not a plain `<select>`: with ~65 options, typing
  "ni" to jump to Nigeria/Niger is materially faster than scrolling a
  native dropdown. Keyboard-navigable (arrows/Enter/Escape), closes on
  outside click, reverts an unselected half-typed query rather than
  saving garbage.
- **One shared mock data source** (`src/lib/countries/data.ts`) —
  consolidated from what was previously a duplicate array living inside
  `src/lib/demographic/options.ts`; that file now re-exports from the
  shared source under the same name so nothing importing it had to change.
- **Async-shaped data access** (`src/lib/countries/getCountries.ts`) —
  returns a `Promise<string[]>` even though it currently just resolves
  the static mock list, module-scope cached so multiple `<CountrySelect>`
  instances on one page (e.g. three country fields on the Demographic
  form) don't each redundantly re-resolve it. "Eventually database-backed"
  means swapping the body of this one function for a real fetch — no
  component changes required.
- **Wired into all four named use cases, for real:**
  - *Nationality* and *Country of Residence* — swapped the Demographic
    form's existing plain dropdowns for `CountrySelect`, no data-model change
  - *Country of Birth* — added as a genuinely new field to Demographic
    Information, paired with the existing free-text Place of Birth
    (new `countryOfBirth` column, required, validated against the shared
    list both client- and server-side)
  - *Previous Education Country* — added a new `country` field to
    Education Information's per-school records (new column, required,
    validated in both the create and update routes, shown as its own
    table column)
  - *Parent's Country* (bonus, already existed) also swapped over, so
    there are now zero remaining plain country `<select>`s anywhere in
    the app
- **Verified end-to-end against a live server**, including the specific
  failure mode this kind of change risks: killed the server entirely
  (simulating a fresh Vercel instance with zero shared memory) and
  confirmed both new fields — `countryOfBirth` and the education record's
  `country` — correctly survived via the existing cookie-based
  cross-instance persistence, not just the fields that already existed
  before this change.
- ✅ Invalid country values rejected server-side on both new fields
  (`"Wakanda"` / `"Narnia"` / `"Not Cameroon"` style attempts all
  correctly `400`), and missing-country submissions rejected too

## What the Student Results Information module includes

**Frontend-only, per this module's explicit scope** — no API route, no
store, no persistence past a page refresh, same as Examination
Information right before it.

- **Reuses the Examination Information module's mock config directly**
  (`src/lib/examination/mockConfig.ts`) rather than a second, separate
  config — "Use mock examination configuration" meant *this* one, not a
  new one. Extended it with `passingGrades` / `passMark` per qualification
  so Result can be computed.
- **Dynamic subject/result entry**: choosing a Qualification determines
  both the Subject options and whether the next field is a Grade dropdown
  (GCE Ordinary/Advanced Level) or a Score-out-of-20 input (BEPC,
  Probatoire, BAC) — the same dynamic-by-type behavior as Examination
  Information, applied here to standalone subject results rather than
  sittings.
- **Result is computed, not entered** — as soon as a grade or score is
  chosen, a live Pass/Fail preview appears in the form
  (`computeResult()` in mockConfig.ts), and the same computation renders
  in the results table. This is deliberately pure frontend logic against
  mock pass-criteria data — "do not implement backend result processing"
  ruled out anything server-side, not the idea of Result existing at all.
- **Add / Edit / Delete / View**, entirely in local component state
  (`src/components/results/ResultsForm.tsx`) — a table lists every saved
  result with its computed outcome, editing loads a result back into the
  same dynamic form, deleting asks for inline confirmation first.

## What the Student Examination Information module includes

**Deliberately frontend-only, per this module's explicit scope** —
no API route, no store, no persistence past a page refresh. This is a
scope change from the Education Information module before it (which is
fully database-backed): the instruction for this module explicitly asked
for mock configuration data and no backend logic, so that's what's built.
An earlier, more backend-heavy attempt at this module (config store,
records store, server-side result computation) was started and then
removed once the scope was clarified — nothing from that attempt is
wired up or left half-finished in the codebase.

- **Supports all five specified examination types** as the Qualification
  dropdown's options: GCE Ordinary Level, GCE Advanced Level, BEPC,
  Probatoire, BAC (`src/lib/examination/mockConfig.ts`).
- **Two axes of dynamic UI**, both driven by that same mock config:
  - **By examination type** — GCE Ordinary/Advanced Level show a letter
    grade per subject (configurable grade lists — A/B/C/F vs.
    A/B/C/D/E/F); BEPC, Probatoire, and BAC show a numeric score out of
    20 per subject instead. The subject pool offered also changes per
    qualification.
  - **By number of sittings** — choosing a sitting count adds or removes
    that many repeated blocks, each with its own Examination Year,
    Candidate Number, and Centre Number (plus its own subject/result
    entries) — exactly the "allow separate information for each sitting"
    behavior, generalized to any count up to the qualification's
    configured maximum rather than hard-coded to "1 or 2".
- **Add / Edit / Delete**, entirely in local component state
  (`src/components/examination/ExaminationForm.tsx`) — a table lists
  saved examinations, editing loads a record back into the same dynamic
  form, deleting asks for inline confirmation first.
- **Mock configuration, not hard-coded inline** — every dropdown (grades,
  subjects, sitting limits) reads from `EXAM_TYPE_CONFIGS`, one file, so
  extending or changing what's offered is a data change there, not a
  hunt through the form component — the same shape a future
  database-backed config (like Education Information's) would need to
  match to drop in as a replacement.

## What the Education Information module includes

- **Full CRUD** at `/student/application/education`
  (`src/components/education/EducationForm.tsx`): add, edit, delete, and
  list multiple schools. Each record: Start Year, End Year, School Name,
  School Type, Qualification Obtained.
- **Qualification options are genuinely database-backed, not hard-coded
  in the frontend.** `src/lib/education/configStore.ts` is a
  `globalThis`-backed store (documented target schema:
  `education_levels` / `education_qualifications` in `db/schema.sql`)
  seeded with exactly the options given in the spec — Secondary School
  (No Qualification, GCE O Level, BEPC, Probatoire), High School (No
  Qualification, GCE A Level, Baccalaureate/BAC), and Primary School
  (No Qualification, First School Leaving Certificate, Common Entrance),
  plus Vocational School, Professional School, and University for
  completeness. The frontend fetches this from
  `GET /api/config/education-levels` — there is no qualification array
  written into any component. The store also has real add/rename/remove
  functions for levels and qualifications; no Admin UI calls them yet
  (out of scope for this module), but they exist as the integration point
  for one.
- **Dependent dropdown, validated on both ends**: choosing a School Type
  filters the Qualification options to that level (client-side, from the
  fetched config); the server independently re-checks the pair against
  the same store, so a mismatched combination — verified with "Primary
  School" + "GCE A Level" — is rejected with `400` even if sent directly
  to the API.
- **Logical date validation**: both years must be well-formed 4-digit
  years within a sane range, end year can't precede start year, and an
  implausibly long span is flagged — verified against a live server for
  bad format, reversed years, and out-of-range years.
- **Save / Continue** as specified: each Add/Edit form has its own "Save"
  (persists that one record immediately — verified with an immediate
  follow-up fetch); a section-level "Continue" requires at least one
  saved record before proceeding to Application Summary.
- **Ownership enforced server-side**, not just hidden in the UI: edit and
  delete both resolve the target record only within the authenticated
  user's own records (`src/lib/education/store.ts`); a second applicant's
  attempt to edit or delete the first applicant's record returns `404`
  (not found, not "forbidden" — it doesn't even confirm the id exists),
  verified live with two separately-registered accounts.
- **Reuses, doesn't duplicate**: the existing session guard, the existing
  form primitives, the existing `globalThis`-backed-store pattern (same
  reasoning as `users.ts`/the demographic store), and the existing
  Topbar/page shell.

### Tested scenarios — education information

- ✅ Config endpoint returns all six school types with real per-item ids,
  including the exact qualification sets specified for Secondary School,
  High School, and Primary School
- ✅ Valid record creation succeeds; mismatched school-type/qualification
  pair rejected (`400`) even when sent directly to the API, bypassing the
  UI's own filtering
- ✅ Date logic: reversed years, non-numeric years, and out-of-range years
  all rejected with clear messages
- ✅ Multiple schools can be added; list, edit, and delete all confirmed
  against a live server, including an immediate re-fetch proving the edit
  actually persisted
- ✅ A second applicant cannot see, edit, or delete the first applicant's
  records — both return `404`, and the first applicant's data is
  unchanged afterward
- ✅ No session → `401` on both the records and config endpoints;
  authenticated non-STUDENT role → `403`

## What the Student Demographic Information module includes

- **All 25 specified fields**, organized into five sections (Identity,
  Contact, Disability, Origin & Residence, Personal, Parent/Guardian) on
  one form at `/student/application/demographic`
  (`src/components/demographic/DemographicForm.tsx`).
- **Email and Telephone are read from the real account, not re-entered or
  re-stored** — they come from `src/lib/auth/users.ts` (the same record
  created at registration), are rendered disabled with a lock icon, and
  the API strips those two keys from every request body server-side
  before touching the store — even a hand-crafted request can't change
  them through this endpoint. There is no second copy of email/phone
  anywhere in the demographic data.
- **Conditional field**: Disability Details only renders when Disability
  = Yes, and is only *required* at submit time under that same condition
  — enforced both client-side (for immediate feedback) and server-side
  (so the UI can't be bypassed).
- **Dependent dropdown**: Division of Origin's options are filtered to
  whichever Region of Origin is selected (all 10 Cameroon regions and
  their real administrative divisions, `src/lib/demographic/options.ts`);
  choosing a new region clears an incompatible division automatically,
  and the server independently re-checks the region/division pair rather
  than trusting the client's filtering.
- **Controlled dropdowns** for every field the spec calls out: Sex,
  Marital Status, Disability, Religion, Preferred Language, Country of
  Residence / Nationality / Parent's Country (shared list), Region and
  Division of Origin.
- **Save vs. Save & Continue**: Save persists whatever's filled in
  immediately, with no required-field gate (so genuinely partial progress
  is allowed) — but anything present still has to be well-formed (a
  junk-formatted parent email is rejected even as a draft). Save &
  Continue additionally requires every field the spec marks as needed and
  redirects to Application Summary on success.
- **Validation reuses existing validators** — parent email/phone use the
  exact same `validateEmail`/`validateMobileNumber` from
  `src/lib/validation.ts` used by registration, rather than a second
  implementation.
- **Real persistence, not client-side mock state** — `src/lib/demographic/store.ts`
  is a server-side, `globalThis`-backed store (the same pattern used for
  the user directory, for the same reason — see that file's comment), read
  and written only through `/api/student/demographic`, which resolves the
  applicant from the session cookie and never from anything the client
  sends. This is a deliberate change from the earlier wizard's
  localStorage-based `AppContext`, which this module does not use or
  extend.
- **Authorization reuses the existing session guard** (`getSessionUser`)
  — no new/parallel auth path. Verified: no session → 401; authenticated
  but non-STUDENT role → 403; one student's data is fully isolated from
  another's.
- **Database structure documented**, not invented as a one-off — `db/schema.sql`
  gained a `demographic_profiles` table with no email/phone columns, for
  the same reason the store doesn't duplicate them.

### Tested scenarios — demographic information

- ✅ Empty state correctly shows the real registered email/telephone,
  locked, with every other field blank
- ✅ Format validation catches an invalid parent email and a
  division/region mismatch on plain Save
- ✅ Valid partial Save succeeds with nothing else filled in, and is
  immediately confirmed persisted by a follow-up GET
- ✅ Save & Continue rejects an incomplete form, listing every missing
  required field
- ✅ Disability = Yes without Disability Details is rejected at submit
  time; providing details succeeds
- ✅ Attempting to send `email`/`telephone` in the request body is
  silently ignored — the account's real values are unchanged, while other
  legitimate fields in the same request still save
- ✅ No session → 401; institution-admin session → 403 (role check)
- ✅ A second, separately-registered student sees only their own
  (empty) profile and their own account's email — no cross-account leakage

## What the Student Dashboard and Process Flow module includes

- **Full navigation structure** (`src/lib/studentNav.ts`, rendered by
  `src/components/Sidebar.tsx`) — every item from the spec, grouped exactly
  as listed: top-level *Dashboard* and *The Process Flow*, then collapsible
  groups *My Application*, *My Institutions*, *My Application Fees*, and
  *View/Submit My Application*, each with its named children. The group
  containing the current page auto-expands; others start collapsed.
  *Notifications* and *Profile* (built in an earlier module) are kept as a
  separate utility section at the bottom rather than removed.
- **Responsive/mobile nav** — the sidebar is a fixed off-canvas drawer
  below the `lg` breakpoint (hamburger button + backdrop, both in
  `src/app/student/StudentShell.tsx`) and a static sticky sidebar at `lg`
  and above.
- **Dashboard** (`/student/dashboard`) shows, exactly as specified:
  applicant name (from the session), current step and a compact visual
  progress bar, number of institutions selected, total fees due, a status
  per selected institution, and an "actions required" list where each item
  links to where that action is actually done.
- **Process Flow page** (`/student/process-flow`) — the same five steps in
  full, each with its description and the named sub-tasks as clickable
  links, using the detailed variant of the same progress component.
- **Reusable progress component** (`src/components/ProcessProgress.tsx`) —
  one component, two variants (`compact` for the dashboard, `detailed` for
  the process-flow page), driven entirely by `src/lib/processFlow.ts`'s
  step definitions and an `ApplicantProcessProgress` value (current step +
  per-step status). Adding, renaming, or reordering steps means editing
  that one file.
- **Realistic mock data** (`src/lib/mockDashboard.ts`) — three institutions
  selected from the existing mock institution list, a status per one
  (SUBMITTED / COMPLETED / INCOMPLETE), a real fee total computed from
  those institutions' actual fee data, and a progress snapshot showing an
  applicant partway through Step 2. Shaped exactly like the real data will
  be, so swapping this for live state later is a data-source change, not a
  UI change.
- **Placeholder pages** for every nav destination not yet built
  (`ComingSoonPanel`, reused across 15 pages) — each is a real route that
  renders instead of 404ing, so the navigation is fully clickable end to
  end today even though most of what it points to doesn't exist yet.

### A note on the application wizard

An earlier module built a 7-step application wizard at
`/student/applications/*` (personal → education → examination →
institutions → documents → fees → review). This module's spec describes a
different information architecture — five steps, each broken into named
pages like *Demographic Information* or *Institution Summary* — so the new
sidebar follows that structure instead of linking to the old wizard. The
wizard still exists and still works at its old URL, but nothing in the new
nav points to it; it's effectively superseded, not deleted, pending a
future module that rebuilds *My Application* / *My Institutions* / *My
Application Fees* against the new IA. Flagging this now rather than
silently leaving two competing application flows in the codebase.

## What Student/Applicant registration includes

- **Registration page** — `/register`, public, three fields: Email address,
  Institution Type (dropdown: Secondary School / High School / University /
  Vocational School / Professional School), Mobile telephone number.
- **Server-side validation** for all three fields (`src/lib/validation.ts`,
  shared with the client form for matching UX): a real-looking email, a
  plausible international or local mobile number (8–15 digits, optional
  leading `+`), and a value from the fixed institution-type list. Invalid
  input never reaches account creation.
- **No duplicate accounts** — the register endpoint checks for an existing
  account by email *before* creating anything. If one exists (including
  one of the seeded demo accounts), it responds with a clear message and
  a "Go to sign in" link rather than creating a second account or failing
  silently.
- **Secure temporary login code** — generated with `node:crypto`'s CSPRNG,
  formatted as two 4-character groups (e.g. `K7H2-9F3D`) using an alphabet
  that excludes visually ambiguous characters (0/O, 1/I/L), and hashed with
  the same `scrypt` used for every other password before being stored —
  never kept in plaintext anywhere past the moment it's generated.
- **Simulated email + SMS delivery** — `src/lib/notifications/email.ts` and
  `sms.ts` log what would be sent and return a "preview" object. No real
  provider is connected yet, so the confirmation screen surfaces that
  preview directly, clearly labeled as a development stand-in — this is
  the only reason the temporary code is ever visible outside the hashed
  store. Swapping in a real provider (SES, Twilio, etc.) later means
  replacing the body of these two functions only.
- **Confirmation screen** — shows the exact required message verbatim:
  *"Congratulations, you have successfully registered on the Cheeta AOSA
  Platform. Please check your email for your login details and return to
  the platform to continue your school application process."*
- **Institution type carries into the account** — stored on the user
  record and surfaced in the session/profile (`institutionType`), ready
  for the future application module to key the applicant's experience off
  of. No application-form logic has been built against it yet.
- **Multiple applications per applicant** — already supported by the
  existing application data model (`AppContext.createApplication`), which
  appends a new `Application` record per call rather than limiting an
  account to one; registration doesn't change or constrain this.
- **Database structures** — `db/schema.sql` documents the target relational
  schema (`users`, `applicant_profiles`, `institution_staff_profiles`,
  `credential_deliveries`) that the current in-memory store is deliberately
  shaped to mirror, so swapping in a real database later is an
  implementation change, not a redesign.

## What the authentication foundation includes

- **Login** — `/login`, one shared form for all four roles; the server
  looks up the account, verifies the password, and redirects by role.
- **Logout** — clears the session cookie server-side (`POST /api/auth/logout`),
  reusable `<LogoutButton />`.
- **Session management** — signed, expiring session cookie (`aosa_session`,
  httpOnly, `sameSite=lax`, `secure` in production), 8-hour TTL. No server-side
  session store needed: the cookie itself is a tamper-evident, self-contained
  token (see "How sessions work" below).
- **Password recovery** — `/forgot-password` → `/reset-password?token=...`.
  Always responds with the same "if an account exists…" message regardless
  of whether the email is real, so the endpoint can't be used to enumerate
  accounts. There is no email service connected yet, so in development the
  reset link is shown directly on screen instead of being emailed — clearly
  labelled as a dev-only stand-in in the UI and in the API response.
- **Protected routes** — `/student/*`, `/institution/*`, `/admin/*` are each
  guarded twice: once by `src/proxy.ts` (Edge middleware/proxy, runs before
  any page code executes) and again by a server-side `requireRole()` check
  in each portal's `layout.tsx` (defense in depth). A logged-out visitor is
  redirected to `/login?next=<path>` and returned there after signing in.
- **Role-based access control** — four roles (`STUDENT`, `INSTITUTION_ADMIN`,
  `INSTITUTION_ADMISSION_USER`, `AOSA_ADMIN`), each confined to its own URL
  prefix. A student can never reach `/institution/*` or `/admin/*` by
  editing the URL — they're redirected back to their own portal home before
  any of that page's code runs. Same in every other direction.
- **Account status** — `ACTIVE` / `INACTIVE`. An inactive account is
  rejected at login with a clear message, so it never gets as far as
  receiving a session.
- **Authentication error handling** — invalid email and invalid password
  return the *same* generic "Incorrect email or password" message (no
  account enumeration); inactive accounts get a distinct, honest message;
  network/parsing failures are caught and shown inline on the form.
- **Password hashing** — Node's built-in `scrypt` (memory-hard KDF), random
  16-byte salt per password, stored as `salt:hash` — never plaintext,
  never a fast general-purpose hash like plain SHA-256.
- **Reusable components** — `LoginForm`, `ForgotPasswordForm`,
  `ResetPasswordForm`, `LogoutButton` in `src/components/auth/`.

### How sessions work

`aosa_session` is `base64url(payload) + "." + base64url(HMAC-SHA256 signature)`,
signed with a server secret (`SESSION_SECRET` env var — falls back to an
insecure dev default; **set a real one before deploying**). The payload
carries the user id, role, status, and expiry. Verifying it means
recomputing the signature and checking it matches — no database lookup
needed to know a request is authenticated, though `requireRole()` does
still look the user up server-side to catch a status change or role change
made *after* the token was issued.

The same signing code (`src/lib/auth/token.ts`) runs in both the Edge
proxy/middleware and the Node route handlers, built on the Web Crypto API
so it works in both runtimes. Password hashing (`src/lib/auth/password.ts`)
uses `node:crypto` and is deliberately kept out of anything the Edge
runtime touches.

## Tested scenarios — registration

- ✅ Successful registration → temporary code generated → login with that
  code succeeds → the *actual* Server-Component-guarded `/student/dashboard`
  renders (not just the API-level session check — see the bug note below)
- ✅ Invalid email, invalid mobile number, invalid/missing institution type
  → each rejected with a field-specific message, HTTP 400
- ✅ Duplicate email — both a just-registered address and a pre-seeded demo
  account — rejected with HTTP 409 and a "log in instead" path, no second
  account created
- ✅ Registration data (institution type, mobile number) correctly appears
  in the session (`/api/auth/session`) and the profile page afterward

**Bug found and fixed while testing this module:** the in-memory user
store was a plain module-level array. Next.js compiles Route Handlers and
Server Components into separate module graphs, which silently duplicated
that array into two unsynced copies — an account created via
`/api/auth/register` was visible to `/api/auth/login` and
`/api/auth/session` (both Route Handlers) but *not* to the Server Component
layout guarding `/student/dashboard`, which would redirect back to `/login`
even with a freshly-created, valid session. Fixed by keying the store off
`globalThis` (`src/lib/auth/users.ts`) so every module graph reads and
writes the same array. Confirmed fixed by re-running the exact
register → login → dashboard sequence end-to-end against a live server.

## Tested scenarios — authentication foundation

- ✅ Successful login for each of the four roles, correct redirect per role
- ✅ Invalid password / unknown email → identical generic error, HTTP 401
- ✅ Inactive account → blocked at login, HTTP 403, distinct message
- ✅ Logout clears the cookie; the same browser session can no longer reach
  a protected route afterwards
- ✅ Forgot password → reset link → old password stops working, new
  password logs in
- ✅ Protected route with no session → redirected to `/login?next=...`
- ✅ Protected route with a tampered session cookie → redirected to login
- ✅ Student → `/institution/*` and `/admin/*` → redirected to
  `/student/dashboard`, page never rendered
- ✅ Institution Admin / Admission User → `/admin/*` and `/student/*` →
  redirected to `/institution/dashboard`
- ✅ AOSA Admin → `/institution/*` → redirected to `/admin/dashboard`

## Tested scenarios — dashboard and process flow

- ✅ Dashboard renders applicant name, current step, compact progress bar,
  institutions-selected count, total fees, per-institution statuses, and
  actions required — verified against real rendered HTML from a live
  server, not just assumed from the code
- ✅ Process Flow page renders all 5 steps with correct titles, in order
- ✅ Every nav group auto-expands when one of its own pages is active, and
  stays collapsed otherwise (verified by loading `/student/institutions/summary`
  directly and confirming its group and only its group is expanded)
- ✅ All "actions required" links on the dashboard resolve to real pages
  (HTTP 200), not dead links
- ✅ All 15 placeholder destinations render the "not built yet" panel
  instead of 404ing
- ✅ Mobile hamburger button and off-canvas drawer markup present in the
  rendered output (`aria-label="Open menu"`, `translate-x-full` /
  `lg:translate-x-0` / `lg:sticky` classes)

## Not yet built

- The remaining 9 nav destinations behind the new Dashboard/Process-Flow
  IA — Application Summary (Demographic, Education, Examinations, Results,
  Application Fee Summary, and now Add Institution are real, see above),
  Institution Summary/Upload, View Payment Options, all four
  "Add ... Payment" pages, and Print/Submit My Application — are still
  placeholder pages only
- Institution Discovery's and Study Program Selection's backend: real
  institution/program data (not mock), persisting a selection into the
  actual application record, and reconciling "select an institution"/
  "select a program" here with the old application wizard's own
  institution-and-program-selection step — deliberately out of scope for
  these passes (frontend + mock data only, per their instructions)
- Examination Information's and Results Information's backend:
  config-driven validation, real persistence, linking an examination/result
  to a specific Education Information record, and reconciling the fact
  that Examination Information and Results Information are currently two
  independent local-state lists rather than one shared model — all
  deliberately out of scope for these passes (frontend + mock data only,
  per their instructions); the shared `EXAM_TYPE_CONFIGS` shape is meant
  to make that follow-up straightforward
- The Dashboard's institutions-selected/fees/status figures are still the
  realistic mock data from the previous module, not yet wired to real
  applicant state (out of scope for this module, which was demographic
  information only)
- Any application-experience logic that actually branches on
  `institutionType` — it's captured and stored, but nothing reads it yet
- Institution portal content beyond a guarded placeholder dashboard
- Admin portal content beyond a guarded placeholder dashboard
- A real database — `users.ts` is an in-memory (`globalThis`-backed) array
  and resets on restart; `db/schema.sql` documents the intended target
- Real email/SMS delivery — both are logged stand-ins (`src/lib/notifications/`)
  until a provider is connected
- Changing the temporary login code after first sign-in (no
  change-password screen yet)

## Project structure (auth-relevant parts)

```
db/schema.sql                     Target relational schema (see "database structures" above)
src/
  proxy.ts                        Edge route guard (was middleware.ts)
  lib/
    cookieStore.ts                 Generic signed-cookie persistence — cross-instance durability, see below
    validation.ts                 Isomorphic email/mobile/institution-type validators
    data.ts                       INSTITUTION_TYPES canonical list (+ mock institutions/programs)
    processFlow.ts                5-step process definitions, shared by Dashboard + Process Flow
    mockDashboard.ts              Realistic mock dashboard data (institutions, fees, statuses)
    studentNav.ts                 Single source of truth for the student sidebar structure
    countries/
      data.ts                     COUNTRIES — the one place a country list is defined
      getCountries.ts             Promise-returning, cached accessor — the future-backend seam
    currency/
      data.ts                     CURRENCIES, MOCK_EXCHANGE_RATES + formatAmount()/convertAmount()
      getCurrencies.ts             Promise-returning, cached accessor — for CurrencySelector only
    institutionDiscovery/
      data.ts                      Faculty→Department→Qualification→Program hierarchy, joined onto lib/data.ts institutions; also ProgramChoice type
    demographic/
      types.ts                   DemographicProfile shape (incl. countryOfBirth)
      options.ts                 Controlled dropdown lists (regions, divisions; COUNTRIES re-exported from lib/countries)
      validation.ts               Save (partial) vs. Submit (full) validation
      store.ts                    globalThis-backed server store, one row per applicant
    education/
      configTypes.ts              EducationLevelConfig / QualificationOption shape
      configStore.ts              globalThis-backed, admin-manageable school-type/qualification store
      types.ts                    EducationRecord shape (incl. country)
      validation.ts               Logical date checks + dependent school-type/qualification check
      store.ts                    globalThis-backed server store, many records per applicant
      cookieSync.ts                Cross-instance hydrate/persist helpers for education records
    examination/
      mockConfig.ts                Frontend-only mock exam-type config (subjects, grades, pass criteria)
    notifications/
      email.ts                    sendCredentialEmail() — logged stand-in
      sms.ts                      sendSms() — logged stand-in
    auth/
      roles.ts                    Role enum, portal prefixes, protected-route table
      password.ts                 scrypt hashing + generateTemporaryCode() — Node-only
      token.ts                    HMAC signing/verification — Edge-safe
      session.ts                  Session + reset token creation/reading
      users.ts                    In-memory user directory (mock DB), globalThis + cookie-backed
      guard.ts                    Server-side getSessionUser() / requireRole()
  app/
    api/
      auth/
        register/route.ts         Validates, creates account, dispatches email+SMS
        login/route.ts
        logout/route.ts
        session/route.ts          Used by the client AuthContext
        forgot-password/route.ts
        reset-password/route.ts
      config/
        education-levels/route.ts GET — configurable school types + qualifications
      student/
        demographic/route.ts      GET/POST — session-scoped, cross-instance cookie fallback
        education/route.ts        GET (list) / POST (create), session-scoped
        education/[id]/route.ts   PATCH / DELETE, ownership-checked
    register/page.tsx
    login/page.tsx
    forgot-password/page.tsx
    reset-password/page.tsx
    unauthorized/page.tsx         Shown when role doesn't match the portal
    student/
      layout.tsx                 requireRole(["STUDENT"])
      dashboard/page.tsx
      process-flow/page.tsx
      application/demographic/page.tsx    Real
      application/education/page.tsx      Real
      application/examinations/page.tsx   Real (frontend-only)
      application/results/page.tsx        Real (frontend-only) — everything else under application/ is still a placeholder
      fees/summary/page.tsx                Real — currency-aware fee display; everything else under fees/ is still a placeholder
      institutions/add/page.tsx            Real — browse/search/filter/select; Summary/Upload still placeholders
    institution/layout.tsx        requireRole(["INSTITUTION_ADMIN","INSTITUTION_ADMISSION_USER"])
    admin/layout.tsx              requireRole(["AOSA_ADMIN"])
  components/
    CountrySelect.tsx              The one reusable country combobox
    currency/
      CurrencySelector.tsx          Searchable currency combobox
      CurrencySymbol.tsx / CurrencyCode.tsx / FormattedCurrencyAmount.tsx
      ConvertedAmount.tsx / ExchangeRateInfo.tsx
    fees/FeeSummary.tsx             Demonstrates all 6 currency components against real mock fee data
    institutions/
      InstitutionDiscovery.tsx      Browse/search/filter/select — main container
      InstitutionCard.tsx / InstitutionDetail.tsx
      StudyProgramSelector.tsx      Faculty→Department→Qualification→Program, ranked choices
    demographic/DemographicForm.tsx
    education/EducationForm.tsx    Add/edit/delete + table, config-driven dropdowns
    examination/ExaminationForm.tsx Frontend-only, mock-config-driven
    results/ResultsForm.tsx         Frontend-only, computed Pass/Fail
    ProcessProgress.tsx            Reusable compact/detailed step visualizer
    Sidebar.tsx                    Grouped, responsive student nav (STUDENT_NAV-driven)
  components/auth/
    RegisterForm.tsx
    LoginForm.tsx
    ForgotPasswordForm.tsx
    ResetPasswordForm.tsx
    LogoutButton.tsx
  context/AuthContext.tsx         Client-side "who am I" + logout, backed by /api/auth/session
```
