# Developer Onboarding — Gamesync

Welcome to Gamesync! This guide gets a new developer from zero to a working local setup and explains how the codebase is organized and how changes are made.

## What is Gamesync?

Gamesync is a web app that aggregates a user's game libraries from multiple stores (currently Steam and GOG) into a single, unified library view. It is:

- An **Angular 21** single-page application (PWA-enabled with a service worker).
- Backed by **Vercel serverless functions** (`api/`) for Steam, GOG, and blob-storage integrations.
- Structured so the same **Express** route logic (`backend/`) powers both the Vercel functions in production and a local dev server.

## Prerequisites

- **Node.js** (LTS recommended; the project uses ESM, `"type": "module"`)
- **npm 10.9.7** (pinned via `packageManager` in `package.json`)
- **Git**

## Getting Started

```bash
git clone <repo-url>
cd Gamesync
npm install
```

### Run the app locally

The frontend and backend run as separate processes in development:

```bash
# Terminal 1 — Angular dev server on http://localhost:4200
npm start

# Terminal 2 — Express backend on http://localhost:3000
npm run dev:backend
```

The Express app (helmet, CORS, JSON parsing, rate limiting at 100 req/min) mounts the same routers used by the Vercel functions:

| Route          | Purpose                    |
| -------------- | -------------------------- |
| `/api/steam/*` | Steam library & metadata   |
| `/api/gog/*`   | GOG integration            |
| `/api/blob/*`  | Blob storage operations    |
| `/health`      | Health check               |

## Project Layout

```
src/          Angular frontend
  app/
    core/       Models and singleton services (API clients, cache,
                rate limiter, settings, recommendations, logging)
    features/   Routed pages: library, game-detail, connections,
                logs, settings
    shared/     Reusable components (game-card)
api/          Vercel serverless functions (thin entry points: steam.ts,
              gog.ts, blob.ts) plus shared routers (_*-routes.ts)
backend/      Shared Express app (src/app.ts), local dev server
              (src/server.ts), and backend route tests (*.spec.ts)
public/       PWA manifest and icons
scripts/      Utility scripts (e.g. generate-icons.mjs)
spec.md       User stories — the source of truth for all changes
```

Key points:

- **Thin handlers in `api/`, logic in routers.** `api/steam.ts` is just `createApp('/api/steam', steamRouter)`. All real logic lives in `api/_*-routes.ts`, which is reused by `backend/src/app.ts`.
- **Routing** is defined in `src/app/app.routes.ts` with lazy-loaded standalone components.
- **State/services** live in `src/app/core/services/` — e.g. `SteamApiService`, `CacheService` (localStorage with TTL), `RateLimiterService`, `StoreConnectionService`.

## TypeScript Rules (Important!)

The `api/` and `backend/` directories are compiled by Vercel with TypeScript 5.9.x and `"module": "NodeNext"`:

1. **All relative imports in `api/` and `backend/` must use explicit `.js` extensions**, e.g.:
   ```ts
   import { steamRouter } from './_steam-routes.js';
   ```
2. **Cast route params to `string`** — newer `@types/express` widens them:
   ```ts
   const id = req.params.id as string;
   ```
3. **`npm run build` only checks the Angular frontend.** It does *not* type-check `api/` or `backend/`. Always run:
   ```bash
   npx tsc -p backend/tsconfig.json --noEmit
   ```

## Testing

Two test suites, both must pass:

| Suite    | Command                 | Runner  | Location                          |
| -------- | ----------------------- | ------- | --------------------------------- |
| Frontend | `npm test`              | Vitest via `ng test` | `src/app/**/*.spec.ts`   |
| Backend  | `npm run test:backend`  | Vitest (node env)    | `backend/src/**/*.spec.ts` |

Frontend tests exercise components and services; backend tests use supertest against the Express app.

## The Change Process (Required)

Every change — no exceptions — follows these four steps, defined in `CLAUDE.md`:

1. **Add a user story to `spec.md` first**, using the existing template:
   ```
   ### US-NNN: Title
   **As a** ... **I want** ... **So that** ...
   **Acceptance criteria:**
   - [ ] ...
   ```
2. **Write at least one test per user story** — a frontend spec, a backend spec, or both.
3. **All tests pass:** `npm test` **and** `npm run test:backend`.
4. **Builds pass:** `npm run build` **and** `npx tsc -p backend/tsconfig.json --noEmit`.

A change is only "done" when all four steps are complete.

## Useful Commands Cheatsheet

```bash
npm start                 # Angular dev server (localhost:4200)
npm run dev:backend       # Express backend (localhost:3000)
npm test                  # Frontend unit tests
npm run test:backend      # Backend route tests
npm run build             # Angular production build
npx tsc -p backend/tsconfig.json --noEmit   # Type-check api/ + backend/
ng generate component x   # Scaffold a new component
```

## Deployment

Deployed to **Vercel** (see `vercel.json`):

- Build command: `npm run build`, output: `dist/gamesync/browser`.
- `/api/steam/*`, `/api/gog/*`, `/api/blob/*` are rewritten to the corresponding serverless functions in `api/`.
- All other paths fall through to `index.html` (SPA routing).

## Where to Go Next

- Read `spec.md` to see the current user stories and what's already built.
- Read `CLAUDE.md` for the full development guidelines.
- Browse `src/app/core/services/` to understand the API client patterns (caching, rate limiting).
- Check `backend/src/routes/*.spec.ts` for examples of backend tests with supertest.

Happy coding!
