# Implementation Walkthrough

This document accompanies the screen recording and explains the implementation choices, edge cases, and tradeoffs in the Support Ticket & SLA Tracker.

## Purpose and user roles

The application manages support tickets and measures two service-level agreements (SLAs): the time to the first response and the time to resolution.

It supports two roles:

- **Reporter:** can register, log in, create tickets, and add comments.
- **Agent:** can assign tickets, change their status, respond to them, and resolve them.

The backend enforces those permissions. An Agent-only action cannot be performed merely by bypassing the frontend.

## Ticket lifecycle

A ticket contains a title, description, priority, reporter, optional assignee, status, comments, and timestamps for the first response and resolution.

The allowed status transitions are enforced on the server:

```text
OPEN -> IN_PROGRESS
IN_PROGRESS -> RESOLVED or OPEN
RESOLVED -> CLOSED or OPEN
CLOSED -> OPEN
```

For example, a ticket cannot move directly from `OPEN` to `RESOLVED`. Keeping these rules in a dedicated service means every client of the GraphQL API receives the same validation.

## SLA rules

Each priority has a first-response and resolution target:

| Priority | First response | Resolution |
| --- | ---: | ---: |
| Urgent | 1 business hour | 4 business hours |
| High | 4 business hours | 24 business hours |
| Medium | 8 business hours | 48 business hours |
| Low | 24 business hours | 72 business hours |

SLA time is calculated only within configured business hours: Monday through Friday, 09:00-18:00, in the configured timezone. Weekends and holidays stored in the database are excluded.

This handles important edge cases. A ticket created before 09:00 begins its SLA clock at 09:00. A ticket created after 18:00 begins on the next business day. A deadline that crosses a weekend or a holiday skips the non-business time instead of consuming SLA time.

SLA state is computed as follows:

- `ON_TRACK`: 75% or less of the SLA budget has been consumed.
- `AT_RISK`: more than 75% has been consumed, but the deadline has not passed.
- `BREACHED`: the deadline has passed.

The exact 75% boundary remains `ON_TRACK`; `AT_RISK` begins only after that point.

## First response and completed clocks

The first comment authored by someone other than the ticket Reporter is recorded as the first response. A comment written by the Reporter does not satisfy the first-response SLA.

Once `firstResponseAt` is recorded, the first-response SLA is evaluated at that historical timestamp and is permanently frozen. Similarly, once `resolvedAt` is recorded, the resolution SLA is frozen at the resolution timestamp.

This preserves the true SLA outcome. A ticket that received an on-time first response remains on track for first response even if it stays open for several days. A response made after its deadline remains breached even after the response has been submitted.

## Architecture

The application uses Bun and TypeScript on the backend, GraphQL Yoga for the API, Prisma with PostgreSQL for persistence, and React with Vite for the frontend.

The backend is intentionally layered:

- GraphQL resolvers handle request arguments, authentication, and responses.
- Services contain business logic, including SLA calculations, status transitions, and first-response detection.
- Repositories contain Prisma database access.
- Validation modules validate inputs before persistence.

The SLA engine is isolated from GraphQL and the database. This makes its date calculations deterministic and easy to test without mocks.

SLA state is not stored as a database field. It is computed from ticket timestamps, priority, the holiday calendar, and the current time whenever ticket data is read. This avoids stale SLA state if time passes or holidays change.

## Authentication and API

Passwords are hashed with bcrypt. Registration and login return a JWT containing the user ID and role. The backend reads that token for every request and uses the resulting context for authentication and role checks.

The GraphQL API exposes authentication, ticket, comment, dashboard, user, and holiday operations. Ticket queries support filtering by status, priority, assignee, and computed SLA state, along with cursor pagination.

## Testing

Unit tests cover business-hour calculations across weekdays, nights, weekends, holidays, and multiple-day spans. They also cover SLA states and boundaries, completed-clock behavior, first-response detection, and valid and invalid ticket transitions.

An integration test exercises the persisted workflow against PostgreSQL: creating a ticket, adding Reporter and Agent comments, persisting the first-response timestamp, and calculating SLA information from database records.

## Tradeoff and future improvement

SLA-state filtering is currently calculated in application code because SLA state is derived rather than stored. This keeps results correct and is appropriate for the current project size. At a larger scale, a periodically computed and indexed SLA-state field could make filtered queries more efficient.

Another intentional limitation is that an SLA does not pause while waiting for a customer. A production extension could introduce a `WAITING_ON_CUSTOMER` status and track paused business minutes.
