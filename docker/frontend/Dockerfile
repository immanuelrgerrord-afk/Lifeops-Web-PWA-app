# syntax=docker/dockerfile:1

FROM node:24-alpine AS builder

RUN apk add --no-cache python3 make g++ libc6-compat
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

WORKDIR /app

ARG EXPO_PUBLIC_API_URL
ARG FRONTEND_ORIGIN

ENV EXPO_PUBLIC_API_URL=${EXPO_PUBLIC_API_URL}
ENV FRONTEND_ORIGIN=${FRONTEND_ORIGIN}

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json tsconfig.json ./
COPY lib/api-client-react ./lib/api-client-react
COPY artifacts/mobile ./artifacts/mobile

RUN pnpm install --frozen-lockfile --filter @workspace/mobile...

WORKDIR /app/artifacts/mobile
RUN pnpm exec expo export --platform web --output-dir dist

FROM nginx:1.27-alpine AS runner

COPY docker/frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/artifacts/mobile/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
