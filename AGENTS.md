# Repository Guidelines

## Project Structure & Module Organization
This repository is a multi-app workspace:
- `backend/`: FastAPI API, SQLAlchemy models (`models/`), and domain routers (`routers/<domain>/{routes,service,repository,schemas}.py`).
- `frontend/`: Vite + React web app (`src/pages`, `src/components`, `src/hooks`).
- `mobile/`: Expo React Native app with route-based screens in `app/`.
- `shared/`: shared JavaScript utilities and API helpers used across apps.
- Root scripts/config: `docker-compose.yml`, `start-all.sh`, `start-all.bat`.

Use feature-oriented placement: UI in `components/`, route-level views in `pages/` or `app/`, and backend business logic in `service.py`.

## Build, Test, and Development Commands
- Backend setup/run:
  - `cd backend && pip install -r requirements.txt`
  - `cd backend && fastapi dev main.py` (local API on `http://localhost:8000`)
- Frontend:
  - `cd frontend && npm install`
  - `cd frontend && npm run dev` (Vite dev server)
  - `cd frontend && npm run build` (production build)
  - `cd frontend && npm run lint` (ESLint)
- Mobile:
  - `cd mobile && npm install`
  - `cd mobile && npm run start` (Expo)
  - `cd mobile && npm run ios` / `npm run android` / `npm run web`
  - `cd mobile && npm run lint`
- Optional container workflow: `docker compose up --build`.

## Coding Style & Naming Conventions
- Python: PEP 8, 4-space indentation, `snake_case` for functions/modules, `PascalCase` for classes.
- React/JS/TS: 2-space indentation, components in `PascalCase` filenames (for example `DashboardLayout.jsx`), hooks prefixed with `use` (for example `useCalendarPage.js`).
- Keep backend router files split by responsibility: `routes.py`, `service.py`, `repository.py`, `schemas.py`.
- Run lint before opening a PR (`frontend` and `mobile`).

## Testing Guidelines
- Backend tests live in `backend/tests/` and currently use `unittest`.
- Test files should be named `test_*.py`; test classes should describe behavior/regression scope.
- Run tests with `cd backend && python -m unittest discover -s tests -p 'test_*.py'`.
- Add regression tests for auth/session/token changes before merging.

## Commit & Pull Request Guidelines
- Follow the existing style in git history: `feat: ...`, `fix: ...`, `test: ...`.
- Keep commits scoped to one concern (API fix, UI update, refactor, etc.).
- PRs should include:
  - concise problem/solution summary,
  - linked issue/task (if available),
  - testing notes (what was run),
  - screenshots or recordings for frontend/mobile UI changes.
