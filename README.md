# Support Ticket & SLA

A full-stack support-ticket application that lets reporters create and track tickets while agents triage, respond to, and resolve them. The system calculates first-response and resolution SLAs using business hours, weekends, and configured holidays.

## Features

- JWT-based registration and login for `REPORTER` and `AGENT` users
- Ticket creation, assignment, status updates, comments, and resolution
- First-response tracking: the first comment from someone other than the reporter starts the response record
- SLA states (`ON_TRACK`, `AT_RISK`, and `BREACHED`) for first response and resolution
- Business-hour calculations (9:00–18:00, Monday–Friday) that exclude weekends and holidays
- Ticket filtering and cursor pagination through GraphQL
- Dashboard counts for open, in-progress, at-risk, and breached tickets
- React frontend with protected routes, ticket views, dashboard, and authentication screens

## Tech stack

- **Backend:** Bun, TypeScript, GraphQL Yoga, Prisma, PostgreSQL
- **Frontend:** React, TypeScript, Vite, React Router
- **Authentication:** JSON Web Tokens and bcrypt password hashing
- **Date/time:** Luxon

## Prerequisites

- [Bun](https://bun.sh/) 1.x or later
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (recommended for PostgreSQL)

## Getting started

1. Install backend dependencies:

   ```bash
   bun install
   ```

2. Install frontend dependencies:

   ```bash
   cd frontend
   bun install
   cd ..
   ```

3. Create your local environment file:

   ```bash
   cp .env.example .env
   ```

   On PowerShell, use:

   ```powershell
   Copy-Item .env.example .env
   ```

4. Start PostgreSQL:

   ```bash
   docker compose up -d
   ```

5. Create the database schema and generate the Prisma client:

   ```bash
   bun run gendb
   ```

6. Optionally load sample users, tickets, and a holiday:

   ```bash
   bun run seed
   ```

7. Start the backend in one terminal:

   ```bash
   bun run dev
   ```

8. Start the frontend in another terminal:

   ```bash
   cd frontend
   bun run dev
   ```

Open the frontend at `http://localhost:5173`. The GraphQL endpoint and interactive API interface are available at `http://localhost:4000/graphql`.

## Environment variables

Copy `.env.example` to `.env` and adjust values as needed.

| Variable | Purpose | Default example |
| --- | --- | --- |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://postgres:postgres@localhost:5432/support_ticket_sla` |
| `JWT_SECRET` | Secret used to sign access tokens | Replace with a long random value |
| `BUSINESS_TIMEZONE` | IANA timezone for SLA calculations | `Asia/Kolkata` |
| `PORT` | Backend HTTP port | `4000` |

Use a unique, secure `JWT_SECRET` outside local development.

## Sample accounts

Running `bun run seed` creates these users, both with password `password123`:

| Role | Email |
| --- | --- |
| Reporter | `reporter@example.com` |
| Agent | `agent@example.com` |

## SLA policy

The default SLA clock runs only during business hours: 09:00–18:00 on weekdays in `BUSINESS_TIMEZONE`. Holidays stored in the database are also excluded.

| Priority | First response | Resolution |
| --- | ---: | ---: |
| Urgent | 1 business hour | 4 business hours |
| High | 4 business hours | 24 business hours |
| Medium | 8 business hours | 48 business hours |
| Low | 24 business hours | 72 business hours |

## GraphQL API

The schema is defined in [`src/graphql/schema/schema.graphql`](src/graphql/schema/schema.graphql). Major operations include:

```graphql
mutation Register($name: String!, $email: String!, $password: String!, $role: UserRole!) {
  register(name: $name, email: $email, password: $password, role: $role) {
    token
    user { id name email role }
  }
}

mutation CreateTicket($title: String!, $description: String!, $priority: Priority!) {
  createTicket(title: $title, description: $description, priority: $priority) {
    id
    title
    status
    sla { firstResponseState resolutionState }
  }
}

query Tickets {
  tickets(take: 20) {
    nodes {
      id
      title
      priority
      status
      sla { firstResponseDueAt resolutionDueAt }
    }
    pageInfo { hasNextPage endCursor }
  }
}
```

For authenticated operations, include an `Authorization: Bearer <token>` request header.

## Scripts

Run these commands from the repository root unless noted otherwise.

| Command | Description |
| --- | --- |
| `bun run dev` | Run the backend with file watching |
| `bun run typecheck` | Type-check the backend without emitting files |
| `bun test` | Run unit and integration tests |
| `bun run gendb` | Apply Prisma migrations during development |
| `bun run seed` | Load sample users, tickets, and a holiday |
| `bun run studio` | Open Prisma Studio |
| `cd frontend && bun run dev` | Run the Vite frontend |
| `cd frontend && bun run build` | Type-check and build the frontend |
| `cd frontend && bun run lint` | Lint the frontend |

## Project structure

```text
src/
  graphql/          GraphQL schema, resolvers, context, and errors
  services/         SLA, ticket-workflow, and authentication logic
  repositories/     Prisma data-access layer
  validation/       Input validation
  db/               Prisma client setup
prisma/             Database schema, migrations, and seed data
frontend/           React/Vite web application
tests/              Unit and integration tests
```

## Testing

Unit tests cover SLA math, business-hour behavior, ticket status transitions, and first-response detection. The integration test uses the configured PostgreSQL database, so start the database and apply migrations before running the full test suite:

```bash
docker compose up -d
bun run gendb
bun test
```
