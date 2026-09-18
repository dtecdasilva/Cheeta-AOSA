-- Cheeta AOSA Platform — authentication & registration schema
-- =============================================================
-- This is the schema the current in-memory mock (src/lib/auth/users.ts)
-- is deliberately shaped to mirror, so that swapping the mock for a real
-- database later is a matter of implementing these queries, not
-- redesigning the data model. No database is actually connected in this
-- module — this file is the intended target, written and reviewable now
-- rather than deferred to whenever persistence gets built.
--
-- Written for PostgreSQL syntax; the shapes translate directly to MySQL
-- or SQLite with minor type substitutions (UUID -> CHAR(36), etc.).

CREATE TABLE users (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email               CITEXT NOT NULL UNIQUE,       -- case-insensitive uniqueness
    password_hash       TEXT NOT NULL,                 -- "salt:hash", scrypt — never plaintext
    full_name           TEXT NOT NULL,
    role                TEXT NOT NULL CHECK (
                            role IN ('STUDENT', 'INSTITUTION_ADMIN',
                                     'INSTITUTION_ADMISSION_USER', 'AOSA_ADMIN')
                        ),
    status              TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One row per STUDENT user, holding registration-time data that doesn't
-- apply to institution/admin accounts. Kept as a separate 1:1 table
-- rather than nullable columns on `users` so the base identity table
-- stays role-agnostic as more roles are added later.
CREATE TABLE applicant_profiles (
    user_id             UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    institution_type    TEXT NOT NULL CHECK (
                            institution_type IN ('Secondary School', 'High School',
                                'University', 'Vocational School', 'Professional School')
                        ),
    mobile_number       TEXT NOT NULL,                 -- E.164-normalized at write time
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One row per institution-side account (both INSTITUTION_ADMIN and
-- INSTITUTION_ADMISSION_USER), linking them to the institution they
-- belong to. Institutions themselves are out of scope for this module.
CREATE TABLE institution_staff_profiles (
    user_id             UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    institution_id      UUID NOT NULL,                 -- FK to a future institutions table
    institution_name    TEXT NOT NULL                  -- denormalized for display; source of truth is institutions table
);

-- Audit trail for every credential/notification dispatch — registration
-- email + SMS, password-reset emails, etc. Lets support answer "did the
-- applicant actually get their code" without touching the email/SMS
-- provider's own logs. `provider_ref` holds whatever message id a real
-- provider (SES, Twilio, ...) returns once one is wired up.
CREATE TABLE credential_deliveries (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    channel             TEXT NOT NULL CHECK (channel IN ('EMAIL', 'SMS')),
    purpose             TEXT NOT NULL CHECK (purpose IN ('REGISTRATION', 'PASSWORD_RESET')),
    destination         TEXT NOT NULL,                 -- email address or phone number
    status              TEXT NOT NULL DEFAULT 'SENT' CHECK (status IN ('SENT', 'FAILED')),
    provider_ref        TEXT,
    sent_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_credential_deliveries_user ON credential_deliveries(user_id);

-- Cheeta Academia Online — Education Information module
-- =============================================================
-- Configurable school types and their valid qualifications. This is the
-- data an Admin "Parameters" module will manage (add a qualification,
-- rename a level, etc.) — the frontend has no hard-coded qualification
-- list anywhere; it always reads from here (via /api/config/education-levels).
-- The in-memory mock this mirrors is src/lib/education/configStore.ts.
CREATE TABLE education_levels (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL UNIQUE,     -- e.g. 'Secondary School'
    sort_order  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE education_qualifications (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    education_level_id UUID NOT NULL REFERENCES education_levels(id) ON DELETE CASCADE,
    label              TEXT NOT NULL      -- e.g. 'GCE O Level'
);

CREATE INDEX idx_education_qualifications_level ON education_qualifications(education_level_id);

-- One row per school an applicant has attended. `school_type` and
-- `qualification` are validated at the application layer against
-- education_levels/education_qualifications above — not constrained here
-- with a foreign key to a label column, since qualification labels aren't
-- guaranteed globally unique across levels (kept simple; a stricter schema
-- could reference education_qualifications.id instead once this is wired
-- to a real database).
CREATE TABLE education_records (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    start_year     SMALLINT NOT NULL,
    end_year       SMALLINT NOT NULL CHECK (end_year >= start_year),
    school_name    TEXT NOT NULL,
    country        TEXT NOT NULL,
    school_type    TEXT NOT NULL,
    qualification  TEXT NOT NULL,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_education_records_user ON education_records(user_id);

-- Cheeta Academia Online — Student Demographic Information module
-- =================================================================
-- One row per applicant, holding the "Demographic Information" form data.
-- Deliberately does NOT repeat email or telephone: those live on `users`
-- (email) and `applicant_profiles` (mobile_number) and are read from there
-- at request time — this table is not a second source of truth for either.
-- The in-memory mock this mirrors is src/lib/demographic/store.ts.
CREATE TABLE demographic_profiles (
    user_id                         UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    full_name_on_birth_certificate  TEXT NOT NULL,
    date_of_birth                   DATE NOT NULL,
    place_of_birth                  TEXT NOT NULL,
    country_of_birth                TEXT NOT NULL,
    po_box                          TEXT,
    alternative_telephone           TEXT,
    disability                      TEXT NOT NULL CHECK (disability IN ('Yes', 'No')),
    disability_details              TEXT,              -- required at the application layer when disability = 'Yes'
    country_of_residence            TEXT NOT NULL,
    nationality                     TEXT NOT NULL,
    region_of_origin                TEXT NOT NULL,
    division_of_origin              TEXT NOT NULL,      -- validated against region_of_origin at the application layer
    town_of_residence               TEXT NOT NULL,
    religion                        TEXT NOT NULL,
    marital_status                  TEXT NOT NULL,
    sex                              TEXT NOT NULL CHECK (sex IN ('Male', 'Female')),
    fathers_names                   TEXT NOT NULL,
    mothers_names                   TEXT NOT NULL,
    parents_country                 TEXT,
    parents_town_city               TEXT,
    parents_address                 TEXT,
    parents_occupation              TEXT,
    parents_telephone                TEXT,
    parents_email                    TEXT,
    preferred_language               TEXT NOT NULL,
    updated_at                      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Session and password-reset tokens are NOT stored in the database: both
-- are self-contained, signed (HMAC-SHA256) tokens verified by recomputing
-- the signature (see src/lib/auth/token.ts). This keeps auth stateless and
-- horizontally scalable without a sessions table or a token-blacklist
-- table. If token *revocation before expiry* is ever needed (e.g. "log
-- out all devices"), that would call for a small `revoked_tokens(jti)`
-- table checked at verification time — not needed yet.

-- Cheeta Academia Online — Currency display system
-- =============================================================
-- Configurable currencies and exchange rates. The in-memory mock this
-- mirrors is src/lib/currency/data.ts. `exchange_rates` is intentionally
-- separate from `currencies` (rather than a column on it) since rates
-- change over time and a real integration would insert a new row per
-- update rather than overwrite one, preserving history.
CREATE TABLE currencies (
    code             CHAR(3) PRIMARY KEY,     -- ISO 4217, e.g. 'XAF'
    symbol           TEXT NOT NULL,
    name             TEXT NOT NULL,
    decimal_digits   SMALLINT NOT NULL DEFAULT 2,
    symbol_position  TEXT NOT NULL DEFAULT 'prefix' CHECK (symbol_position IN ('prefix', 'suffix'))
);

-- One row per (currency, as-of-date) — xaf_per_unit expresses the rate
-- against the platform's base currency (XAF), the same pivot
-- src/lib/currency/data.ts's convertAmount() uses. "Do not implement live
-- exchange-rate APIs" means this table would be populated by hand or by a
-- scheduled job reading a real rate provider, not fetched per-request.
CREATE TABLE exchange_rates (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    currency_code  CHAR(3) NOT NULL REFERENCES currencies(code) ON DELETE CASCADE,
    xaf_per_unit   NUMERIC(14, 6) NOT NULL,
    as_of          DATE NOT NULL,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_exchange_rates_currency_asof ON exchange_rates(currency_code, as_of DESC);
