# mind-x-refactor

This is the mind-x 2.0 core refactor.

## Development

```bash
npm install
docker compose -f docker/docker-compose.yml up -d
npm run dev:api
npm run dev:web
```

Seed accounts:

- `blank / 123456`
- `admin / admin`

## Verification

```bash
npm run typecheck
npm test
npm run build
```
