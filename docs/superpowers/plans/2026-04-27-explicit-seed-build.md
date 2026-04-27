# Explicit Seed Build Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Docker Compose seed services build from the local API Dockerfiles explicitly so fresh-clone startup does not depend on a pre-existing API image tag or a registry pull.

**Architecture:** Keep the existing MySQL -> seed -> API -> web startup chain. Add a shared YAML build anchor per Compose mode and attach that build definition to the `seed` service. Omit `image` from `seed` so Compose builds a local service image directly instead of applying the default pull-first behavior for services that combine `image` and `build`.

**Tech Stack:** Docker Compose, Docker Compose Build Specification, YAML anchors, Node 20, MySQL 8.4, nginx.

---

## File Structure

- Modify: `docker/compose.dev.yml`
  - Owns the development Docker Compose graph.
  - Add a top-level `x-dev-api-build` extension anchor.
  - Use that anchor for both `seed` and `api`.
  - Leave the seed command, env, volumes, and dependency on healthy MySQL unchanged.
- Modify: `docker/compose.prod.yml`
  - Owns the production-like Docker Compose graph.
  - Add a top-level `x-prod-api-build` extension anchor.
  - Use that anchor for both `seed` and `api`.
  - Leave the seed command, env, and dependency on healthy MySQL unchanged.
- No business-code changes.
- No README command changes, because the user-facing startup commands stay the same.

## Reference Notes

Docker Compose docs say `docker compose up --build` builds images before starting containers. The Compose Build Specification also says that when a service has both `image` and `build` and no `pull_policy`, Compose tries to pull first and builds from source only if the image is not found. Docker Compose service docs say `image` can be omitted when a `build` section is declared. This plan uses that last rule for `seed` to avoid remote-pull ambiguity.

References:

- https://docs.docker.com/reference/cli/docker/compose/up/
- https://docs.docker.com/compose/compose-file/build/
- https://docs.docker.com/reference/compose-file/services/

### Task 1: Update Development Compose Seed Build

**Files:**
- Modify: `docker/compose.dev.yml`

- [ ] **Step 1: Run the failing development structure check**

Run from the repository root:

```bash
node -e "const { execFileSync } = require('node:child_process'); const config = JSON.parse(execFileSync('docker', ['compose', '-f', 'docker/compose.dev.yml', 'config', '--format', 'json'], { encoding: 'utf8' })); const seed = config.services.seed; const api = config.services.api; if (!seed.build) throw new Error('docker/compose.dev.yml seed build missing'); if (seed.image) throw new Error('docker/compose.dev.yml seed image should be omitted when seed has its own build'); if (seed.build.context !== api.build.context || seed.build.dockerfile !== api.build.dockerfile) throw new Error('docker/compose.dev.yml seed build must match api build');"
```

Expected: FAIL with this message:

```text
Error: docker/compose.dev.yml seed build missing
```

- [ ] **Step 2: Add the shared build anchor and wire it into development seed/api**

Edit `docker/compose.dev.yml` so the complete file is:

```yaml
name: mind-x-refactor-dev

x-dev-api-build: &dev-api-build
  context: ..
  dockerfile: docker/dev.Dockerfile

services:
  mysql:
    image: mysql:8.4
    restart: unless-stopped
    environment:
      MYSQL_ROOT_PASSWORD: root
      MYSQL_DATABASE: mind_x_refactor
      MYSQL_USER: mindx
      MYSQL_PASSWORD: mindx
      TZ: Asia/Shanghai
    ports:
      - "${MYSQL_HOST_PORT:-3307}:3306"
    volumes:
      - mind_x_refactor_dev_mysql:/var/lib/mysql
      - ./init.sql:/docker-entrypoint-initdb.d/init.sql:ro
    healthcheck:
      test: ["CMD-SHELL", "mysqladmin ping -h 127.0.0.1 -uroot -p$${MYSQL_ROOT_PASSWORD} --silent"]
      interval: 5s
      timeout: 3s
      retries: 20
      start_period: 20s

  seed:
    build: *dev-api-build
    restart: "no"
    command: npm run db:seed -w apps/api
    environment:
      NODE_ENV: development
      DB_HOST: mysql
      DB_PORT: 3306
      DB_USER: mindx
      DB_PASSWORD: mindx
      DB_DATABASE: mind_x_refactor
      JWT_SECRET: mind-x-dev-secret-change-me
    volumes:
      - ../apps:/workspace/apps
      - ../packages:/workspace/packages
      - ../package.json:/workspace/package.json:ro
      - ../package-lock.json:/workspace/package-lock.json:ro
      - ../tsconfig.base.json:/workspace/tsconfig.base.json:ro
    depends_on:
      mysql:
        condition: service_healthy

  api:
    image: mind-x-refactor-dev-api
    build: *dev-api-build
    restart: unless-stopped
    command: npm run dev:api
    environment:
      NODE_ENV: development
      PORT: 3000
      DB_HOST: mysql
      DB_PORT: 3306
      DB_USER: mindx
      DB_PASSWORD: mindx
      DB_DATABASE: mind_x_refactor
      JWT_SECRET: mind-x-dev-secret-change-me
    ports:
      - "${API_HOST_PORT:-3000}:3000"
    volumes:
      - ../apps:/workspace/apps
      - ../packages:/workspace/packages
      - ../package.json:/workspace/package.json:ro
      - ../package-lock.json:/workspace/package-lock.json:ro
      - ../tsconfig.base.json:/workspace/tsconfig.base.json:ro
    depends_on:
      seed:
        condition: service_completed_successfully
    healthcheck:
      test: ["CMD-SHELL", "node -e \"fetch('http://127.0.0.1:3000/api/health').then((response) => process.exit(response.ok ? 0 : 1)).catch(() => process.exit(1))\""]
      interval: 10s
      timeout: 5s
      retries: 12
      start_period: 20s

  web:
    build:
      context: ..
      dockerfile: docker/dev.Dockerfile
    restart: unless-stopped
    command: sh -c "npm run build -w packages/shared && npm run build -w packages/mind-engine && npm run dev:web"
    environment:
      VITE_API_PROXY_TARGET: http://api:3000
    ports:
      - "${WEB_HOST_PORT:-5173}:5173"
    volumes:
      - ../apps:/workspace/apps
      - ../packages:/workspace/packages
      - ../package.json:/workspace/package.json:ro
      - ../package-lock.json:/workspace/package-lock.json:ro
      - ../tsconfig.base.json:/workspace/tsconfig.base.json:ro
    depends_on:
      api:
        condition: service_healthy
    healthcheck:
      test: ["CMD-SHELL", "node -e \"fetch('http://127.0.0.1:5173').then((response) => process.exit(response.ok ? 0 : 1)).catch(() => process.exit(1))\""]
      interval: 10s
      timeout: 5s
      retries: 12
      start_period: 20s

volumes:
  mind_x_refactor_dev_mysql:
```

- [ ] **Step 3: Run development Compose config validation**

Run:

```bash
docker compose -f docker/compose.dev.yml config
```

Expected: PASS. Output prints normalized Compose YAML. Confirm the normalized `seed` service contains:

```yaml
build:
  context: /Users/blank/code/mind-x-sp/mind-x-refactor
  dockerfile: docker/dev.Dockerfile
```

and does not contain:

```yaml
image: mind-x-refactor-dev-api
```

- [ ] **Step 4: Re-run the development structure check**

Run:

```bash
node -e "const { execFileSync } = require('node:child_process'); const config = JSON.parse(execFileSync('docker', ['compose', '-f', 'docker/compose.dev.yml', 'config', '--format', 'json'], { encoding: 'utf8' })); const seed = config.services.seed; const api = config.services.api; if (!seed.build) throw new Error('docker/compose.dev.yml seed build missing'); if (seed.image) throw new Error('docker/compose.dev.yml seed image should be omitted when seed has its own build'); if (seed.build.context !== api.build.context || seed.build.dockerfile !== api.build.dockerfile) throw new Error('docker/compose.dev.yml seed build must match api build');"
```

Expected: PASS with no output.

- [ ] **Step 5: Commit the development Compose change**

Run:

```bash
git add docker/compose.dev.yml
git commit -m "fix(docker): build dev seed image locally"
```

Expected: PASS. Git creates one commit containing only `docker/compose.dev.yml`.

### Task 2: Update Production-Like Compose Seed Build

**Files:**
- Modify: `docker/compose.prod.yml`

- [ ] **Step 1: Run the failing production structure check**

Run from the repository root:

```bash
node -e "const { execFileSync } = require('node:child_process'); const config = JSON.parse(execFileSync('docker', ['compose', '-f', 'docker/compose.prod.yml', 'config', '--format', 'json'], { encoding: 'utf8' })); const seed = config.services.seed; const api = config.services.api; if (!seed.build) throw new Error('docker/compose.prod.yml seed build missing'); if (seed.image) throw new Error('docker/compose.prod.yml seed image should be omitted when seed has its own build'); if (seed.build.context !== api.build.context || seed.build.dockerfile !== api.build.dockerfile) throw new Error('docker/compose.prod.yml seed build must match api build');"
```

Expected: FAIL with this message:

```text
Error: docker/compose.prod.yml seed build missing
```

- [ ] **Step 2: Add the shared build anchor and wire it into production seed/api**

Edit `docker/compose.prod.yml` so the complete file is:

```yaml
name: mind-x-refactor-prod

x-prod-api-build: &prod-api-build
  context: ..
  dockerfile: docker/api.Dockerfile

services:
  mysql:
    image: mysql:8.4
    restart: unless-stopped
    environment:
      MYSQL_ROOT_PASSWORD: root
      MYSQL_DATABASE: mind_x_refactor
      MYSQL_USER: mindx
      MYSQL_PASSWORD: mindx
      TZ: Asia/Shanghai
    volumes:
      - mind_x_refactor_prod_mysql:/var/lib/mysql
      - ./init.sql:/docker-entrypoint-initdb.d/init.sql:ro
    healthcheck:
      test: ["CMD-SHELL", "mysqladmin ping -h 127.0.0.1 -uroot -p$${MYSQL_ROOT_PASSWORD} --silent"]
      interval: 5s
      timeout: 3s
      retries: 20
      start_period: 20s

  seed:
    build: *prod-api-build
    restart: "no"
    command: node apps/api/dist/db/seed.js
    environment:
      NODE_ENV: production
      DB_HOST: mysql
      DB_PORT: 3306
      DB_USER: mindx
      DB_PASSWORD: mindx
      DB_DATABASE: mind_x_refactor
      JWT_SECRET: mind-x-local-production-secret
    depends_on:
      mysql:
        condition: service_healthy

  api:
    image: mind-x-refactor-prod-api
    build: *prod-api-build
    restart: unless-stopped
    environment:
      NODE_ENV: production
      PORT: 3000
      DB_HOST: mysql
      DB_PORT: 3306
      DB_USER: mindx
      DB_PASSWORD: mindx
      DB_DATABASE: mind_x_refactor
      JWT_SECRET: mind-x-local-production-secret
    expose:
      - "3000"
    depends_on:
      seed:
        condition: service_completed_successfully
    healthcheck:
      test: ["CMD-SHELL", "node -e \"fetch('http://127.0.0.1:3000/api/health').then((response) => process.exit(response.ok ? 0 : 1)).catch(() => process.exit(1))\""]
      interval: 10s
      timeout: 5s
      retries: 12
      start_period: 20s

  web:
    build:
      context: ..
      dockerfile: docker/web.Dockerfile
    restart: unless-stopped
    ports:
      - "${WEB_HOST_PORT:-8080}:80"
    depends_on:
      api:
        condition: service_healthy
    healthcheck:
      test: ["CMD-SHELL", "wget -qO- http://127.0.0.1/ >/dev/null || exit 1"]
      interval: 10s
      timeout: 5s
      retries: 12
      start_period: 10s

volumes:
  mind_x_refactor_prod_mysql:
```

- [ ] **Step 3: Run production Compose config validation**

Run:

```bash
docker compose -f docker/compose.prod.yml config
```

Expected: PASS. Output prints normalized Compose YAML. Confirm the normalized `seed` service contains:

```yaml
build:
  context: /Users/blank/code/mind-x-sp/mind-x-refactor
  dockerfile: docker/api.Dockerfile
```

and does not contain:

```yaml
image: mind-x-refactor-prod-api
```

- [ ] **Step 4: Re-run the production structure check**

Run:

```bash
node -e "const { execFileSync } = require('node:child_process'); const config = JSON.parse(execFileSync('docker', ['compose', '-f', 'docker/compose.prod.yml', 'config', '--format', 'json'], { encoding: 'utf8' })); const seed = config.services.seed; const api = config.services.api; if (!seed.build) throw new Error('docker/compose.prod.yml seed build missing'); if (seed.image) throw new Error('docker/compose.prod.yml seed image should be omitted when seed has its own build'); if (seed.build.context !== api.build.context || seed.build.dockerfile !== api.build.dockerfile) throw new Error('docker/compose.prod.yml seed build must match api build');"
```

Expected: PASS with no output.

- [ ] **Step 5: Commit the production Compose change**

Run:

```bash
git add docker/compose.prod.yml
git commit -m "fix(docker): build prod seed image locally"
```

Expected: PASS. Git creates one commit containing only `docker/compose.prod.yml`.

### Task 3: Verify Fresh-Startup Semantics

**Files:**
- Read-only verification after Tasks 1 and 2.

- [ ] **Step 1: Validate both Compose files**

Run:

```bash
docker compose -f docker/compose.dev.yml config
docker compose -f docker/compose.prod.yml config
```

Expected: both commands PASS and print normalized Compose YAML.

- [ ] **Step 2: Verify both seed services have local builds and no image tags**

Run:

```bash
node -e "const { execFileSync } = require('node:child_process'); for (const file of ['docker/compose.dev.yml', 'docker/compose.prod.yml']) { const config = JSON.parse(execFileSync('docker', ['compose', '-f', file, 'config', '--format', 'json'], { encoding: 'utf8' })); const seed = config.services.seed; const api = config.services.api; if (!seed.build) throw new Error(file + ' seed build missing'); if (seed.image) throw new Error(file + ' seed image should be omitted when seed has its own build'); if (seed.build.context !== api.build.context || seed.build.dockerfile !== api.build.dockerfile) throw new Error(file + ' seed build must match api build'); }"
```

Expected: PASS with no output.

- [ ] **Step 3: Run a dry-run startup check**

Run:

```bash
docker compose --dry-run -f docker/compose.dev.yml up --build -d
docker compose --dry-run -f docker/compose.prod.yml up --build -d
```

Expected: both commands show build/create/start actions. The output must not include either of these lines:

```text
seed Pulling
seed Error authorization failed
```

- [ ] **Step 4: Run full Docker smoke checks**

Run development mode:

```bash
docker compose -f docker/compose.dev.yml up --build -d
curl -sS http://localhost:3000/api/health
curl -sS -I http://localhost:5173
```

Expected development output includes:

```text
{"status":"ok"}
HTTP/1.1 200 OK
```

Run production-like mode:

```bash
docker compose -f docker/compose.prod.yml up --build -d
curl -sS http://localhost:8080/api/health
curl -sS -I http://localhost:8080
```

Expected production-like output includes:

```text
{"status":"ok"}
HTTP/1.1 200 OK
```

- [ ] **Step 5: Clean up smoke-test containers only after verification**

Run:

```bash
docker compose -f docker/compose.dev.yml down
docker compose -f docker/compose.prod.yml down
```

Expected: Compose stops and removes containers and networks. Named MySQL volumes remain because this command does not use `-v`.

## Self-Review

Spec coverage: The plan implements方案 A by making `seed` explicitly build from the same Dockerfile and context as `api` in both Docker Compose modes. It preserves the existing MySQL health gate, seed success gate, API health gate, ports, volumes, commands, and environment values.

Placeholder scan: The plan has no placeholder sections, vague edit instructions, or deferred implementation details.

Type consistency: The structural checks use the same service names and Compose paths in every task: `seed`, `api`, `build.context`, `build.dockerfile`, `docker/compose.dev.yml`, and `docker/compose.prod.yml`.
