# Support Ticket & SLA Tracker

A support ticket tracking system with automatic SLA (Service Level Agreement) deadline calculation based on **business hours only** — nights, weekends, and configured holidays never count against an SLA clock.

## Project Overview

Users (reporters) can raise support tickets. Agents can assign, work on, and resolve tickets. Every ticket automatically gets a first-response deadline and a resolution deadline, calculated purely in business hours (Mon–Fri, 09:00–18:00, configurable timezone). Each SLA clock tracks whether it's `ON_TRACK`, `AT_RISK`, or `BREACHED`, and freezes permanently once the relevant event (first response / resolution) actually happens.

## Tech Stack

- **Runtime/Language:** Bun + TypeScript (strict mode, no `any`)
- **API:** GraphQL Yoga, schema-first (`.graphql` files + separate TypeScript resolvers)
- **Database:** PostgreSQL (via Docker Compose) + Prisma ORM
- **Auth:** JWT + bcrypt password hashing
- **Frontend:** React + TypeScript (Vite), React Router
- **Testing:** Bun's built-in test runner — unit tests + one integration test against real Postgres

## Architecture Overview

```
src/
  graphql/
    schema/schema.graphql   # single source of truth for the API shape
    resolvers/               # thin resolvers — call services/repositories, no business logic
    context.ts               # builds per-request context (decodes JWT -> currentUser)
    errors.ts                # typed error codes (VALIDATION_ERROR, UNAUTHORIZED, etc.)
  services/
    sla/                     # business-hours engine — pure functions, zero DB/GraphQL dependencies
      businessHours.ts       # addBusinessHours, businessMinutesBetween
      policies.ts            # priority -> SLA hours lookup table
      calculateSLA.ts        # combines the above into due dates + states
    ticket/
      statusTransitions.ts   # allowed status transition table + validator
      firstResponse.ts       # "is this comment the first response?" logic
      dashboard.ts            # dashboard stat aggregation
    auth/
      password.ts             # bcrypt wrappers
      jwt.ts                  # sign/verify JWT
      authorize.ts             # requireAuth / requireRole helpers
  repositories/               # ONLY layer that talks to Prisma directly
  validation/                 # input validation, throws typed errors
  db/client.ts                # single shared Prisma Client instance
  server.ts                   # wires schema + resolvers + context, starts Yoga

prisma/
  schema.prisma
  migrations/
  seed.ts

tests/
  unit/                       # SLA engine, status transitions, first-response logic
  integration/                # real Postgres, full ticket/comment/SLA flow

frontend/
  src/
    api/                      # typed GraphQL client (fetch-based, no Apollo)
    auth/AuthContext.tsx      # login/register/logout, token + user persisted to localStorage
    pages/                    # Login, Register, TicketList, TicketDetail, CreateTicket, Dashboard
    components/               # SLABadge, ProtectedRoute
```

**Core principle:** GraphQL resolvers are intentionally thin. They authenticate/authorize, call a repository or service, and return the result. All business logic (SLA math, transition rules, first-response detection) lives in `src/services/`, completely decoupled from GraphQL and — for the SLA engine specifically — from the database too. This is what makes the SLA engine unit-testable with zero mocking.

## Database Schema Overview

Four core models:

- **User** — `id, name, email (unique), password (bcrypt hash), role (REPORTER | AGENT), createdAt`
- **Ticket** — `id, title, description, priority, status, reporterId (required), assigneeId (optional), createdAt, firstResponseAt (nullable), resolvedAt (nullable)`
  - `reporter` and `assignee` are two separate named relations to `User` (`ReportedTickets` / `AssignedTickets`), since both foreign keys point to the same table
  - Indexed on `status`, `priority`, `assigneeId`, `createdAt` — matching the commonly-filtered/sorted fields in the `tickets` query
- **Comment** — `id, content, ticketId, authorId, createdAt`
- **Holiday** — `id, date (date-only, not datetime), name`, unique on `date`

SLA state (`ON_TRACK`/`AT_RISK`/`BREACHED`) is **never stored** — it's computed on every read from `createdAt`, `firstResponseAt`, `resolvedAt`, the ticket's priority, and the current holiday calendar. This guarantees SLA state is always consistent with the latest holiday configuration and current time, with no risk of a stored value going stale.

## SLA Calculation Approach

### Business hours engine

Two core functions in `src/services/sla/businessHours.ts`:

- **`addBusinessHours(start, hours, holidays)`** — walks forward day by day from `start`, consuming the requested business hours, skipping weekends and holidays entirely, and correctly handling the "created outside business hours" edge case (before 09:00 → starts counting at 09:00; after 18:00 → rolls to next business day's 09:00).
- **`businessMinutesBetween(from, to, holidays)`** — the inverse operation: computes how many business minutes elapsed between two timestamps. Used both for "remaining time" display and for the AT_RISK percentage calculation. Verified to be a true mathematical inverse of `addBusinessHours` via dedicated tests.

Both use [Luxon](https://moment.github.io/luxon/) for timezone-aware date arithmetic, converting UTC timestamps into the configured `BUSINESS_TIMEZONE` before doing any day/hour math, then converting results back to UTC for storage.

### SLA policies (default, per the assignment spec)

| Priority | First Response | Resolution |
|---|---|---|
| URGENT | 1 business hour | 4 business hours |
| HIGH | 4 business hours | 24 business hours |
| MEDIUM | 8 business hours | 48 business hours |
| LOW | 24 business hours | 72 business hours |

### SLA state and the 75% boundary

- **ON_TRACK**: 0%–75% of the SLA budget consumed (inclusive of 75% exactly — the boundary condition is `> 75%` triggers AT_RISK, so exactly 75% is still ON_TRACK)
- **AT_RISK**: more than 75% of budget consumed, deadline not yet passed
- **BREACHED**: current time (or completion time) is at or past the deadline — checked *before* the percentage math, so a ticket at 100%+ elapsed is always BREACHED, never miscategorized as AT_RISK

### Clock freezing

Once `firstResponseAt` (or `resolvedAt`) is set, that SLA clock is evaluated **at that fixed historical timestamp**, not against "now." This means a first response that happened on time stays `ON_TRACK` forever, even if the ticket remains open for days afterward. A response that happened *after* the deadline had already passed freezes as `BREACHED` — completion doesn't retroactively "forgive" a genuine breach. The same `evaluateClock` function handles both live and frozen clocks; only the anchor timestamp differs (`now` vs. the actual completion time).

### First response detection

The first comment authored by anyone **other than the ticket's reporter** is recorded as the first response, only if no first response has been recorded yet. This is a stateless check performed at comment-creation time (not a historical scan), based on: is the author the reporter? Has `firstResponseAt` already been set?

## Status Transition Rules

```
OPEN → IN_PROGRESS
IN_PROGRESS → RESOLVED | OPEN
RESOLVED → CLOSED | OPEN
CLOSED → OPEN
```

**Rule:** resolved or closed tickets can only reopen by moving explicitly back to `OPEN` — they can never jump directly back to `IN_PROGRESS`. This is a single, consistent rule (not a special case only for `CLOSED`) that matches the assignment's explicit example: `CLOSED → IN_PROGRESS` is rejected unless the ticket is first reopened via `CLOSED → OPEN`.

All transitions are validated server-side in `src/services/ticket/statusTransitions.ts`, fully isolated from GraphQL/database concerns and covered by unit tests for every allowed and forbidden transition.

## Authentication Approach

- Passwords hashed with **bcrypt** (10 salt rounds), never stored or logged in plain text
- On successful `register`/`login`, a **JWT** is issued (7-day expiry) containing `userId` and `role`
- The frontend sends the token as `Authorization: Bearer <token>` on every request
- The backend decodes the token per-request into a GraphQL context (`src/graphql/context.ts`); resolvers call `requireAuth()` or `requireRole(context, 'AGENT')` to enforce access
- Login/register failures return an identical error message regardless of whether the email exists or the password is wrong, to avoid user enumeration
- Any authenticated user can create tickets and comment; only `AGENT` role can assign, change status, or resolve tickets

## Environment Variables

See `.env.example`:

```
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/support_ticket_sla"
JWT_SECRET="replace-this-with-a-long-random-string-in-your-real-env"
BUSINESS_TIMEZONE="Asia/Kolkata"
PORT=4000
```

## Setup Instructions

```bash
# 1. Clone and enter the repo
git clone <repo-url>
cd support-ticket-sla

# 2. Copy env template and fill in a real JWT_SECRET (e.g. `openssl rand -hex 32`)
cp .env.example .env

# 3. Start Postgres
docker compose up -d

# 4. Install backend dependencies
bun install

# 5. Run migrations
bun run gendb

# 6. Seed sample data
bun run seed

# 7. Start the backend
bun run dev
# GraphQL Playground at http://localhost:4000/graphql
```

## Frontend Setup

```bash
cd frontend
bun install
bun run dev
# App at http://localhost:5173
```

Run both the backend and frontend dev servers simultaneously (separate terminals) for the full app to work.

## Database Migration Instructions

Migrations are managed via `prisma migrate dev` and committed to `prisma/migrations/`. To apply migrations on a fresh database:

```bash
bun run gendb
```

To inspect the database visually:

```bash
bunx prisma studio
```

## Seed Instructions

```bash
bun run seed
```

Creates:
- `reporter@example.com` / `password123` (REPORTER)
- `agent@example.com` / `password123` (AGENT)
- One sample holiday (2026-08-15, Independence Day)
- Four sample tickets, one per priority level

## Running Tests

```bash
bun run typecheck   # strict TypeScript check
bun test            # all unit + integration tests (requires Postgres running via docker compose)
```

32 tests total: unit coverage for the business-hours engine (weekday/weekend/holiday/multi-day-crossing edge cases), SLA state transitions (ON_TRACK/AT_RISK/BREACHED, freeze-on-completion), status transition rules, and first-response detection — plus one integration test exercising the full create-ticket → comment → first-response → SLA-persistence flow against a real Postgres database.

## Example GraphQL Queries/Mutations

**Register and log in:**
```graphql
mutation {
  register(name: "Jane Doe", email: "jane@example.com", password: "password123", role: REPORTER) {
    token
    user { id name role }
  }
}
```

**Create a ticket (requires Authorization header):**
```graphql
mutation {
  createTicket(title: "Login broken", description: "Users can't sign in", priority: URGENT) {
    id
    sla { firstResponseDueAt firstResponseState firstResponseRemainingMinutes }
  }
}
```

**List tickets with filters and pagination:**
```graphql
query {
  tickets(status: OPEN, slaState: AT_RISK, take: 10) {
    nodes { id title priority sla { resolutionState } }
    pageInfo { hasNextPage endCursor }
  }
}
```

**Dashboard summary:**
```graphql
query {
  dashboard { openTickets inProgressTickets atRiskTickets breachedTickets }
}
```

## Tradeoffs and Known Limitations

- **SLA state filtering happens in application code, not SQL** — since SLA state is computed, not a stored column, filtering by `slaState` fetches a broader set of DB-filterable results and filters/paginates in memory. Fine at this data scale; would need a periodically-recomputed indexed column for production scale.
- **Prisma 7 driver-adapter workaround:** `@prisma/adapter-pg` (a very recently released major version) has a known bug where write operations combined with `include` can corrupt results under concurrent query execution on a single connection (see [prisma/prisma#29407](https://github.com/prisma/prisma)). Worked around by splitting writes and relation-fetching reads into two sequential operations across all repositories, rather than using Prisma's combined `update({ ..., include })` pattern.
- **No SLA pause functionality** — a ticket's SLA clock runs continuously once created; there's no "waiting on customer" pause state (see below).
- **Bleeding-edge dependency versions:** Prisma 7 and TypeScript 7 were released very recently at the time of building this, meaning some tutorials/community knowledge didn't yet reflect current APIs (e.g., `prisma.config.ts` for datasource URLs, explicit generator `output` paths, required driver adapters). Debugging these required reading current docs and GitHub issues directly rather than relying on cached knowledge.

## How I'd Extend This

- **SLA pause while `WAITING_ON_CUSTOMER`** — add a ticket status that stops the SLA clock, storing cumulative "paused" business minutes to subtract from elapsed time
- **Escalation rules and notifications** — auto-notify a team lead when a ticket crosses into AT_RISK or BREACHED
- **Audit log** — track every status/assignee change with who/when, not just the current state
- **Per-team business calendars** — different teams (e.g., regional support) with different business hours/holidays
- **Agent performance metrics** — average first-response time, resolution time, breach rate per agent
- **Recurring holidays** — currently each holiday is a single date; recurring annual holidays would need a separate recurrence rule
- **Live-updating countdown** on the frontend (currently requires a manual refresh to see updated remaining-time values)
- **CI pipeline** running typecheck + tests on every push

## License

This project is licensed under the [MIT License](LICENSE).
