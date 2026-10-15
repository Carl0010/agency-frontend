# Agency frontend

The web client for Agency: boards and cards, a chat channel per project, a restricted portal for
client guests, Trello import and billing. Next.js (App Router), Tailwind CSS v4 and TanStack Query.

The API lives in the backend repository, [agency-mvp](https://github.com/Carl0010/agency-mvp). This
app holds no business rules; it renders what the API returns.

## Run it locally

You need Node 20 or later, and the backend running (it brings Postgres and S3 with Docker).

```sh
# backend, in a sibling folder
git clone git@github.com:Carl0010/agency-mvp.git ../agency-mvp
cd ../agency-mvp && npm install && npm run infra:up
cp apps/api/.env.example apps/api/.env   # set JWT_ACCESS_SECRET (>= 32 chars)
npm run db:migrate && npm run dev:api     # http://localhost:4100

# this app
cd ../agency-frontend
cp .env.example .env.local
npm install
npm run dev                               # http://localhost:3200
```

`.env.example` explains the two variables: where the Next server proxies `/api/v1`, and the realtime
socket origin.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server on port 3200 |
| `npm run build` / `npm start` | Production build and server |
| `npm run lint` | ESLint, including the design-system colour rule |
| `npm run typecheck` | TypeScript |
| `npm test` | Unit tests (Jest) |
| `npm run test:e2e` | Playwright journeys against a running API, Postgres and S3. Set `BACKEND_DIR` if the backend is not at `../agency-mvp`. |

## Documentation

- [AGENTS.md](AGENTS.md): rules for anyone (human or AI) changing this code.
- [docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md): tokens, typography, components.
- [docs/NAVIGATION.md](docs/NAVIGATION.md): what the sidebar, headers and pages each own.

## History

This code was split out of the `apps/web` folder of agency-mvp on 2026-10-15, with its history kept.
