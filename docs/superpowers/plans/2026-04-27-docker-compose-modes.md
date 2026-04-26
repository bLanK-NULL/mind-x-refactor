# Docker Compose Modes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Docker Compose startup paths for development and production-like runs of the Vue frontend, Koa API, and MySQL database.

**Architecture:** Development mode runs Vite and the API from bind-mounted source with a shared Node dependency image. Production mode builds the API into a Node runtime image and builds the web app into nginx static assets with `/api` reverse proxying. MySQL is shared conceptually but uses separate named volumes per mode.

**Tech Stack:** Docker Compose, Docker multi-stage builds, Node 20, npm workspaces, Vue/Vite, Koa, MySQL 8.4, nginx.

---

### File Structure

- Create: `.dockerignore` to keep Docker build contexts small and avoid copying local build artifacts.
- Create: `docker/dev.Dockerfile` for development `api` and `web` services.
- Create: `docker/api.Dockerfile` for production API builds.
- Create: `docker/web.Dockerfile` for production web builds.
- Create: `docker/nginx.conf` for static web serving and `/api` proxying.
- Create: `docker/compose.dev.yml` for development services.
- Create: `docker/compose.prod.yml` for production-like services.
- Modify: `apps/web/vite.config.ts` so the dev proxy target can point at `api:3000` inside Docker while preserving `127.0.0.1:3000` locally.
- Modify: `README.md` to document both modes, seed commands, ports, environment defaults, and verification.
- Remove: `docker/docker-compose.yml` after the mode-specific Compose files replace it.

### Task 1: Add Docker Build Inputs

**Files:**
- Create: `.dockerignore`
- Create: `docker/dev.Dockerfile`
- Create: `docker/api.Dockerfile`
- Create: `docker/web.Dockerfile`
- Create: `docker/nginx.conf`

- [ ] **Step 1: Add `.dockerignore`**

```dockerignore
node_modules/
**/node_modules/
dist/
**/dist/
coverage/
.git/
.worktrees/
docker/mysql-data/
.env
.env.local
.DS_Store
```

- [ ] **Step 2: Add `docker/dev.Dockerfile`**

```dockerfile
FROM node:20-bookworm-slim

WORKDIR /workspace

COPY package.json package-lock.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/mind-engine/package.json packages/mind-engine/package.json
COPY packages/shared/package.json packages/shared/package.json

RUN npm ci

COPY . .

EXPOSE 3000 5173
```

- [ ] **Step 3: Add production API Dockerfile**

The file builds shared packages and the API, then runs `node apps/api/dist/server.js` with `NODE_ENV=production`.

- [ ] **Step 4: Add production web Dockerfile and nginx config**

The web Dockerfile builds `apps/web/dist` and copies it into nginx. The nginx config serves `index.html` for frontend routes and proxies `/api/` to `http://api:3000/api/`.

### Task 2: Add Compose Mode Files

**Files:**
- Create: `docker/compose.dev.yml`
- Create: `docker/compose.prod.yml`
- Delete: `docker/docker-compose.yml`

- [ ] **Step 1: Add development Compose file**

Development services:

- `mysql`: `mysql:8.4`, host port `3307`, named volume `mind_x_refactor_dev_mysql`, health check with `mysqladmin ping`.
- `api`: built from `docker/dev.Dockerfile`, source mounted at `/workspace`, root `node_modules` stored in `mind_x_refactor_dev_node_modules`, command `npm run dev:api`, host port `3000`.
- `web`: built from `docker/dev.Dockerfile`, source mounted at `/workspace`, command builds shared packages then runs `npm run dev:web`, host port `5173`, `VITE_API_PROXY_TARGET=http://api:3000`.

- [ ] **Step 2: Add production Compose file**

Production-like services:

- `mysql`: `mysql:8.4`, named volume `mind_x_refactor_prod_mysql`, no host port by default.
- `api`: built from `docker/api.Dockerfile`, `NODE_ENV=production`, internal port `3000`, health check on `/api/health`.
- `web`: built from `docker/web.Dockerfile`, host port `8080`, depends on healthy API.

- [ ] **Step 3: Remove the old MySQL-only Compose file**

Remove `docker/docker-compose.yml` so users do not keep using a stale MySQL-only entry point.

### Task 3: Make Vite Proxy Docker-Aware

**Files:**
- Modify: `apps/web/vite.config.ts`

- [ ] **Step 1: Replace the hard-coded proxy target**

Use `process.env.VITE_API_PROXY_TARGET ?? process.env.API_PROXY_TARGET ?? 'http://127.0.0.1:3000'` and pass that value to `server.proxy['/api']`.

- [ ] **Step 2: Verify local behavior remains unchanged**

Run: `npm run typecheck`

Expected: TypeScript succeeds and the non-Docker default proxy remains `http://127.0.0.1:3000`.

### Task 4: Update README

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Replace the single development command block**

Document:

```bash
docker compose -f docker/compose.dev.yml up --build
docker compose -f docker/compose.dev.yml exec api npm run db:seed -w apps/api
```

Access URL: `http://localhost:5173`.

- [ ] **Step 2: Add production-like command block**

Document:

```bash
docker compose -f docker/compose.prod.yml up --build
docker compose -f docker/compose.prod.yml exec api node apps/api/dist/db/seed.js
```

Access URL: `http://localhost:8080`.

- [ ] **Step 3: Add maintenance commands**

Document `down`, `down -v`, and Compose config validation for both files.

### Task 5: Verify

**Files:**
- Read-only verification.

- [ ] **Step 1: Validate Compose syntax**

Run:

```bash
docker compose -f docker/compose.dev.yml config
docker compose -f docker/compose.prod.yml config
```

Expected: both commands print normalized Compose YAML without errors.

- [ ] **Step 2: Run repository verification**

Run:

```bash
npm run typecheck
npm test
npm run build
```

Expected: all commands pass.

- [ ] **Step 3: Docker smoke test if Docker daemon is available**

Run development and production-like modes with `up --build`, then check:

```bash
curl http://localhost:5173
curl http://localhost:3000/api/health
curl http://localhost:8080
curl http://localhost:8080/api/health
```

Expected: web URLs return HTML and health URLs return `{"status":"ok"}`.

### Self-Review

- Spec coverage: The plan covers separate dev/prod commands, frontend/backend/MySQL services, MySQL health gating, API/web serving differences, seeding, README updates, and verification.
- Placeholder scan: The plan contains no placeholders requiring later product decisions.
- Type consistency: Service names, ports, environment variables, and paths match the spec and current repository layout.
