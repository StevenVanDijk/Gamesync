# Development Guidelines

## Project layout

- `src/` — Angular frontend (unit tests via `npm test`, i.e. `ng test`).
- `api/` — Vercel serverless functions (thin handlers, e.g. `api/steam.ts`).
- `backend/` — shared Express app/route logic (`backend/src/app.ts`) used by both `api/*-routes.ts` and local dev (`npm run dev:backend`). Tests here run via `npm run test:backend` (Vitest), and its config (`backend/tsconfig.json`) also includes `api/**/*.ts`.

## TypeScript

Vercel compiles the `api/` directory with **TypeScript 5.9.x** (user-provided, `"module": "NodeNext"`).
Key implications:
- All relative imports inside `api/` and `backend/` **must** use explicit `.js` extensions (Node.js ESM requirement).
- Route params (`req.params.foo`) must be cast to `string` — newer `@types/express` widens them to `string | string[]`.
- `npm run build` (`ng build`) only builds and type-checks the Angular frontend — it does **not** validate `api/` or `backend/`. Before pushing, also type-check the backend/API code:
  ```
  npx tsc -p backend/tsconfig.json --noEmit
  ```
  The Vercel TS version/strictness for `api/` may differ from the Angular build, so this check can catch issues `ng build` misses.

## Change Process

Every change to this codebase must follow these rules:

1. **Add user stories to `spec.md`** before implementing any change. Each change must be described as one or more user stories in `spec.md`, following the existing template:
   - `**As a** ... **I want** ... **So that** ...` plus an `**Acceptance criteria:**` checklist.

2. **Every user story must be covered by at least one test.** No user story may be considered implemented without a corresponding test that exercises it.
   - Frontend behavior → a spec under `src/app/**` (`ng test`).
   - API/backend behavior → a spec under `backend/src/routes/**` (`vitest`/`test:backend`).

3. **All tests must pass** before a change is considered done — both suites:
   - `npm test` (Angular/frontend)
   - `npm run test:backend` (backend + `api/` routes)

4. **The production build must pass** before a change is considered done. A change that breaks either check is not complete:
   - `npm run build` (Angular production build)
   - `npx tsc -p backend/tsconfig.json --noEmit` (type-checks `backend/` and `api/`)

## Summary

| Step | Requirement |
|------|-------------|
| 1 | Add user story/stories to `spec.md` (using the standard template) |
| 2 | Write at least one test per user story (frontend spec and/or `backend/src/routes` spec) |
| 3 | `npm test` and `npm run test:backend` both pass |
| 4 | `npm run build` and `npx tsc -p backend/tsconfig.json --noEmit` both pass |

Only when all four steps are complete is a change considered done.
