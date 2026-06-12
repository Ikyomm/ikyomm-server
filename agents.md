# Ommpods Server — Agent Context

## Repository Overview

- Monorepo managed with `pnpm` workspaces and `turbo`
- TypeScript + ESM + Node.js
- Hono services
- Better Auth for authentication and organization membership
- Drizzle ORM for PostgreSQL
- Redis for auth secondary storage and rate limiting
- Resend-backed notification package for email delivery
- Multi-stage Docker builds for `gateway`, `auth`, `kernel`, and `company`

## Active Services

### `services/gateway`

Gateway entrypoint.

- exposes gateway-local docs and health endpoints
- proxies `/api/auth/*` to `auth`
- proxies `/api/kernel/*` to `kernel`

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

## Kernel Router Layout

Kernel router pattern should stay consistent:

- router folder contains `schema.ts`, `openapi.route.ts`, `handler.ts`, and optional `list.ts` / `utils.ts`
- route groups are mounted from `services/kernel/src/index.ts`
- prefer one domain folder per namespace instead of scattering handlers

Current kernel domains:

- `services/kernel/src/routers/company/main`
- `services/kernel/src/routers/company/members`
- `services/kernel/src/routers/records/pods`
- `services/kernel/src/routers/records/devices`

## Records Domain

### Pods

Backed by `packages/database/src/schemas/records/pods/schema.ts`.

Current API namespace:

- `/api/kernel/records/pods`

Implemented behavior:

- list, get, create, update, soft delete
- validates assigned `doorLockId`, `aromaDefuserId`, and `touchpadId`
- prevents assigning the same device to multiple Pods
- Pod ids use the existing sequential `generateNextOmmpodsId` helper

### Devices

Backed by `packages/database/src/schemas/records/devices/schema.ts`.

Current API namespace:

- `/api/kernel/records/devices`

Implemented device families:

- `door-locks`
- `aroma-defusers`
- `touchpads`

Implemented behavior:

- list, get, create, update, soft delete for all three device families
- all three device tables now require `imei`
- device read/update/delete routes accept either internal `id` or device `imei` in the `{identifier}` path param
- device create/update payloads accept optional `ommpodId` for direct mapping, and `null` clears the mapping on update
- device delete is blocked if the device is assigned to an active Pod
- `door_lock` has extra `isLocked` and `status` fields
- switch-route availability is controlled per device family from `buildDeviceRouteConfig(...)` options
- `POST /api/kernel/records/devices/door-locks/{identifier}/switch` toggles `is_locked`
- kernel docs group each device family under its own tag instead of one shared devices dropdown
- Pod create/update no longer requires all device ids up front; device assignments are optional and can be attached later

## Database Shape

### `packages/database`

Shared Drizzle database package.

Important schema groups:

- `packages/database/src/schemas/auth`
  user, account, session, organization, member, invitation, RBAC
- `packages/database/src/schemas/records`
  pods, door_lock, aroma_defuser, touchpad, record enums, relations

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
- `docker/docker-compose.yml`
- `docker/docker-compose.prod.yml`

Pattern:

- multi-stage build
- package-manifest-only dependency layer
- distroless runtime image
- compose healthchecks for runtime services must call `/nodejs/bin/node`, not bare `node`
- `gateway` and `kernel` also need `REDIS_URL` in compose because shared rate-limit and Redis-backed utils are used outside auth
- avoid reintroducing full single-stage runtime images

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
- `doorLock` is the only current device type with `isLocked`; toggle behavior should stay device-specific.
- Shared RBAC resource definitions now include records resources such as `pods`, `door_lock`, `aroma_defuser`, and `touchpad`.
- keep device `imei` indexed and treated like a first-class lookup key for CRUD-style routes

## Maintenance Rule

This file is expected to track the real repo state.

When architecture, router namespaces, active services, Docker patterns, or major domain contracts change:

- update `agents.md` in the same task
- remove stale guardrails instead of stacking contradictory notes
- prefer concrete paths and current API namespaces over vague summaries
