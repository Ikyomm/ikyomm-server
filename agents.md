# Ommpods Server — Agent Context

## Repository Overview

- Monorepo managed with `pnpm` workspaces and `turbo`
- TypeScript + ESM + Node.js
- Hono services
- Better Auth for authentication and organization membership
- Drizzle ORM for PostgreSQL
- Redis for auth secondary storage and rate limiting
- Resend-backed notification package for email delivery
- Multi-stage Docker builds for `gateway`, `auth`, `kernel`, `company`, and `ommpods`

## Active Services

### `services/gateway`

Gateway entrypoint.

- exposes gateway-local docs and health endpoints
- proxies `/api/auth/*` to `auth`
- proxies `/api/kernel/*` to `kernel`
- proxies `/api/ommpods/*` to `ommpods`

Key files:

- `services/gateway/src/index.ts`
- `services/gateway/src/config/env.ts`
- `services/gateway/src/config/openapi.ts`
- `services/gateway/src/proxy.ts`

### `services/auth`

Primary auth service.

- Better Auth runtime
- email/password auth
- email OTP
- organization support
- session handling
- role/panel enrichment in custom session payload
- Better Auth OpenAPI HTML reference lives at `/api/auth/docs`, while the raw OpenAPI schema for gateway docs aggregation lives at `/api/auth/open-api/generate-schema`

Key files:

- `services/auth/src/index.ts`
- `services/auth/src/config/env.ts`
- `services/auth/src/lib/auth/index.ts`
- `services/auth/src/lib/auth/utils.ts`

### `services/kernel`

Domain API service.

- company CRUD and settings APIs
- company member CRUD APIs
- records APIs for Pods and devices
- record-master APIs for Aroma Defusers, moods, music, playlists, and Pods
- OpenAPI docs under `/api/kernel/doc` and `/api/kernel/docs`

Key files:

- `services/kernel/src/index.ts`
- `services/kernel/src/config/env.ts`
- `services/kernel/src/config/openapi.ts`

### `services/company`

Company-facing domain API service.

- company CRUD and settings APIs
- company member CRUD APIs
- OpenAPI docs under `/api/company/doc` and `/api/company/docs`

Key files:

- `services/company/src/index.ts`
- `services/company/src/config/env.ts`
- `services/company/src/config/openapi.ts`
- `services/company/src/routers/company`

### `services/ommpods`

Live pod-session service.

- exposed through gateway at `/api/ommpods`
- books pod sessions from Pod rate slabs with wallet debit/credit handling
- exposes public fast polling at `/api/ommpods/polling/pods/{podId}`
- exposes session controls under `/api/ommpods/control`
- stores session control changes as append-only `pod_session_logs`
- mood changes log only `moodPresetId`; polling resolves RGB from the active mood preset
- there is no separate RGB control API; RGB comes from the selected mood preset
- aroma polling data is nested under `podData.aromaDufuser`

Key files:

- `services/ommpods/src/index.ts`
- `services/ommpods/src/routers/sessions/handler.ts`
- `services/ommpods/src/routers/control`
- `services/ommpods/src/routers/polling/handler.ts`

## Kernel Router Layout

Kernel router pattern should stay consistent:

- router folder contains `schema.ts`, `openapi.route.ts`, `handler.ts`, and optional `list.ts` / `utils.ts`
- route groups are mounted from `services/kernel/src/index.ts`
- prefer one domain folder per namespace instead of scattering handlers

Current kernel domains:

- `services/kernel/src/routers/company/main`
- `services/kernel/src/routers/company/members`
- `services/kernel/src/routers/records/aroma-defusers`
- `services/kernel/src/routers/records/pods`
- `services/kernel/src/routers/records/devices`

## Records Domain

### Pods

Backed by `packages/database/src/schemas/records/pods/schema.ts`.

Current API namespace:

- `/api/kernel/records/pods`

Implemented behavior:

- list, get, create, update, soft delete
- validates assigned `aromaDefuserId`
- Pod ids use the existing sequential `generateNextOmmpodsId` helper

### Aroma Defusers

Backed by `packages/database/src/schemas/records/devices/aroma-defusers/schema.ts`.

Current API namespace:

- `/api/kernel/records/aroma-defusers`

Implemented behavior:

- list, get, create, update, soft delete, restore, permanent delete
- `macId` is unique and indexed
- `containers` is a JSON array of `{ number, fragrance }`
- soft delete is blocked if an active Pod references the defuser

## Database Shape

### `packages/database`

Shared Drizzle database package.

Important schema groups:

- `packages/database/src/schemas/auth`
  user, account, session, organization, member, invitation, RBAC
- `packages/database/src/schemas/records`
  pods, moods, musics, record enums, relations, devices/aroma-defusers
- `packages/database/src/schemas/sessions`
  pod_sessions, pod_session_logs, session enums, session log payload types

Related files:

- `packages/database/src/resources.ts`
- `packages/database/src/schemas/records/relations.ts`
- `packages/database/drizzle/*`

## Shared Packages

### `packages/utils`

- Hono handlers
- OpenAPI helpers
- auth/session middleware
- RBAC helpers
- list-query builders
- id/password/encryption helpers
- resource-based RBAC middleware for kernel route protection

Key files:

- `packages/utils/src/openapi/route.ts`
- `packages/utils/src/middleware/auth.ts`
- `packages/utils/src/middleware/rbac.ts`
- `packages/utils/src/functions/list-query.ts`
- `packages/utils/src/functions/gen-id.ts`

### `packages/notification`

- React Email templates
- Resend transport
- account/member credential email rendering used by kernel routes

### `packages/logger`

- shared structured logger factory

### `packages/static`

- static shared assets such as favicon

## Docker

Current Docker setup is intentionally minimal and production-lean:

- `docker/auth.Dockerfile`
- `docker/company.Dockerfile`
- `docker/gateway.Dockerfile`
- `docker/kernel.Dockerfile`
- `docker/ommpods.Dockerfile`
- `docker/docker-compose.yml`
- `docker/docker-compose.prod.yml`

Pattern:

- multi-stage build
- package-manifest-only dependency layer
- distroless runtime image
- compose healthchecks for runtime services must call `/nodejs/bin/node`, not bare `node`
- `gateway`, `kernel`, and `ommpods` also need `REDIS_URL` in compose because shared rate-limit and Redis-backed utils are used outside auth
- avoid reintroducing full single-stage runtime images
- Dokploy runs `docker compose --project-directory <clone>/code -f ./docker/docker-compose.prod.yml`. Prod compose must use `build.context: .` plus `dockerfile: docker/<service>.Dockerfile` (`context: ..` looks outside the clone). Env-tab vars are written to `docker/.env`; also load `.env` and `../.env` with `required: false`. Do not re-list those secrets under `environment:` (empty interpolation overrides `env_file`)

Useful commands:

```bash
pnpm docker:build
pnpm docker:size
pnpm docker:size:build
```

## Common Commands

```bash
pnpm dev
pnpm build
pnpm type-check
pnpm lint
pnpm db:generate
pnpm db:migrate
pnpm db:push
pnpm docker:build
pnpm docker:size
```

## Current Guardrails

- Do not assume this repo is still auth+gateway-only. `kernel` is now a real active service.
- When adding backend APIs, follow the existing kernel router folder convention instead of one-off files.
- For records/device work, start from the Drizzle schema in `packages/database/src/schemas/records`.
- Keep OpenAPI tags and tag groups updated when adding new kernel namespaces.
- Prefer resource-based RBAC guards in `openapi.route.ts` via `createResourceRbacGuards(...)` instead of plain auth-only middleware for protected kernel routes.
- Keep gateway proxy config in sync with any new service path that should be reachable through `/api/*`.
- Keep Dockerfiles on the current multi-stage minimal pattern; do not regress to full-repo single-stage images.
- Do not invent new record namespaces when the schema already defines the domain naming.
- Shared RBAC resource definitions now include records/session resources such as `pods`, `aroma_defuser`, `pod_sessions`, and `pod_session_logs`.
- keep Aroma Defuser `macId` indexed and treated like the hardware lookup key
- Session live state belongs in `pod_session_logs`; keep `pod_sessions` focused on identity, pod/user/company refs, status, and time bounds.

## Maintenance Rule

This file is expected to track the real repo state.

When architecture, router namespaces, active services, Docker patterns, or major domain contracts change:

- update `agents.md` in the same task
- remove stale guardrails instead of stacking contradictory notes
- prefer concrete paths and current API namespaces over vague summaries
