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
