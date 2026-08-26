# Support Ticket & SLA

A full-stack support-ticket application. Reporters can create and track tickets; agents can assign, manage, and resolve them. First-response and resolution SLAs account for business hours, weekends, and configured holidays.

## Features

- JWT-based registration and login for `REPORTER` and `AGENT` users
- Ticket creation, assignment, agent-managed status updates, comments, and resolution
- First-response tracking when someone other than the reporter comments on a ticket
- SLA states: `ON_TRACK`, `AT_RISK`, and `BREACHED`
- SLA calculations for 09:00-18:00 Monday-Friday, excluding holidays
- Ticket filtering and cursor pagination through GraphQL
- Dashboard totals for open, in-progress, at-risk, and breached tickets
- React frontend with protected ticket, dashboard, and authentication views

## Tech stack

- Backend: Bun, TypeScript, GraphQL Yoga, Prisma, PostgreSQL
- Frontend: React, TypeScript, Vite, React Router
- Authentication: JSON Web Tokens and bcrypt
- Date/time: Luxon

## Prerequisites

- [Bun](https://bun.sh/) 1.x or later
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (recommended for local PostgreSQL)

## Getting started

1. Install dependencies:

   ```bash
   bun install
   cd frontend && bun install && cd ..
   ```

2. Create the local environment file:

   ```bash
   cp .env.example .env
   ```

   In PowerShell:

   ```powershell
   Copy-Item .env.example .env
   ```

3. Start PostgreSQL and apply the database migration:

   ```bash
   docker compose up -d
   bun run gendb
   ```

4. Optionally load sample users, tickets, and a holiday:

   ```bash
   bun run seed
   ```

5. Start the backend:

   ```bash
   bun run dev
   ```

6. In another terminal, start the frontend:

   ```bash
   cd frontend
   bun run dev
   ```

The frontend runs at `http://localhost:5173`. The GraphQL endpoint and interactive API interface are at `http://localhost:4000/graphql`.

## Environment variables

Copy `.env.example` to `.env` and adjust values as needed.

| Variable | Purpose | Example |
| --- | --- | --- |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://postgres:postgres@localhost:5432/support_ticket_sla` |
| `JWT_SECRET` | Secret used to sign access tokens | Use a long, random value |
| `BUSINESS_TIMEZONE` | IANA timezone for SLA calculations | `Asia/Kolkata` |
| `PORT` | Backend HTTP port | `4000` |

Use a unique, secure `JWT_SECRET` outside local development.

## Sample accounts

`bun run seed` creates the following accounts; each uses password `password123`.

| Role | Email |
| --- | --- |
| Reporter | `reporter@example.com` |
| Agent | `agent@example.com` |

## SLA policy

The default SLA clock runs from 09:00 to 18:00 on weekdays in `BUSINESS_TIMEZONE`. Stored holidays are excluded.

| Priority | First response | Resolution |
| --- | ---: | ---: |
| Urgent | 1 business hour | 4 business hours |
| High | 4 business hours | 24 business hours |
| Medium | 8 business hours | 48 business hours |
| Low | 24 business hours | 72 business hours |

## GraphQL API

The complete API contract is in [`src/graphql/schema/schema.graphql`](src/graphql/schema/schema.graphql). Main operations include:

- Queries: `tickets`, `ticket`, `dashboard`, `users`, `holidays`
- Authentication mutations: `register`, `login`
- Ticket mutations: `createTicket`, `assignTicket`, `changeTicketStatus`, `addComment`, `resolveTicket`

Example ticket query:

```graphql
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

For operations that require authentication, send `Authorization: Bearer <token>`.

## Scripts

Run these from the repository root unless noted otherwise.

| Command | Description |
| --- | --- |
| `bun run dev` | Run the backend with file watching |
| `bun run typecheck` | Type-check the backend |
| `bun test` | Run unit and integration tests |
| `bun run gendb` | Run `prisma migrate dev` for local development |
| `bun run seed` | Load sample data |
| `bun run studio` | Open Prisma Studio |
| `cd frontend && bun run dev` | Run the Vite frontend |
| `cd frontend && bun run build` | Type-check and build the frontend |
| `cd frontend && bun run lint` | Lint the frontend |

## Project structure

```text
src/
  graphql/          Schema, resolvers, context, and errors
  services/         SLA, ticket-workflow, and authentication logic
  repositories/     Prisma data access
  validation/       Input validation
  db/               Prisma client setup
prisma/             Database schema, migrations, and seed data
frontend/           React/Vite application
tests/              Unit and integration tests
```

## Testing

Unit tests cover business-hour calculations, SLA calculations, ticket status transitions, and first-response detection. The integration test uses the configured PostgreSQL database, so start it and apply migrations first:

```bash
docker compose up -d
bun run gendb
bun test
```
