FROM node:20-bookworm-slim AS build

WORKDIR /workspace

COPY package.json package-lock.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/mind-engine/package.json packages/mind-engine/package.json
COPY packages/shared/package.json packages/shared/package.json

RUN npm ci

COPY . .

RUN npm run build -w packages/shared \
  && npm run build -w packages/mind-engine \
  && npm run build -w apps/api

FROM node:20-bookworm-slim

ENV NODE_ENV=production

WORKDIR /workspace

COPY --from=build /workspace/package.json /workspace/package-lock.json ./
COPY --from=build /workspace/node_modules ./node_modules
COPY --from=build /workspace/apps/api/package.json ./apps/api/package.json
COPY --from=build /workspace/apps/api/dist ./apps/api/dist
COPY --from=build /workspace/packages/mind-engine/package.json ./packages/mind-engine/package.json
COPY --from=build /workspace/packages/mind-engine/dist ./packages/mind-engine/dist
COPY --from=build /workspace/packages/shared/package.json ./packages/shared/package.json
COPY --from=build /workspace/packages/shared/dist ./packages/shared/dist

EXPOSE 3000

CMD ["node", "apps/api/dist/server.js"]
