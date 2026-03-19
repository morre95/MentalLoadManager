# Repository Guidelines

## Purpose
This repository contains the Mental Load Manager product across three apps plus shared client utilities:
- `backend/`: FastAPI API with SQLAlchemy models, auth/session handling, rate limiting, email flows, analytics, and background cache maintenance.
- `frontend/`: Vite + React web app using React Router, TanStack Query, Tailwind CSS v4, Radix UI primitives, and shared API helpers.
- `mobile/`: Expo + React Native app using Expo Router and TypeScript.
- `shared/`: shared JavaScript API client and domain helpers consumed by the frontend and/or mobile apps.

This file is intended for coding agents and contributors working in this repo. Follow the real repository shape and commands below instead of generic defaults.

## Workspace Layout

### Root
- `AGENTS.md`: repo-specific agent instructions.
- `README.md`: high-level project readme. It is older and less accurate than this file.
- `docker-compose.yml`: basic frontend/backend container setup.
- `start-all.sh` / `start-all.bat`: convenience scripts for running backend + frontend locally.
- `backup.sql`, `backend/setup_db.sql`, `backend/alter_table.sql`, `backend/insert_tasks.sql`: database/bootstrap SQL assets.
- `cron_job/`: cron-job Docker support.

### Backend
- Entry point: `backend/main.py`
- Main package: `backend/app/v1/`
- Routers: `backend/app/v1/routers/<domain>/`
- Models: `backend/app/v1/models/`
- Tests: `backend/app/v1/tests/`
- Config: `backend/app/v1/config.py`
- Rate limiter: `backend/app/v1/limiter.py`
- Shared validation helpers: `backend/app/v1/routers/input_validation.py`
- Background maintenance: `backend/app/v1/cache_maintenance.py`
- Static mood assets: `backend/assets/mood-tracker/`

### Frontend
- App entry: `frontend/src/main.jsx`
- App shell and routes: `frontend/src/App.jsx`
- Pages: `frontend/src/pages/`
- Dashboard pages: `frontend/src/pages/dashboard/`
- Layouts: `frontend/src/layouts/`
- Components: `frontend/src/components/`
- Hooks: `frontend/src/hooks/`
- Utilities and app-specific helpers: `frontend/src/lib/`
- Styling: `frontend/src/index.css`, `frontend/src/App.css`
- Aliases from Vite config:
  - `@` -> `frontend/src`
  - `@shared` -> `shared`

### Mobile
- Expo Router app entry: `mobile/app/_layout.tsx`
- Tab routes: `mobile/app/(tabs)/`
- Auth route: `mobile/app/login.tsx`
- Shared mobile components: `mobile/components/`
- Hooks: `mobile/hooks/`
- API/auth utilities: `mobile/lib/`
- TypeScript alias:
  - `@/*` -> `mobile/*`

### Shared
- `shared/apiClient.js`: request client, token refresh flow, offline queueing, and retry behavior.
- Domain helpers include `calendar.js`, `tasks.js`, `goals.js`, `analytics.js`, `households.js`, `users.js`, `env.js`, and `index.js`.

## Architecture Conventions

### Backend conventions
- Keep each feature router split into:
  - `routes.py`
  - `service.py`
  - `repository.py`
  - `schemas.py`
- Existing router domains include:
  - `users`
  - `login`
  - `mood_tracker`
  - `kanban`
  - `calendar`
  - `contact`
  - `dashboard`
  - `features`
  - `ai_summaries`
  - `household`
  - `analytics`
  - `goals`
  - `settings`
- Register new routers through `backend/app/v1/routers/__init__.py`.
- API URLs should remain versioned under `/api/v1/...`.
- Prefer business logic in `service.py`, persistence/query logic in `repository.py`, and request/response contracts in `schemas.py`.
- Reuse shared validation helpers from `backend/app/v1/routers/input_validation.py` instead of duplicating field validation logic.

### Frontend conventions
- Public pages live in `frontend/src/pages/`.
- Authenticated dashboard route content lives in `frontend/src/pages/dashboard/`.
- Reusable UI belongs in `frontend/src/components/`.
- Domain-specific components should stay grouped under subfolders like `analytics/`, `dashboard/`, `goals/`, `household/`, `landing/`, `mood/`, `tasks/`, and `ui/`.
- Routing is defined centrally in `frontend/src/App.jsx`.
- The frontend already uses:
  - `RequireAuth` for protected dashboard routes
  - `ErrorBoundary` wrappers around route-level UI
  - `@tanstack/react-query` for data fetching/state
  - shared API utilities via `@shared`

### Mobile conventions
- Use Expo Router file-based routing.
- Keep route screens inside `mobile/app/`.
- Shared presentation should stay in `mobile/components/`.
- Shared logic should stay in `mobile/hooks/` or `mobile/lib/`.
- Preserve TypeScript strictness in `mobile/tsconfig.json`.

## Build, Run, and Verification Commands

### Backend
- Install dependencies:
  - `cd backend && pip install -r requirements.txt`
- Run local API:
  - `cd backend && fastapi dev main.py`
- Alternative production-like run:
  - `cd backend && uvicorn main:app --reload`
- Run tests:
  - `cd backend && python -m unittest discover -s app/v1/tests -p 'test_*.py'`

### Frontend
- Install dependencies:
  - `cd frontend && npm install`
- Start dev server:
  - `cd frontend && npm run dev`
- Build:
  - `cd frontend && npm run build`
- Lint:
  - `cd frontend && npm run lint`
- Preview production build:
  - `cd frontend && npm run preview`

### Mobile
- Install dependencies:
  - `cd mobile && npm install`
- Start Expo:
  - `cd mobile && npm run start`
- Platform targets:
  - `cd mobile && npm run ios`
  - `cd mobile && npm run android`
  - `cd mobile && npm run web`
- Lint:
  - `cd mobile && npm run lint`

### Combined/dev helper
- `./start-all.sh` starts backend and frontend together, assuming `backend/venv/` already exists.

### Containers
- `docker compose up --build`

## Environment and Configuration
- Backend settings are defined in `backend/app/v1/config.py` via `pydantic-settings`.
- Expected backend environment variables include:
  - `JWT_SECRET`
  - `JWT_EXPIRE_MINUTES`
  - `BACKEND_URL`
  - `FRONTEND_URL`
  - `GOOGLE_CLIENT_ID`
  - `GOOGLE_CLIENT_SECRET`
  - `GOOGLE_REDIRECT_URI`
  - `FACEBOOK_CLIENT_ID`
  - `FACEBOOK_CLIENT_SECRET`
  - `INSTAGRAM_CLIENT_ID`
  - `INSTAGRAM_CLIENT_SECRET`
  - `DATABASE_URL`
  - `OPENROUTER_API_KEY`
  - `OPENROUTER_WEEKLY_SUMMARY_MODEL`
  - `OPENROUTER_WEEKLY_SUMMARY_FALLBACK_MODELS`
  - `OPENROUTER_ANALYTICS_INSIGHTS_MODEL`
  - `OPENROUTER_ANALYTICS_INSIGHTS_FALLBACK_MODELS`
  - `CORS_ALLOW_ORIGINS`
  - `SESSION_SECRET`
  - `SESSION_COOKIE_SECURE`
  - `SESSION_COOKIE_SAMESITE`
  - `SESSION_COOKIE_MAX_AGE_SECONDS`
  - `RESEND_API_KEY`
  - `MAIL_FROM`
  - `MAIL_FROM_NAME`
  - `CONTACT_RECIPIENT_EMAIL`
  - `WEEKLY_SUMMARY_CRON_SECRET`
- `SettingsConfigDict(env_file=".env", extra="ignore")` is used in the backend. Keep local backend env values in `backend/.env` unless the setup is intentionally different.

## Coding Style

### Python
- Follow PEP 8 with 4-space indentation.
- Use `snake_case` for modules, variables, and functions.
- Use `PascalCase` for classes and Pydantic/SQLAlchemy models.
- Keep route handlers thin; move substantial logic into services/repositories.
- Add type hints when touching existing typed backend code.

### Frontend web
- Use 2-space indentation.
- Prefer `PascalCase` component filenames and exports.
- Hooks should start with `use`.
- Follow the existing import style:
  - local app imports via `@/...`
  - shared utilities via `@shared/...`
- Preserve the existing React Router route structure unless a route reorganization is part of the task.

### Mobile
- Preserve TypeScript typing and Expo Router conventions.
- Match the existing single-quote style already used in mobile source files.

## Testing Guidelines

### General
- Every bug fix should include a regression test when practical.
- Every security-sensitive change should include or update a test.
- Do not claim tests passed unless you actually ran them.

### Backend
- Tests currently live in `backend/app/v1/tests/`, not `backend/tests/`.
- Use `unittest` naming conventions:
  - files: `test_*.py`
  - test methods: `test_*`
- Existing backend tests already cover areas such as:
  - login lockout
  - household invite email flows
  - household rate limits
  - analytics authorization
  - CORS policy
  - input validation
  - recurring tasks
  - kanban pagination
  - refresh password session flow
  - AI weekly summary dispatch and query logic
  - setup/db bootstrap
  - mood tracker artwork

### Frontend and mobile
- No dedicated automated test suite is currently present in the repo for web/mobile.
- Minimum verification for web/mobile changes:
  - run lint in the affected app
  - run a local build for frontend changes
  - sanity-check the relevant route/screen manually when feasible

## Commit and PR Guidance
- Existing history is mixed, but prefer conventional commit prefixes:
  - `feat: ...`
  - `fix: ...`
  - `refactor: ...`
  - `test: ...`
  - `docs: ...`
- Keep each commit scoped to one concern.
- PRs should include:
  - problem summary
  - solution summary
  - affected apps (`backend`, `frontend`, `mobile`, `shared`)
  - exact verification performed
  - screenshots/recordings for UI changes

## Security and Quality Rules

### Authentication and authorization
- Always verify household membership before returning household-scoped data.
- Always verify the current user is allowed to access the requested resource.
- Use generic auth failure messages when appropriate. Do not leak whether a user exists.
- Preserve the existing login-attempt/lockout protections. Do not weaken them.
- Prefer `403` for unauthorized access and `404` when hiding resource existence is the safer behavior.

### Rate limiting
- Public endpoints should use the `slowapi` limiter unless there is a clear reason not to.
- The limiter instance lives in `backend/app/v1/limiter.py`.
- Maintain or improve rate-limit coverage when adding public routes.
- Do not remove rate-limit protections from existing auth/contact/invite flows.

### CORS and session security
- Do not use wildcard `*` CORS methods or headers.
- Preserve explicit CORS methods:
  - `GET`
  - `POST`
  - `PUT`
  - `DELETE`
  - `PATCH`
- Preserve explicit CORS headers:
  - `Authorization`
  - `Content-Type`
- Keep session configuration aligned with `SESSION_COOKIE_*` settings.
- Avoid enabling insecure cookie/session behavior without a concrete need.
- `backend/main.py` currently instantiates `FastAPI(..., debug=True)`. If you touch production configuration, move toward environment-controlled debug behavior rather than hardcoding debug mode.

### Input validation
- Validate and sanitize all external inputs.
- Reuse existing validation helpers where possible.
- Respect current backend validation caps already defined in code:
  - task name: `255`
  - task description: currently `2000` in code
  - household name: `200`
  - category name: `100`
- Strip HTML/script/style tags from free-text fields where applicable.
- Return `400` with clear validation details for bad input.

### Error handling
- Avoid leaking stack traces, SQL details, secrets, provider responses, or internal implementation details to clients.
- Log server-side failures appropriately.
- Use structured HTTP errors with suitable status codes.
- On the frontend, preserve error boundaries around major route-level surfaces. New major features should have a failure boundary strategy.

### Data and performance
- Add indexes when introducing new foreign keys or commonly filtered/joined columns.
- Pagination is expected for list-style endpoints. Preserve or add pagination behavior instead of returning unbounded collections.
- Avoid N+1 query patterns in repositories/services.
- Be careful with background tasks and cache maintenance flows; the backend starts a cache-maintenance loop during lifespan startup.

## Agent Workflow Rules

### Before editing
- Inspect the relevant code path first.
- Match the style of the touched area instead of introducing a new pattern casually.
- Check whether the same concern already exists in `shared/`, `hooks/`, validation helpers, or another router before duplicating code.

### While editing
- Prefer minimal, targeted changes.
- Do not rewrite unrelated files.
- Preserve public API shapes unless the task explicitly requires a breaking change.
- When adding a new backend feature:
  - add/update schemas
  - add/update service/repository logic
  - wire router registration if needed
  - add/update tests
- When adding a new frontend page or dashboard feature:
  - place route UI in `pages/`
  - move reusable subparts into `components/`
  - use shared API helpers instead of bespoke fetch logic when practical
- When adding mobile functionality:
  - use Expo Router screen placement
  - centralize API/auth logic under `mobile/lib/` when shared across screens

### Before finishing
- Run the narrowest relevant verification first.
- For backend changes, prefer targeted `unittest` execution or the full backend suite if impact is broad.
- For frontend changes, run at least `npm run lint`; also run `npm run build` when routing, imports, or bundling may be affected.
- For mobile changes, run `npm run lint`.
- Summarize any verification not run and why.

## Repository-Specific Notes
- The root `README.md` still describes an older simplified structure. Prefer this file and the live code tree when making decisions.
- `start-all.sh` assumes a backend virtualenv at `backend/venv/`.
- Frontend routing includes public marketing pages plus protected `/dashboard/*` routes.
- The frontend already uses a custom `ErrorBoundary` and `OfflineIndicator`.
- The shared API client supports retrying network failures, offline queueing for mutation requests, and token refresh flow.
- Backend mood-tracker artwork is file-based under `backend/assets/mood-tracker/`, not stored solely in the database.

## Skills
- No repository-local Codex skill file is present in this workspace.
- If a task is specifically about OpenAI/OpenRouter integration behavior, documentation, or model-selection guidance, use the available `openai-docs` skill from the Codex environment when appropriate.
- Do not invent repo-specific skills in code or docs unless the user explicitly asks for a reusable Codex skill to be created.
