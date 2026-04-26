# Docker Compose Modes Design

## Goal

Support one-command Docker Compose startup for the Mind X refactor stack in both development and production-like modes. Each mode must run the frontend, backend API, and MySQL together, and the README must explain how to choose the mode.

## Chosen Approach

Use separate Compose entry files for the two modes:

- `docker/compose.dev.yml` for local development.
- `docker/compose.prod.yml` for production-like local smoke checks.

This keeps the commands explicit and avoids hiding large behavior changes behind profiles or override merging.

## Architecture

The stack has three services in each mode:

- `mysql` runs MySQL 8.4, initializes schema from `docker/init.sql`, persists data in a named volume, and exposes a health check.
- `api` runs the Koa API on port `3000`, connects to `mysql:3306`, and waits for MySQL to be healthy before starting.
- `web` serves the Vue app and exposes the user-facing HTTP port.

Development mode favors editability. It runs the Vite development server on host port `5173` and mounts source files into the web and API containers. The Vite dev server proxies `/api` requests to the API service.

Production mode favors deploy-like behavior. The API runs compiled JavaScript from `dist`, and the web app is built into static assets served by nginx. Nginx also proxies `/api` requests to the API service, so only the web service needs to be exposed to the host.

## Components

- Add Dockerfiles for the API and web apps.
- Add an nginx config for production web serving and `/api` proxying.
- Replace the existing MySQL-only Compose file with mode-specific Compose files.
- Keep `docker/init.sql` as the shared schema bootstrap.
- Update README commands and environment notes.

## Data Flow

In development:

1. Browser opens `http://localhost:5173`.
2. Vite serves the Vue app.
3. Browser requests `/api/*` from Vite.
4. Vite proxies to `api:3000`.
5. API reads and writes MySQL at `mysql:3306`.

In production mode:

1. Browser opens `http://localhost:8080`.
2. Nginx serves built Vue assets.
3. Nginx proxies `/api/*` to `api:3000`.
4. API reads and writes MySQL at `mysql:3306`.

## Environment

Development uses safe local defaults already present in the application:

- `NODE_ENV=development`
- `PORT=3000`
- `DB_HOST=mysql`
- `DB_PORT=3306`
- `DB_USER=mindx`
- `DB_PASSWORD=mindx`
- `DB_DATABASE=mind_x_refactor`
- `JWT_SECRET=mind-x-dev-secret-change-me`

Production mode sets `NODE_ENV=production` and provides explicit container-local database and JWT values through Compose. These values are still local defaults and are not intended as real production secrets.

## Seeding

Schema creation remains automatic through `docker/init.sql`. Seed accounts remain an explicit command so startup does not mutate application data unexpectedly:

```bash
docker compose -f docker/compose.dev.yml exec api npm run db:seed -w apps/api
docker compose -f docker/compose.prod.yml exec api npm run db:seed -w apps/api
```

## Error Handling

- MySQL health checks gate API startup.
- API health checks use `/api/health`.
- Web startup depends on the API service starting successfully.
- README documents volume reset commands for stale local database state.

## Testing

- Validate both Compose files with `docker compose ... config`.
- Run existing non-Docker verification: `npm run typecheck`, `npm test`, and `npm run build`.
- If Docker is available, run each mode with `docker compose up --build` and verify the documented URL and `/api/health`.

## Out Of Scope

- TLS termination.
- Real production secret management.
- CI/CD deployment manifests.
- Running database migrations beyond the existing `docker/init.sql` bootstrap.
