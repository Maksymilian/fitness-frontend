# fitness-frontend

The browser app of the fitness platform, in React. It uses the three services of [fitness-backend](../fitness-backend), a project of its own next to this one. One app, two parts, as in the context map (fitness-backend's `docs/architecture.md`):

| Part | Pages | Service and API |
|---|---|---|
| **Member app** | Training: progress summary by week, month or year, streak, personal records, training log | Training Progress, GraphQL |
| | Training goals: set, follow and abandon them | Training Progress, GraphQL |
| | Membership: membership plans, checkout, billing portal, ledger | Billing, REST |
| **Back office** | Equipment: register, look up, pair, unpair, record a workout | Workout Tracking, REST (internal) |
| | Workouts: a member's workouts, correction and void | Workout Tracking, REST (internal) |

Until Identity exists, the member is chosen in the header by email address (not verified), as the services take it. Each section says which service its data comes from.

## Running it

Vite 8, React 19, React Router 8, TanStack Query 5, TypeScript 7, Vitest 5. Node.js 22.22 or later.

```bash
# The services first, in ../fitness-backend: infrastructure, then the three services
cd ../fitness-backend
docker compose up -d --wait
pnpm start:dev:workout-tracking    # and training-progress, billing, each in its own terminal

# Then the app, here
pnpm install
pnpm dev                           # http://localhost:5173
```

The footer shows whether each service is ready (its `/health/ready`), and this tab's flow id.

## How it reaches the services

The browser calls `/api/<service>/...` on the app's own origin, and the dev server (`pnpm dev`) or preview server (`pnpm preview`) forwards it to the service (`vite.config.ts`):

| Path | Service | Default target |
|---|---|---|
| `/api/workout-tracking/...` | Workout Tracking | `http://localhost:3001` |
| `/api/training-progress/...` | Training Progress | `http://localhost:3002` |
| `/api/billing/...` | Billing | `http://localhost:3003` |

- **No CORS needed.** Workout Tracking has no CORS on purpose: equipment and services call it, not browsers. Through the proxy, the browser never calls it directly. Its back office belongs on an internal network, behind authentication, in production.
- **Other targets:** `WORKOUT_TRACKING_URL`, `TRAINING_PROGRESS_URL`, `BILLING_URL` in `.env` (see `.env.example`).
- **Calling a service directly instead:** set `VITE_TRAINING_PROGRESS_URL` or `VITE_BILLING_URL`, and add the app's origin to that service's `CORS_ORIGINS`.
- **In production,** `pnpm build` writes static files to `dist/`. A reverse proxy, an ALB or CloudFront behaviours route `/api/<service>/*` to each service, with the prefix stripped.

**Port 5173 is fixed** (`strictPort`): Billing's `MEMBERSHIP_PAGE_URL` (`http://localhost:5173/membership`) is where Stripe's checkout and billing portal send the member back, with `?checkout=completed` or `?checkout=abandoned`. After a completed checkout, the page polls the membership until Billing has it: the membership starts when Stripe's `invoice.paid` reaches Billing, not when the member comes back.

## Flows: one session, one id in Grafana

Every request of a tab carries the tab's flow id as W3C Baggage, `baggage: session.id=<flow id>`. The services put it on every span and log record (fitness-backend's `docs/architecture.md`, 15.2), including those of the RabbitMQ messages a request causes, so one session in the app, across the three services, is one search in Grafana. Tempo: `{ span.session.id = "<flow id>" }`. Loki: `session_id`. The id is in the footer; a new tab is a new flow.

## Eventual consistency, on screen

Workout Tracking and Training Progress are separate services joined by events. A workout recorded, corrected or voided in the back office reaches the training log a moment later, through the outbox and RabbitMQ. The back office says so, and the training log has a Refresh button. Two more behaviours of the services show on screen:

- **Duplicate recording:** *Send the same recording again* on the recording form submits the same recording id. Workout Tracking answers 200 with the existing workout, not 201: no second workout, no second event.
- **Goal allowance:** without a membership, setting a second active goal fails with `GoalAllowanceReached`, and the page points to Membership. A membership started in Billing extends the allowance in Training Progress when its event arrives.

## Checks

```bash
pnpm lint         # oxlint (--deny-warnings) and the type check
pnpm test         # Vitest and Testing Library, jsdom: the API clients, units and dates, three pages against a mocked fetch
pnpm build        # type check and production build
pnpm test:live    # the app's API calls against the running services, through pnpm dev's proxy
```

GitHub Actions (`.github/workflows/ci.yml`) runs `pnpm lint`, `pnpm test` and `pnpm build` on every push to `main` and every pull request. `pnpm test:live` needs the services, so it runs locally only.

`pnpm test:live` needs the three services and `pnpm dev` running. It writes to the local databases for a new member each run (`web-live-<time>@example.com`), so the test records stay as they are. It records, corrects and voids a workout and waits for Training Progress to follow, then sets goals up to the goal allowance. It catches what mocked tests can't: a GraphQL field or a JSON property the services don't have.

## Code

```
src/
  app/                 shell: routes, layout, member choice, service health, query client
  platform/            HTTP and GraphQL clients (errors, flow), formatting, small UI parts
  training-progress/   Training, Training goals: GraphQL documents and pages
  billing/             Membership: REST client and page
  workout-tracking/    Equipment, Workouts: REST client and pages
```

Folders follow the bounded contexts, and names follow fitness-backend's `docs/ubiquitous-language.md`: a correction, not an update; a void, not a delete; a member, not a user. Each context's `api.ts` holds its own types, as the services share none. A domain error keeps its name (`ApiError.code`): `EquipmentAlreadyPaired` over REST, `extensions.reason` over GraphQL.
# fitness-frontend
