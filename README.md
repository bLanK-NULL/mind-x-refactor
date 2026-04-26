# mind-x-refactor

This is the mind-x 2.0 core refactor.

## Stack

- Vue 3 + Vite + TypeScript frontend
- Koa + TypeScript API
- MySQL 8 database
- Self-owned mind map engine
- `d3-zoom` for viewport pan and zoom

## Product Scope

- Login
- Project list
- Create, rename, and delete projects
- Mind map editing
- Manual save
- Local draft fallback
- Cross-tab project events
- PNG export

## Development

Run the full frontend + API + MySQL stack in Docker:

```bash
docker compose -f docker/compose.dev.yml up --build
```

In another terminal, seed the local users:

```bash
docker compose -f docker/compose.dev.yml exec api npm run db:seed -w apps/api
```

Open `http://localhost:5173`.

Development ports:

- Web: `http://localhost:5173`
- API: `http://localhost:3000`
- MySQL: `localhost:3307`

The development web container runs Vite and proxies `/api` to the API container.

If a host port is already in use, override it when starting Compose:

```bash
WEB_HOST_PORT=5174 API_HOST_PORT=3001 MYSQL_HOST_PORT=3308 docker compose -f docker/compose.dev.yml up --build
```

## Production-Like Docker Run

Build the API, build the Vue app, serve the frontend through nginx, and proxy `/api` to the API service:

```bash
docker compose -f docker/compose.prod.yml up --build
```

In another terminal, seed the local users:

```bash
docker compose -f docker/compose.prod.yml exec api node apps/api/dist/db/seed.js
```

Open `http://localhost:8080`.

Production-like ports:

- Web + API proxy: `http://localhost:8080`
- API and MySQL are only exposed inside the Compose network.

The production-like Compose file includes local default secrets for smoke testing only. Replace `JWT_SECRET`, `MYSQL_ROOT_PASSWORD`, `MYSQL_PASSWORD`, and related database values before adapting this setup for real deployment.

If `8080` is already in use, override it when starting Compose:

```bash
WEB_HOST_PORT=8081 docker compose -f docker/compose.prod.yml up --build
```

Seed accounts:

- `blank / 123456`
- `admin / admin`

## Docker Maintenance

Stop containers while keeping database data:

```bash
docker compose -f docker/compose.dev.yml down
docker compose -f docker/compose.prod.yml down
```

Stop containers and delete the mode's database volume:

```bash
docker compose -f docker/compose.dev.yml down -v
docker compose -f docker/compose.prod.yml down -v
```

Development and production-like modes use separate MySQL named volumes, so resetting one mode does not delete the other mode's data.

## Verification

```bash
docker compose -f docker/compose.dev.yml config
docker compose -f docker/compose.prod.yml config
npm run typecheck
npm test
npm run build
```

For full Docker smoke checks:

```bash
docker compose -f docker/compose.dev.yml up --build
docker compose -f docker/compose.dev.yml exec api npm run db:seed -w apps/api
curl http://localhost:3000/api/health

docker compose -f docker/compose.prod.yml up --build
docker compose -f docker/compose.prod.yml exec api node apps/api/dist/db/seed.js
curl http://localhost:8080/api/health
```

If the Docker daemon or socket is unavailable in the current environment, treat the Docker startup and seed steps as environment-blocked and continue with the non-Docker verification commands above.
