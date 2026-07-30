# IKYOMM Server — Architecture

> Backend monorepo for the Ikyomm/Ommpods wellness pod platform.  
> Powers admin panel, company portal, consumer app PWA, tablet UI, and Treasure ecommerce.

---

## Quick Start

```bash
cd ikyomm-server
cp env/.env.example env/.env
pnpm install
pnpm dev          # All 6 services via turbo
```

**Gateway:** `http://localhost:8000`  
**OpenAPI docs:** `http://localhost:8000/doc` (aggregated)

---

## Ecosystem Map

```
Ikyomm (platform)
├── Admin panel (ikyomm-software)     → /api/kernel, /api/auth
├── Company portal                    → /api/company, /api/auth
├── Consumer app (ikyomm-app-pwa)     → /api/ommpods/app, /api/auth  ← YOU ARE HERE
├── Tablet UI (ikyomm-tablet-pwa)     → /api/ommpods/tablet, /api/ommpods/polling
├── Treasure shop (ikyomm-website)    → /api/ecommerce
└── Ommpods (product)
    ├── Hardware pods (records/pods)
    ├── Live sessions (ommpods service)
    ├── Mood/music/aroma control
    └── Credit-minute wallet economy
```

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Language | TypeScript (ESM), Node.js |
| Monorepo | pnpm workspaces + Turbo |
| HTTP | Hono + `@hono/zod-openapi` |
| Auth | Better Auth (email/password, OTP, bearer, org, admin) |
| ORM | Drizzle ORM + PostgreSQL |
| Cache | Redis (auth, session cache, polling state, rate limits) |
| Email | Resend + React Email (`@ikyomm/notification`) |
| Realtime | WebSockets (`ws`) for pod state |
| Validation | Zod |
| Lint | Biome |
| Docker | Multi-stage distroless images |

---

## Project Structure

```
ikyomm-server/
├── env/.env.example              # Single shared env file
├── docker/                       # Dockerfiles + compose
├── packages/
│   ├── database/                 # Drizzle schemas + migrations
│   ├── utils/                    # Auth/RBAC middleware, OpenAPI, CRUD helpers
│   ├── logger/
│   ├── notification/             # React Email + Resend
│   └── static/
├── services/
│   ├── gateway/                  # Edge proxy (port 8000)
│   ├── auth/                     # Better Auth (port 6001)
│   ├── kernel/                   # Admin/domain API (port 6003)
│   ├── company/                  # Company-facing API (port 6005)
│   ├── ommpods/                  # Live pod sessions (port 6007)  ← APP PWA APIS
│   └── ecommerce/                # Treasure ecommerce (port 6008)
├── package.json
├── turbo.json
└── agents.md                     # Agent guardrails (keep in sync)
```

---

## Service Architecture

```
Clients (admin, app, tablet, website)
        │
        ▼
┌───────────────────────────────────────┐
│  gateway :8000                        │
│  /health, /doc (aggregated OpenAPI)   │
│  Proxies: /api/{auth,kernel,company,  │
│           ommpods,ecommerce}/*        │
│  WebSocket proxy: /api/ommpods/socket │
└───────────┬───────────────────────────┘
            │
   ┌────────┼────────┬──────────┬──────────┐
   ▼        ▼        ▼          ▼          ▼
 auth    kernel   company    ommpods   ecommerce
 :6001   :6003    :6005      :6007     :6008
   │        │        │          │          │
   └────────┴────────┴──────────┴──────────┘
                    │
            PostgreSQL + Redis
```

### Gateway proxy rules (`services/gateway/src/proxy.ts`)

| Prefix | Target | Strip prefix |
|--------|--------|--------------|
| `/api/auth` | auth :6001 | No (Better Auth basePath) |
| `/api/kernel` | kernel :6003 | Yes |
| `/api/company` | company :6005 | Yes |
| `/api/ommpods` | ommpods :6007 | Yes |
| `/api/ecommerce` | ecommerce :6008 | Yes |

Gateway also:
- Rewrites auth cookies based on `x-auth-panel-scope` header
- Adds stale-cache fallback for polling (10s) on 429/5xx
- Proxies WebSocket upgrades at `/api/ommpods/socket/pods/{podId}`

---

## Ommpods Service — App PWA APIs

**Mount point:** `services/ommpods/src/routers/index.ts`

```
/api/ommpods/
├── sessions/     # Session booking + management (RBAC)
├── control/      # Mood/aroma changes during session
├── polling/      # Public fast polling (Redis-backed)
├── app/          # ★ Consumer PWA endpoints
└── tablet/       # In-pod tablet endpoints
```

### App routes (`services/ommpods/src/routers/app/handler.ts`)

Gateway path: `/api/ommpods/app/*`

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/me` | Yes | User profile, company, wallet, recent transactions |
| GET | `/sessions/active` | Yes | Active session for current user |
| GET | `/pods/:id` | Yes | Pod details for booking (rate slabs, aroma defusers) |
| GET | `/moods/list?podType=` | Yes | Available mood presets |
| GET | `/playlists/list?moodPresetId=` | Yes | Music playlists for mood |
| GET | `/musics/list?playlistId=` | Yes | Music tracks in playlist |

Auth middleware: `createRequiredAuthSessionMiddleware` with Redis cache.

### Session routes (`services/ommpods/src/routers/sessions/`)

Gateway path: `/api/ommpods/sessions/*`

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/` | Yes | Book session (debit wallet, create session + logs) |
| POST | `/emergency-unlock` | Yes | Emergency unlock by podId |
| GET | `/list` | RBAC | List sessions |
| GET | `/:id` | RBAC | Get session |
| GET | `/:id/logs/list` | RBAC | Session control logs |
| GET | `/:id/transactions/list` | RBAC | Wallet transactions |
| GET | `/:id/usage` | RBAC | Usage stats |

**Booking flow** (`sessions/handler.ts`):
1. Validate pod, rate slab, mood preset
2. Advisory lock on podId (prevents double booking)
3. Debit `user_wallet.creditMinute`
4. Create `pod_sessions` row + initial `pod_session_logs`
5. Return session with computed start/end delays

### Control routes (`services/ommpods/src/routers/control/`)

Gateway path: `/api/ommpods/control/*`

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/moods/sessions/:sessionId` | Yes | Change mood preset (logs moodPresetId, RGB resolved from preset) |
| POST | `/aroma/sessions/:sessionId` | Yes | Change aroma defuser/container |
| POST | `/emergency-unlock/sessions/:sessionId` | Yes | Emergency unlock by session |

### Polling routes (`services/ommpods/src/routers/polling/`)

Gateway path: `/api/ommpods/polling/*` — **public, no auth**

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/pods/:podId` | Live pod state (RGB, aroma, devices, session) |
| GET | `/pods/:podId/socket-state` | Current socket state snapshot |

Redis-backed with stale/safe fallbacks. Gateway adds second-layer stale cache.

### WebSocket

| Path | Purpose |
|------|---------|
| Direct: `/socket/pods/:podId` | Real-time pod state broadcast (~1s tick) |
| Gateway: `/api/ommpods/socket/pods/:podId` | Proxied WebSocket |

File: `services/ommpods/src/routers/socket/socket.ts`

### Tablet routes (`services/ommpods/src/routers/tablet/`)

Gateway path: `/api/ommpods/tablet/*` — **no auth middleware**

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/pods/:podId/state` | Full pod + session state |
| POST | `/pods/:podId/mood` | Set mood |
| POST | `/pods/:podId/aroma` | Set aroma defuser |
| POST | `/pods/:podId/music` | Control music playback |
| POST | `/pods/:podId/emergency-unlock` | Emergency unlock |

Note: App PWA sends music commands to tablet API; tablet plays audio locally.

---

## Auth Service — App Panel

**Gateway path:** `/api/auth/*`

### App-specific endpoints

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/app/sign-up` | Create app user + 500 wallet credits (debits Ikyomm wallet) |
| GET | `/check-email-panel?email=` | Check email exists + panel (`ikyomm`, `company`, `app`) |

### Better Auth capabilities

- Email/password sign-in & sign-up
- Email OTP (sign-in, password reset)
- Phone OTP
- Bearer tokens
- Organization plugin
- Admin plugin
- Custom session with RBAC permissions enrichment

Config: `services/auth/src/lib/auth/index.ts`

### Multi-panel cookie scoping

Gateway rewrites cookies based on `x-auth-panel-scope` header:

| Panel | Used by |
|-------|---------|
| `ikyomm` | Admin staff |
| `company` | Company portal |
| `app` | Consumer PWA |

Incoming: scoped cookies → canonical Better Auth cookies  
Outgoing: canonical cookies → scoped cookies

File: `services/gateway/src/routes/index.ts`

### Downstream auth middleware

Services use `createBetterAuthSessionMiddleware()` / `createRequiredAuthSessionMiddleware()`:

1. Forward cookies/bearer to auth `/api/auth/get-session`
2. Cache result in memory + Redis (3–60s)
3. Hydrate organization + RBAC from DB
4. Attach to Hono context as `c.get("auth")`

File: `packages/utils/src/middleware/auth.ts`

---

## Database Schema (Relevant to App PWA)

**Package:** `packages/database/src/schemas/`

### Auth & identity (`schemas/auth/`)

| Table | Purpose |
|-------|---------|
| `user` | Users with `panel` enum: `ommpods \| company \| ikyomm \| app` |
| `session` | Auth sessions |
| `organization` | Companies (B2B) |
| `member` | Org membership |
| `user_wallet` | Per-user credit minutes |
| `wallet_transactions` | Debit/credit/transfer ledger |

### Records / hardware (`schemas/records/`)

| Table | Purpose |
|-------|---------|
| `pods` | Pod units (type, status, rate slabs, location, aroma defusers) |
| `pod_mood_presets` | Mood presets with RGB + enabled pod types |
| `musics` | Music tracks |
| `music_playlists` | Playlists |
| `aroma_defusers` | Diffuser hardware (macId, containers) |

### Sessions (`schemas/sessions/`)

| Table | Purpose |
|-------|---------|
| `pod_sessions` | Booked sessions (pod, user, company, status, start/end) |
| `pod_session_logs` | Append-only control events (mood, aroma, music) |

**Design:** Live session state lives in logs; `pod_sessions` holds identity + time bounds.

### Wallets (`schemas/wallets/`)

| Table | Purpose |
|-------|---------|
| `ikyomm_wallet` | Singleton platform wallet |
| `user_wallet` | Per-user credit minutes |
| `organization_wallet` | Per-company credits |
| `wallet_transactions` | Ledger |

---

## API Response Format

All endpoints return:

```json
{
  "success": true,
  "data": { ... },
  "error": null,
  "message": null
}
```

Errors:

```json
{
  "success": false,
  "error": "Bad Request",
  "message": "Invalid payload."
}
```

Helpers: `createSuccessResponse()`, `createErrorResponse()` from `@ikyomm/utils`.

---

## Router Convention

Each domain folder contains:

```
routers/{domain}/
├── schema.ts           # Zod request/response schemas
├── openapi.route.ts    # OpenAPI route definitions
├── handler.ts          # Route handlers
├── list.ts             # (optional) list query builder
└── utils.ts            # (optional) domain helpers
```

Mounted from service `index.ts`. Protected routes use `createResourceRbacGuards()` from `packages/utils/src/middleware/rbac.ts`.

---

## Session Lifecycle (Event-Sourced)

```
1. POST /sessions
   → pod_sessions row created (status: preparing)
   → pod_session_logs: session_created, mood_selected

2. Session starts (timer-based)
   → pod_session_logs: session_started
   → WebSocket broadcasts state every 1s

3. During session
   → POST /control/moods/sessions/:id  → log: mood_changed
   → POST /control/aroma/sessions/:id  → log: aroma_changed
   → POST /tablet/pods/:id/music       → log: music_control

4. Session ends (timer or emergency)
   → pod_session_logs: session_ended / emergency_unlock
   → pod_sessions status updated
```

Polling derives current state from latest logs + mood preset lookup.

---

## Environment Variables

**Template:** `env/.env.example`

| Variable | Default | Purpose |
|----------|---------|---------|
| `DATABASE_URL` | — | PostgreSQL connection |
| `REDIS_URL` | — | Redis for auth, caching, polling |
| `GATEWAY_PORT` | 8000 | Gateway listen port |
| `AUTH_PORT` | 6001 | Auth service |
| `KERNEL_PORT` | 6003 | Kernel service |
| `COMPANY_PORT` | 6005 | Company service |
| `OMMPODS_PORT` | 6007 | Ommpods service |
| `ECOMMERCE_PORT` | 6008 | Ecommerce service |
| `BETTER_AUTH_SECRET` | — | Auth secret |
| `BETTER_AUTH_URL` | — | Auth base URL |
| `CORS_ALLOWED_ORIGINS` | — | Allowed frontend origins |
| `RESEND_API_KEY` | — | Email delivery |
| `OMMPODS_SESSION_START_END_DELAY_SECONDS` | — | Session timing |
| `OMMPODS_SESSION_START_INTRODUCTORY_VIDEO_DURATION` | — | Intro video duration |

### DB commands

```bash
pnpm db:generate   # Generate migrations
pnpm db:migrate    # Apply migrations
pnpm db:push       # Push schema directly
pnpm db:studio     # Drizzle Studio
```

### Health checks

```bash
pnpm health:gateway    # http://localhost:8000/health
pnpm health:auth       # http://localhost:8000/api/auth/health
pnpm health:ommpods    # http://localhost:8000/api/ommpods/health
```

---

## Adding New App PWA Endpoints

### Step 1: Add handler in ommpods service

```ts
// services/ommpods/src/routers/app/handler.ts
appGroup.get("/my-endpoint", async (c) => {
  const auth = getBetterAuthContext(c);
  // ... business logic
  return c.json(createSuccessResponse(data));
});
```

### Step 2: Add client call in PWA

```ts
// ikyomm-app-pwa/app/lib/api.ts
export const appApi = {
  // ...existing
  myEndpoint: () => apiGet<MyType>(`${ommpodsAppBaseUrl}/my-endpoint`),
};
```

### Step 3: Use in UI

```tsx
// ikyomm-app-pwa/app/components/ikyomm-app.tsx
const data = await appApi.myEndpoint();
```

No gateway changes needed — `/api/ommpods/*` is already proxied.

### If adding a new ommpods route group

1. Create folder under `services/ommpods/src/routers/`
2. Mount in `services/ommpods/src/routers/index.ts`
3. Gateway auto-proxies via existing `/api/ommpods/*` rule

---

## Other Services (Reference)

### Kernel (`/api/kernel`) — Admin only

- Company CRUD, members
- Ikyomm admin users + RBAC
- Location (regions, zones, locations)
- Records (pods, moods, music, playlists, aroma defusers)
- Wallets (ikyomm, company, user)

### Company (`/api/company`) — Company portal

- Company CRUD, members (mirrors kernel company APIs)

### Ecommerce (`/api/ecommerce`) — Treasure shop

- Brands, categories, products, variants
- Inventory, orders, payments
- Addresses, subscriptions, reviews

---

## Architecture Patterns

1. **API Gateway** — single entry, path-based routing, cookie rewriting, polling resilience
2. **Microservices by domain** — auth, admin, company, runtime, ecommerce
3. **Shared database package** — one PostgreSQL schema, all services use `@ikyomm/database`
4. **OpenAPI-first** — every route in `openapi.route.ts`, aggregated docs at gateway
5. **RBAC-as-data** — permissions in DB, resolved at session time
6. **Soft-delete everywhere** — audit columns + restore/permanent-delete lifecycle
7. **Event-sourced session control** — `pod_session_logs` append-only; polling derives state
8. **Credit-minute economy** — wallets + transactions across signup, booking, admin ops
9. **Multi-panel auth** — one auth service, panel-scoped cookies

---

## Related Docs

| File | Purpose |
|------|---------|
| `agents.md` | Agent guardrails (keep in sync with architecture changes) |
| `README.md` | Setup instructions |
| `ikyomm-app-pwa/ARCHITECTURE.md` | PWA client architecture |
| Gateway OpenAPI | `http://localhost:8000/doc` |
| Ommpods OpenAPI | `http://localhost:8000/api/ommpods/doc` |
