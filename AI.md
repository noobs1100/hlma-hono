# AI Handoff Context

This file tracks the current state of the backend so future AI sessions can move fast.

## Project Summary

- **Project:** `hlma-hono`
- **Stack:** Hono + Better Auth + Drizzle + PostgreSQL + Bun
- **Language:** TypeScript
- **Runtime:** Bun
- **Database:** Local PostgreSQL via Docker Compose

## Auth Flow

- **Auth routes:** `GET`/`POST` on `/api/auth/*`
- **Session helper:** `GET /session`
- **Session handling:** cookie-based via Better Auth; `src/index.ts` loads the session into Hono variables
- **First user rule:** the first created user becomes `admin` via a Better Auth database hook
- **Role management:** admins can promote/demote users through `/api/admin/users/:userId/role`
- **Safety rule:** the last remaining admin cannot be demoted

## API Routes

### Auth + Session

- **`GET /api/auth/*` / `POST /api/auth/*`:** Better Auth routes for login, signup, logout, and any auth-related action needed by the Expo app.
- **`GET /session`:** Returns the current session and is the main endpoint for restoring auth state when the app launches.
- **Frontend use:** call `/session` on app start, store the returned user/role in state, and use it to decide which screens and actions to show.

### Books

- **`GET /api/books`:** Public read endpoint for listing books, showing book details, and building search or browse screens.
- **`POST /api/books`:** Admin-only create endpoint for adding new books from the app.
- **`PUT /api/books/:id`:** Admin-only update endpoint for editing an existing book.
- **`DELETE /api/books/:id`:** Admin-only delete endpoint for removing a book.
- **Frontend use:** use this for catalog screens, book forms, and admin inventory management.

### Copies

- **`GET /api/copies`:** Lists all copies for inventory screens and copy management pages.
- **`POST /api/copies`:** Creates a copy; the client provides the copy ID and the server rejects duplicates.
- **`PUT /api/copies/:id`:** Updates a copy record.
- **`DELETE /api/copies/:id`:** Deletes a copy record.
- **Frontend use:** use this for stock tracking, copy assignment, and admin maintenance flows.

### Racks

- **`GET /api/racks`:** Lists racks for shelf/location screens.
- **`POST /api/racks`:** Creates a rack; the client provides the rack ID and the server rejects duplicates.
- **`PUT /api/racks/:id`:** Updates a rack.
- **`DELETE /api/racks/:id`:** Deletes a rack.
- **Frontend use:** use this for location management and admin setup screens.

### Borrows

- **`GET /api/borrows`:** Lists borrow records for active loans, history, and borrower tracking.
- **`POST /api/borrows`:** Creates a borrow record when a user checks out a copy.
- **`PUT /api/borrows/:id`:** Updates a borrow record if the workflow requires it.
- **`DELETE /api/borrows/:id`:** Deletes a borrow record.
- **Return flow:** the borrows API also supports returning a borrowed item, so the app can mark a copy as returned from a dedicated return action.
- **Frontend use:** use this for borrow history screens, checkout flows, and return screens.
- **Access rule:** create and return are allowed for authenticated `user` and `admin` roles.

### Admin Users

- **`GET /api/admin/users`:** Lists users for admin management screens.
- **`PATCH /api/admin/users/:userId/role`:** Promotes or demotes a user’s role.
- **Safety rule:** the last remaining admin cannot be demoted.
- **Frontend use:** use this for admin-only user management pages.

### Labels

- **`GET /api/labels/:type`:** Generates a PDF label file for the requested type.
- **Supported types:** `r` and `b`.
- **Label format:** IDs use base62 with `r:` and `b:` prefixes.
- **Label PDF detail:** each Data Matrix code includes `Nidhanam` text above it.
- **Frontend use:** use this for printing rack labels and book labels from the app.

### OpenAPI + Docs

- **`GET /openapi.json`:** Machine-readable API schema for generating typed clients or checking request/response shapes.
- **`GET /docs`:** Human-readable documentation for the backend API.
- **Frontend use:** useful when building a shared API client for the Expo app.

## Business Rules

- **Books:** public read; admin-only write
- **Copies and racks:** client supplies custom IDs; server rejects duplicate IDs
- **Borrows:** create and return are allowed for authenticated `user` and `admin` roles
- **Labels:** IDs are base62 with `r:` and `b:` prefixes
- **Label PDFs:** each Data Matrix code has `Nidhanam` text above it

## Expo Integration Notes

- **Session first:** call `GET /session` when the app starts and keep the user role in app state.
- **Cookie auth:** the backend uses cookie-based auth, so Expo requests must preserve credentials when supported by the runtime.
- **Route gating:** hide admin screens unless the session role is `admin`.
- **Catalog flow:** use `GET /api/books` for browse/search, then call the protected book and inventory endpoints only when needed.
- **Operational flow:** use borrows endpoints for checkout and returns, and labels endpoints for printing PDFs.
- **API source of truth:** use `GET /openapi.json` if you want to generate or verify a typed client in the frontend repo.

## Database Notes

- **App schema:** `src/db/schema.ts`
- **Auth schema:** `src/db/auth-schema.ts`
- **Database setup:** `src/db/db.ts` merges app and auth schemas into the Drizzle client
- **Migrations:** stored under `src/db/migrations/`
- **Local Postgres:** started through `docker-compose.yml`

## Useful Commands

- `bun run dev`
- `bun run db:generate`
- `bun run db:migrate`
- `bun run db:push`
- `bun run db:reset`

## Notes

- **OpenAPI docs:** generated from the current server and surfaced at `/openapi.json` and `/docs`

