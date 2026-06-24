# BrainSRS - Project Context

Last updated: 2026-06-23

This file is a compact project map for future prompts and agent sessions. It
does not replace reading the touched files before changing code, but it should
avoid re-discovering the whole repository every time.

## Product Summary

BrainSRS is a Portuguese study app based on spaced repetition. Users create or
import notebooks, subjects and multiple-choice questions, then study and review
questions on a schedule. The app has evolved toward a SaaS product with auth,
plans, admin controls, public marketing/legal pages, a content catalog, social
rankings and challenges.

Main product areas:

- Personal study library: notebooks, subjects, questions and alternatives.
- Spaced repetition: progress, cooldowns, active review sessions and review
  logs.
- Catalog: official installable content packs copied into a user's personal
  library with origin/version tracking.
- SaaS account features: login, registration, email verification, password
  reset, session management, account security, support and plan screens.
- Admin area: `/admin` dashboard for users, plans, audit, security events,
  reports and catalog administration.
- Social/gamification: XP, weekly XP, streak, rankings, friendships, challenge
  tickets and user-vs-user challenges.
- PWA/offline support: manifest, service worker, offline page and queued
  frontend mutations.

Mobile/Capacitor is not active. The old tracked `mobile/` app was manually
removed on purpose. Do not restore it unless explicitly requested. The current
product is the responsive web/PWA app under `frontend/`.

## Repository Layout

```text
backend/       Express API, Prisma schema/migrations, catalog/admin/auth logic
frontend/      Next.js app, Tailwind CSS, PWA assets, main BrainSRS UI
src/           Legacy/shared app component copy; current app uses frontend/src
.github/       GitHub Actions CI
docs/          Project context and future cross-project documentation
database-dumps/ Historical database dump material
```

Important root docs:

- `README.md`: local setup and high-level architecture.
- `ROADMAP_SAAS.md`: SaaS roadmap; payments/deploy/hardening are still open.
- `ROADMAP_ADMIN.md`: admin MVP status and post-MVP security backlog.
- `ROADMAP_CATALOGO_CONTEUDO.md`: catalog implementation history and open
  operational/editorial work.
- `CATALOGO_REGRAS_PRODUTO.md`: product rules for official catalog packs.
- `RELATORIO_MIGRACAO_POSTGRESQL.md`: PostgreSQL migration summary.

## Stack

Backend:

- Node.js 22+
- TypeScript
- Express 5
- Prisma 6
- PostgreSQL
- Zod
- Helmet, CORS, cookie-parser
- Pino logging
- Nodemailer
- Vitest

Frontend:

- Next.js 16 App Router
- React 19
- TypeScript
- Tailwind CSS 4
- lucide-react icons
- PWA/service worker
- Playwright-core based validation scripts

## Local Development

Backend:

```bash
cd backend
npm install
copy .env.example .env
npm run prisma:deploy
npm run dev
```

Frontend:

```bash
cd frontend
npm install
copy .env.example .env.local
npm run dev
```

Default URLs:

```text
Frontend: http://localhost:3000
Backend:  http://localhost:3001
Health:   http://localhost:3001/health
Swagger:  http://localhost:3001/docs
```

Frontend requests are routed through `/backend-api/*`, configured in
`frontend/next.config.mjs` with `BRAINSRS_API_ORIGIN` defaulting to
`http://localhost:3001`.

Do not copy secrets from `backend/.env` into documentation or prompts.

## Validation Commands

Backend:

```bash
cd backend
npm run lint
npm test
npm run build
npm run check
```

Frontend:

```bash
cd frontend
npm run lint
npm run build
npm run check
```

Frontend integration/UI validation scripts:

```bash
cd frontend
npm run test:backend
npm run test:ui
npm run test:library
npm run test:review-filter
npm run test:theme
```

Some UI scripts expect frontend/backend servers and usable seeded/test accounts.

CI (`.github/workflows/ci.yml`) runs on push/PR to `main` with Node 22:

- backend: `npm ci`, audit, lint, test, build
- frontend: `npm ci`, audit, lint, build

## Backend Architecture

Main entrypoint: `backend/src/server.ts`.

Startup:

- Loads validated config from `backend/src/config.ts`.
- Initializes Prisma/database through `backend/src/db.ts`.
- In non-production, runs legacy state migration, abuse cleanup and optional
  seed user creation.
- Registers global JSON parsing, request context, logging, Helmet, cookies,
  CORS and CSRF.

Public backend routes:

- `GET /`
- `GET /health`
- `GET /openapi.json`
- `GET /docs`
- `GET /api/auth/csrf`

Mounted routers:

- `/api/auth` -> `backend/src/routes/auth.routes.ts`
- `/api` -> state routes in `backend/src/routes/state.routes.ts`
- `/api/catalog` -> `backend/src/routes/catalog.routes.ts`
- `/api/challenges` -> `backend/src/routes/challenge.routes.ts`
- `/api` -> social routes in `backend/src/routes/social.routes.ts`
- `/api/admin` -> `backend/src/routes/admin.routes.ts`

CSRF:

- `GET /api/auth/csrf` issues a CSRF token before CSRF middleware.
- Mutable `/api/*` requests authenticated by cookie require `X-CSRF-Token`.
- Browser auth uses HttpOnly cookies. External/API clients can use bearer token
  flows.

Error handling:

- `PublicError` controls expected HTTP errors.
- Unexpected errors are logged and captured in `ErrorEvent`.
- Clients receive generic internal error messages.

## Core Backend Modules

- `auth.ts`: users, password hashing with per-user salt, sessions, token login,
  password reset, verification and profile updates.
- `state-service.ts`: main command handler for app actions such as import,
  add/update/delete content, start/answer/complete/abandon review and settings.
  Supports opt-in partial response payload generation (state patching) to optimize bandwith.
- `state-repository.ts`: reads/writes relational app state and migrates legacy
  `UserState.stateJson`. Utilizes targeted relational database writes for single resources (notebooks, subjects, questions) to avoid full-state rewrites.
- `catalog.ts`: seeds/syncs official catalog content, lists/installs/removes
  packs, handles version updates and previews.
- `catalog-admin.ts`: administrative catalog import/status/rollback flows.
- `admin.ts`: admin metrics, user operations, support notes and auditing (with pagination support for logs and events).
- `plans.ts`: Free/Pro feature and capacity enforcement.
- `abuse-protection.ts`: persistent PostgreSQL-backed rate limits and security
  events.
- `audit.ts`: audit logging and error capture.
- `gamification.ts`: XP, streak, friendships/rankings related helpers.
- `challenges.ts`: challenge tickets, random/friend challenge lifecycle and
  scoring.
- `openapi.ts` and `swagger.ts`: API documentation.

Shared backend/frontend contracts are mirrored under:

- `backend/src/shared/types.ts`
- `backend/src/shared/actions.ts`
- `backend/src/shared/validation.ts`
- `backend/src/shared/seed.ts`
- `frontend/src/lib/types.ts`
- `frontend/src/lib/actions.ts`
- `frontend/src/lib/validation.ts`
- `frontend/src/lib/seed.ts`

Keep these aligned when changing the app state model or action payloads.

## Main API Surface

Auth/account:

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `POST /api/auth/profile`
- `POST /api/auth/onboarding`
- `GET /api/auth/sessions`
- `POST /api/auth/logout-all`
- `POST /api/auth/change-password`
- `POST /api/auth/verification/request`
- `POST /api/auth/verification/confirm`
- `POST /api/auth/password-reset/request`
- `POST /api/auth/password-reset/confirm`
- `POST /api/auth/token/login`
- `POST /api/auth/token/refresh`
- `POST /api/auth/token/revoke`

State/plans:

- `GET /api/state`
- `POST /api/actions`
- `GET /api/plan`
- `GET /api/pro/stats`
- `GET /api/pro/vulnerabilities`

Catalog:

- `GET /api/catalog`
- `GET /api/catalog/goals`
- `GET /api/catalog/packs`
- `GET /api/catalog/packs/:packId`
- `GET /api/catalog/installations`
- `POST /api/catalog/capacity`
- `POST /api/catalog/packs/:packId/install`
- `POST /api/catalog/install`
- `DELETE /api/catalog/installations/:installationId`
- `POST /api/catalog/installations/:installationId/update`
- `GET /api/catalog/completions`
- `POST /api/catalog/complete`

Social/challenges:

- `GET /api/rankings/global`
- `GET /api/rankings/friends`
- `GET /api/friends`
- `POST /api/friends/request`
- `POST /api/friends/accept`
- `POST /api/friends/remove`
- `POST /api/game/challenge`
- `POST /api/challenges/tickets/collect`
- `GET /api/challenges/subjects`
- `GET /api/challenges`
- `GET /api/challenges/:challengeId`
- `POST /api/challenges/random`
- `POST /api/challenges/invite`
- `POST /api/challenges/:challengeId/accept`
- `POST /api/challenges/:challengeId/decline`
- `POST /api/challenges/:challengeId/cancel`
- `POST /api/challenges/:challengeId/submit`

Admin:

- `GET /api/admin/me`
- `GET /api/admin/overview`
- `GET /api/admin/users`
- `GET /api/admin/users/:userId`
- `POST /api/admin/users/:userId/plan`
- `POST /api/admin/users/:userId/cancel-plan`
- `POST /api/admin/users/:userId/admin-role`
- `POST /api/admin/users/:userId/logout-all`
- `POST /api/admin/users/:userId/verify-email`
- `POST /api/admin/users/:userId/delete`
- `POST /api/admin/users/:userId/password`
- `POST /api/admin/users/:userId/block`
- `POST /api/admin/users/:userId/manual-review`
- `POST /api/admin/users/:userId/support-notes`
- `GET /api/admin/security-events` (paginated with `page` and `pageSize`)
- `GET /api/admin/audit-logs` (paginated with `page` and `pageSize`)
- `GET /api/admin/reports`
- `GET /api/admin/catalog`
- `POST /api/admin/catalog/import`
- `POST /api/admin/catalog/packs/:packId/status`
- `GET /api/admin/catalog/packs/:packId/versions`
- `POST /api/admin/catalog/packs/:packId/rollback`

## Data Model

Schema file: `backend/prisma/schema.prisma`.

Primary groups:

- Users/auth: `User`, `Session`, `AccessToken`, `RefreshToken`,
  `EmailVerificationToken`, `PasswordResetToken`.
- Personal study state: `Notebook`, `Subject`, `Question`, `Alternative`,
  `Progress`, `ReviewLog`, `Cooldown`, `ReviewSession`,
  `ReviewSessionItem`, `CompletedDate`, `UserSettings`.
- Legacy state: `UserState` remains for migration/rollback only.
- Catalog: `CatalogPack`, `CatalogSubject`, `CatalogQuestion`,
  `CatalogAlternative`, `UserCatalogInstallation`, `CatalogPackVersion`.
- Security/audit: `RateLimitBucket`, `SecurityEvent`, `PlanAudit`,
  `AuditLog`, `ErrorEvent`, `AdminAuditLog`, `SupportNote`.
- Social/challenges: `Friendship`, `ChallengeLog`, `Challenge`,
  `ChallengeParticipant`, `ChallengeQuestion`, `ChallengeAlternative`,
  `ChallengeAnswer`, `UserSubjectCompletion`.

Important design decisions:

- PostgreSQL is the active database.
- Personal content belongs to a user and has `userId` indexes.
- Official catalog installation copies content into personal tables with new
  IDs, then records source catalog IDs/version.
- Catalog updates are additive and should not silently overwrite answered or
  user-edited content.
- `CatalogPack` is the installable official notebook. There is no separate
  `CatalogNotebook` table.

## Spaced Repetition Flow

Action type definitions live in `backend/src/shared/actions.ts`.

Main action types:

- `import`, `importQuestions`
- `addNotebook`, `addSubject`, `addQuestion`
- `updateNotebook`, `updateSubject`, `updateQuestion`
- `deleteNotebook`, `deleteSubject`, `deleteQuestion`
- `saveSettings`
- `startReview`
- `answer`
- `completeReview`
- `abandonReview`

`state-service.ts` handles action validation, applies plan limits, updates
state, writes relational data and records audit events. `answer` updates
progress with difficulty/stability/cooldown and appends review logs.

Review sessions are single-active-session per user. Answer requests use
`requestId` to avoid duplicate answer processing.

## Plans and Limits

Plans are `free` and `pro`.

Default limits in config:

- Free: 5 notebooks, 15 subjects, 500 questions, 5 imports/day,
  100 questions/import, 3 official catalog packs.
- Pro: 100 notebooks, 1000 subjects, 50000 questions, 30 imports/day,
  5000 questions/import.

Backend must enforce limits. Frontend hiding is not authorization.

Current SaaS gap: real payment provider, checkout, subscription tables and
webhook-based plan updates are still pending.

## Catalog Rules

Rules from `CATALOGO_REGRAS_PRODUTO.md`:

- Pilot goals: Tecnologia, Concursos publicos, Humanidades.
- Each pack has one notebook, subjects and questions.
- Each question must have exactly one correct alternative.
- Official installs do not consume daily import limit, but count toward total
  capacity.
- Free allows up to 3 active official packs.
- `requiredPlan=pro` packs require Pro.
- Downgrade does not automatically remove installed content.
- Removal requires confirmation and only affects copies linked to that pack.
- Updates are accepted by the user and add questions without deleting progress.
- Published versions have changelog/change type/snapshot for rollback.
- `CATALOG_ENABLED` controls feature rollout.

## Frontend Architecture

Main app routes:

- `frontend/src/app/layout.tsx`: root metadata, Manrope font and PWA register.
- `frontend/src/app/(brainsrs)/layout.tsx`: renders the main BrainSRS app shell.
- `frontend/src/app/(brainsrs)/page.tsx`: root app page, returns null because
  the shell controls actual view by route.
- `frontend/src/app/(brainsrs)/[page]/page.tsx`: static route placeholders for
  `estudar`, `dashboard`, `revisar`, `biblioteca`, `editar-caderno`,
  `estatisticas`, `vulnerabilidades`, `simulado`, `configuracoes`,
  `rankings`, `desafios`.
- `frontend/src/app/admin/page.tsx`: admin app.
- `frontend/src/app/(public)/*`: marketing/legal/support pages.

Main UI files:

- `frontend/src/components/brain-srs-app.tsx`: large client component containing
  the primary student experience, navigation, state handling, review/study
  flows, catalog UI, simulations, settings, rankings and challenges.
- `frontend/src/components/admin/admin-app.tsx`: admin dashboard and panels.
- `frontend/src/components/marketing/marketing-pages.tsx`: public pages.
- `frontend/src/components/pwa-register.tsx`: service worker registration.

Client API:

- `frontend/src/lib/client-api.ts` wraps fetch calls.
- It uses `/backend-api` rewrites.
- It stores the CSRF token in module memory, refreshes on 403 and includes
  cookies.
- It maintains `lastState`/`lastUser` and queues some offline requests.
- Requests mutations with the `X-BrainSRS-State-Mode: patch` header when local state cache exists, then merges partial state updates into client memory.
- Cleans up state cache and clears offline IndexedDB queue upon user logout.

Offline/PWA:

- `frontend/public/manifest.webmanifest`
- `frontend/public/sw.js`
- `frontend/public/offline.html`
- `frontend/src/lib/offline-db.ts`
- `frontend/src/lib/pwa-utils.ts`

## Styling and UX Notes

The current visual language is a bright, rounded, Duolingo-like learning UI:

- Green primary color around `#58cc02`.
- Rounded cards/buttons, bold type and lucide icons.
- Portuguese copy throughout the user-facing product.
- Main app is responsive and intended as web/PWA, not native mobile.
- There should be no active native mobile or Capacitor workspace in this repo.

When changing frontend, verify text fit on mobile and desktop. Some validation
scripts capture screenshots under `frontend/screenshots/`.

## Environment Variables

Backend config is validated in `backend/src/config.ts`.

Common backend variables:

- `DATABASE_URL`
- `NODE_ENV`
- `BACKEND_PORT`
- `FRONTEND_ORIGIN`
- `FRONTEND_PRIMARY_ORIGIN`
- `FRONTEND_VERCEL_PREVIEW_SUFFIX`
- `SESSION_COOKIE_SECURE`
- `SEED_TEST_USER`
- `SEED_USER_PASSWORD`
- `AUTH_PAYLOAD_LIMIT`
- `ACTIONS_PAYLOAD_LIMIT`
- `SESSION_DURATION_DAYS`
- `APP_PUBLIC_URL`
- `SMTP_*`
- login/register/import/plan limit variables
- `ACCESS_TOKEN_MINUTES`
- `REFRESH_TOKEN_DAYS`
- `CATALOG_ENABLED`
- `CATALOG_FREE_PACK_LIMIT`
- `LOG_LEVEL`

Frontend-related:

- `BRAINSRS_API_ORIGIN` controls Next rewrite target.
- Historical docs mention `NEXT_PUBLIC_API_BASE_URL`, but current
  `client-api.ts` uses `/backend-api` and Next rewrites.

Production constraints:

- `FRONTEND_ORIGIN` must be explicit.
- `SEED_TEST_USER` cannot be true.
- SMTP config is required.
- `SESSION_COOKIE_SECURE` should be true with HTTPS.

## Known Backlog and Risks

High-value open areas:

- Payments/subscriptions: provider, checkout, portal, `Subscription`,
  `PaymentEvent`, signed webhooks and plan updates via webhook.
- Deploy hardening: staging/production separation, domains, HTTPS, backups,
  rollback, secrets management.
- Security hardening: MFA for admins, reauth for critical admin actions,
  automated RBAC/CSRF/authorization tests, log review for sensitive data.
- Catalog operations: expand and review content continuously; measure onboarding
  and first-review funnels; strengthen UI regression tests around shared
  accounts/rate limits.
- Legal/support: public legal text needs legal review; support is still basic
  and can evolve into stored tickets.

## Recent Optimizations (2026-06-23)

The following optimizations and hardening items were implemented as part of the API Security & Performance checklist:

- **Admin Pagination**: Added database-level offset pagination to administrative endpoints `/api/admin/security-events` and `/api/admin/audit-logs`, and integrated Previous/Next pagination controls in `AuditPanel` and `SecurityPanel` components.
- **Query & Selection Optimization**: Swapped broad queries for precise `select` fields in session/token lookups (`auth.ts`) to avoid fetching unused `passwordHash` and `passwordSalt` fields. Optimized `catalogCapacity` query to fetch only subject and question IDs instead of full text fields.
- **Database Indexes**: Added composite index on `User` for `[weeklyXp, xp]` and `[xp]` to optimize leaderboards and rankings.
- **Baseline Metrics**: Collected baseline metrics for catalog, challenges, and admin endpoints in `docs/API_BASELINE_2026-06-22.md`.
- **HTTP Compression & Caching**: Validated the gzip middleware and confirmed caching compatibility using `Vary: Origin, Accept-Encoding` headers.
- **Offline Cryptography & Locks**: Secured the offline IndexedDB queue using AES-GCM 256-bit encryption and added sync locks to prevent duplicate submissions.
- **Email Verification & Password Reset**: Fully integrated front-end screens `/recuperar-senha`, `/redefinir-senha` and `/verificar-email` with pre-existing backend endpoints, added a visual validation banner to the main dashboard layout, upgraded the backend mailer to support responsive HTML emails using SMTP (fully compatible with Gmail App Passwords), and added a connection test script (`backend/scripts/send-test-email.ts`).

## Working Guidelines for Future Agents

- Before editing, read the exact files being changed; this context is a map,
  not source of truth.
- Preserve user data boundaries. Backend authorization and `userId` filters are
  critical.
- Keep shared types/actions/validation aligned between backend and frontend.
- Do not rely on frontend visibility for permission checks.
- Do not leak `.env` secrets into docs, logs, tests or prompts.
- Avoid destructive changes to migrations or production-like data.
- For catalog changes, preserve the copy-on-install model and version tracking.
- For review/session changes, preserve idempotency of `answer` via `requestId`
  and single active review session semantics.
- For admin changes, keep RBAC, audit reason and sensitive-data minimization.
- For UI changes, maintain Portuguese copy, responsive behavior and the current
  learning-app visual style unless explicitly asked to redesign.
- Update this file when architecture, routes, scripts, env vars or major product
  flows change.
