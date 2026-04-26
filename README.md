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

```bash
npm install
docker compose -f docker/docker-compose.yml up -d
npm run db:seed -w apps/api
npm run dev:api
npm run dev:web
```

Open `http://localhost:5173`.

Seed accounts:

- `blank / 123456`
- `admin / admin`

## Verification

```bash
docker compose -f docker/docker-compose.yml config
npm run typecheck
npm test
npm run build
```

For a full local smoke check with Docker available, also run:

```bash
docker compose -f docker/docker-compose.yml up -d
npm run db:seed -w apps/api
```

If the Docker daemon or socket is unavailable in the current environment, treat the Docker startup and seed steps as environment-blocked and continue with the non-Docker verification commands above.
