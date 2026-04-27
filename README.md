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
docker compose -f docker/compose.dev.yml up
```

Open `http://localhost:5173`.

Development ports:

- Web: `http://localhost:5173`
- API: `http://localhost:3000`
- MySQL: `localhost:3307`

The development web container runs Vite and proxies `/api` to the API container.

The Compose stack automatically runs the idempotent `seed` service before starting the API, so the seed accounts are available on a fresh clone and after volume resets.

If a host port is already in use, override it when starting Compose:

```bash
WEB_HOST_PORT=5174 API_HOST_PORT=3001 MYSQL_HOST_PORT=3308 docker compose -f docker/compose.dev.yml up
```

Use `--build` when starting for the first time, after dependency changes, or after Dockerfile changes:

```bash
docker compose -f docker/compose.dev.yml up --build
```

To rebuild the images without starting containers:

```bash
docker compose -f docker/compose.dev.yml build
```

## Production-Like Docker Run

Run the API, MySQL, and nginx-served Vue app with `/api` proxied to the API service:

```bash
docker compose -f docker/compose.prod.yml up
```

Open `http://localhost:8080`.

Production-like ports:

- Web + API proxy: `http://localhost:8080`
- API and MySQL are only exposed inside the Compose network.

The production-like Compose file includes local default secrets for smoke testing only. Replace `JWT_SECRET`, `MYSQL_ROOT_PASSWORD`, `MYSQL_PASSWORD`, and related database values before adapting this setup for real deployment.

The production-like stack also runs the idempotent `seed` service before starting the API.

If `8080` is already in use, override it when starting Compose:

```bash
WEB_HOST_PORT=8081 docker compose -f docker/compose.prod.yml up
```

Use `--build` when starting for the first time, after dependency changes, or after Dockerfile changes:

```bash
docker compose -f docker/compose.prod.yml up --build
```

To rebuild the images without starting containers:

```bash
docker compose -f docker/compose.prod.yml build
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
curl http://localhost:3000/api/health

docker compose -f docker/compose.prod.yml up --build
curl http://localhost:8080/api/health
```

If the Docker daemon or socket is unavailable in the current environment, treat the Docker startup and seed steps as environment-blocked and continue with the non-Docker verification commands above.
