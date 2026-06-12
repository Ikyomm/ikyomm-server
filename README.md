# ikyomm-server

TypeScript microservice starter built around:

- `services/gateway` for edge routing and proxying
- `services/auth` for Better Auth
- shared workspace packages for database, utils, logger, notification, static assets, and TS config

## Workspace

```text
.
├── env/
│   └── .env.example
├── package.json
├── pnpm-workspace.yaml
├── turbo.json
├── packages/
│   ├── database/
│   ├── logger/
│   ├── notification/
│   ├── static/
│   ├── typescript-config/
│   └── utils/
└── services/
    ├── auth/
    └── gateway/
```

## Services

### `gateway`

- entrypoint service
- proxies `/api/auth/*` to the auth service
- exposes `/health`

### `auth`

- Better Auth service
- credentials, OTP, sessions, and organization support
- exposes `/health` and `/api/auth/*`

## Commands

```bash
pnpm install --no-frozen-lockfile
pnpm dev
pnpm build
pnpm type-check
pnpm lint
pnpm db:generate
pnpm db:migrate
pnpm db:push
pnpm dev:email
```

## Environment

Start from:

```bash
cp env/.env.example env/.env
```

Key values:

- `GATEWAY_PORT`
- `AUTH_PORT`
- `AUTH_SERVICE_URL`
- `DATABASE_URL`
- `REDIS_URL`
- `BETTER_AUTH_SECRET`
- `BETTER_AUTH_URL`
- `BETTER_AUTH_API_KEY`
- `RESEND_API_KEY`
- `RESEND_FROM`

## Notes

- Docker, production compose, and extra domain services were intentionally removed.
- Domain-specific schemas and service modules were removed so this repo can act as a starter base.
- Shared packages remain in place so new services and domain modules can be added back later.
