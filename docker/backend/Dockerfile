# syntax=docker/dockerfile:1

FROM node:24-alpine AS builder

RUN apk add --no-cache python3 make g++ libc6-compat
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

WORKDIR /app

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc tsconfig.base.json tsconfig.json ./
COPY lib ./lib
COPY artifacts/api-server ./artifacts/api-server

# api-server tree + @workspace/db (incl. drizzle-kit for the migrate target)
RUN pnpm install --frozen-lockfile --filter @workspace/api-server... --filter @workspace/db...

WORKDIR /app/artifacts/api-server
RUN pnpm run build

WORKDIR /app
RUN pnpm deploy --filter @workspace/api-server --prod /prod

FROM builder AS migrate

WORKDIR /app

CMD ["pnpm", "--filter", "@workspace/db", "run", "migrate"]

FROM node:24-alpine AS runner

RUN apk add --no-cache libc6-compat

WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /prod ./

EXPOSE 3000

CMD ["node", "--enable-source-maps", "dist/index.mjs"]
