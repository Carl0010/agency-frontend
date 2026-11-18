# syntax=docker/dockerfile:1
# Agency web client. Build args are baked in at build time:
#   docker build --build-arg NEXT_PUBLIC_WS_URL=https://app.example.com -t agency-web .
# NEXT_PUBLIC_WS_URL  the origin the browser opens the realtime socket on (the app's own origin
#                     behind the reverse proxy, which routes /ws to the API)
# API_INTERNAL_URL    where Next.js proxies /api/v1 when a request reaches it directly

FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY vendor ./vendor
RUN npm ci --no-audit --no-fund

FROM deps AS build
COPY . .
ARG NEXT_PUBLIC_WS_URL
ARG API_INTERNAL_URL=http://api:4100
ENV NEXT_PUBLIC_WS_URL=$NEXT_PUBLIC_WS_URL \
    API_INTERNAL_URL=$API_INTERNAL_URL \
    NEXT_TELEMETRY_DISABLED=1
RUN test -n "$NEXT_PUBLIC_WS_URL" || (echo "Set --build-arg NEXT_PUBLIC_WS_URL=https://<your domain>" && exit 1)
RUN npm run build

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
WORKDIR /app
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
USER node
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=3s --start-period=15s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:3000/login').then(r=>process.exit(r.status<500?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
