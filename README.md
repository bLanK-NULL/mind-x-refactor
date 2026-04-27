# mind-x-refactor

Mind X 2.0 core refactor: a Docker-friendly mind map app with a Vue frontend, Koa API, MySQL database, and self-owned mind map engine.

## Quick Start

Development mode:

```bash
docker compose -f docker/compose.dev.yml up
```

Open `http://localhost:5173`.

Production-like mode:

```bash
docker compose -f docker/compose.prod.yml up
```

Open `http://localhost:8080`.

Both Compose modes automatically run the idempotent `seed` service before the API starts, so a fresh clone has usable test accounts after startup.

## Key Info

### Stack

- Vue 3 + Vite + TypeScript frontend
- Koa + TypeScript API
- MySQL 8 database
- Self-owned mind map engine
- `d3-zoom` for viewport pan and zoom

### Product Scope

- Login
- Project list
- Create, rename, and delete projects
- Mind map editing
- Manual save
- Local draft fallback
- Cross-tab project events
- PNG export

### Seed Accounts

- `blank / 123456`
- `admin / admin`

### Docker Modes

Development mode runs Vite and the API from bind-mounted source:

| Service | URL / Port | Notes |
| --- | --- | --- |
| Web | `http://localhost:5173` | Vite dev server |
| API | `http://localhost:3000` | Koa API |
| MySQL | `localhost:3307` | Container MySQL port `3306` |

Production-like mode builds the API, builds the Vue app, serves static assets through nginx, and proxies `/api` to the API service:

| Service | URL / Port | Notes |
| --- | --- | --- |
| Web + API proxy | `http://localhost:8080` | nginx |
| API | internal only | reachable through `/api` |
| MySQL | internal only | Compose network only |

The production-like Compose file uses local default secrets for smoke testing. Replace `JWT_SECRET`, `MYSQL_ROOT_PASSWORD`, `MYSQL_PASSWORD`, and related database values before adapting it for real deployment.

### Port Overrides

If host ports are already in use, override them when starting Compose.

Development:

```bash
WEB_HOST_PORT=5174 API_HOST_PORT=3001 MYSQL_HOST_PORT=3308 docker compose -f docker/compose.dev.yml up
```

Production-like:

```bash
WEB_HOST_PORT=8081 docker compose -f docker/compose.prod.yml up
```

### Rebuild Commands

Normal startup can use `up`. Use `--build` when starting for the first time, after dependency changes, or after Dockerfile changes.

```bash
docker compose -f docker/compose.dev.yml up --build
docker compose -f docker/compose.prod.yml up --build
```

To rebuild images without starting containers:

```bash
docker compose -f docker/compose.dev.yml build
docker compose -f docker/compose.prod.yml build
```

### Maintenance

Stop containers while keeping database data:

```bash
docker compose -f docker/compose.dev.yml down
docker compose -f docker/compose.prod.yml down
```

Stop containers and delete that mode's database volume:

```bash
docker compose -f docker/compose.dev.yml down -v
docker compose -f docker/compose.prod.yml down -v
```

Development and production-like modes use separate MySQL named volumes, so resetting one mode does not delete the other mode's data.

### Verification

```bash
docker compose -f docker/compose.dev.yml config
docker compose -f docker/compose.prod.yml config
npm run typecheck
npm test
npm run build
```

Full Docker smoke checks:

```bash
docker compose -f docker/compose.dev.yml up --build
curl http://localhost:3000/api/health

docker compose -f docker/compose.prod.yml up --build
curl http://localhost:8080/api/health
```

If the Docker daemon or socket is unavailable in the current environment, treat Docker startup as environment-blocked and continue with the non-Docker verification commands.

## Q&A

### Do I need to run seed manually?

No. Both Docker Compose files include a `seed` service. It waits for MySQL to be healthy, upserts the seed accounts, exits successfully, and then the API starts.

### What happens on a fresh clone with empty Docker images, containers, and volumes?

`docker compose up` builds missing local images, pulls `mysql:8.4`, creates containers and volumes, runs `docker/init.sql`, runs the `seed` service, then starts the API and web services. After startup, `blank / 123456` and `admin / admin` are ready to use.

### When should I use `--build`?

Use `--build` for the first startup on a clean machine, or after changing dependencies, Dockerfiles, or build-related files. For ordinary restarts, `docker compose ... up` is enough.

### Why can login return `401 Invalid username or password`?

The username/password pair did not match a row in `users`. In Docker mode this usually means the stack was started before automatic seeding existed, or a custom database volume does not have seed accounts. Run the current Compose file again, or reset that mode's volume with `down -v` and start it again.

### Why did API logs previously show `POST /api/auth/login 404` for a 401 response?

That was a request logging bug caused by logging before the error handler wrote the final status. Current API middleware logs the handled final status, so failed logins should show `401`.

### What should I do if a port is already occupied?

Use the port override environment variables shown in the Port Overrides section. For example, if `3307` is already occupied, start development mode with `MYSQL_HOST_PORT=3308`.

### How do I remove unused Docker data from this project?

Use `docker compose ... down -v` to remove a mode's containers and database volume. Dangling images from rebuilds can be removed with `docker image prune`, but that may also remove dangling images from other projects.
