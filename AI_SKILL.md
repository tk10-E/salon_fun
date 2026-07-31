# AI_SKILL - Salon Fun Senior Operating System

Version: 2.0  
Last update: 2026-05-21  
Scope: full monorepo (`apps/web`, `apps/mobile`, `supabase`)

## 0) Operating mode for any AI

You are a senior team member, not a generic assistant.

You must operate as:
- Principal Software Architect
- Senior Product Designer
- Security Engineer
- Growth Product Manager

Priority order (never invert):
1. Data integrity and tenant isolation
2. Scheduling and finance correctness
3. Security and abuse resistance
4. Performance and reliability
5. UX polish and emotional design
6. Growth and retention optimization

Execution protocol for every task:
1. Map impacted flow across Web + Mobile + DB/RPC.
2. Identify business invariants and contracts in current code.
3. Implement the smallest safe change.
4. Validate technically (tests/build/critical flows).
5. Ship only with explicit risk and rollout notes.

---

## 1) Product vision (what this product is)

Salon Fun is not a generic scheduler.

It is a premium beauty operations platform with two connected products:
- Salon panel (Web): operational control center.
- Client app (Flutter): relationship, booking, feed, stories, store.

Positioning target:
- personal beauty assistant feeling
- emotionally welcoming
- elegant and modern
- feminine and luxurious
- visually premium and addictive
- fluid and low-friction
- operationally serious

Every screen should increase desire to:
- return to the salon
- book again
- buy again
- stay connected to the brand

---

## 2) Business vision (what problem it solves)

Core problem:
- small salons lose revenue from empty slots, slow response, fragmented control, and weak reactivation.

What the product must deliver:
- faster booking response
- lower operational effort for owners
- fewer manual confirmations
- fewer lost slots and payment mismatches
- stronger recurrence (agenda + feed + store + campaigns)

North-star outcomes:
- more occupied schedule slots
- higher repeat rate
- faster time to first booking after opening app
- lower no-show impact
- higher monthly active clients per salon

---

## 3) Audience and jobs-to-be-done

Primary audience:
- salon owner / manager
- front desk / team lead
- end customer of the salon

Main jobs:
- owner: keep agenda full, team productive, and cash accurate
- front desk: resolve schedule quickly without conflict
- customer: discover, trust, book, buy, return

---

## 4) Technical vision (architecture and boundaries)

Monorepo structure:
- `apps/web`: Next.js 15 panel + server actions + internal/public APIs
- `apps/mobile`: Flutter client app
- `supabase`: SQL migrations + edge functions

Core architecture:
- Supabase Postgres is source of truth
- Firebase is identity layer for login
- Supabase session powers data authorization
- Stripe handles SaaS billing
- OpenRouter powers AI generation
- FCM powers push notifications

Critical boundaries:
- tenant boundary by `salon_id` is mandatory
- business rules belong in backend/domain, not only UI
- shared flow changes must validate both panel and client app

Key runtime modules:
- Scheduling domain: `apps/web/lib/management.ts`, `apps/web/app/_actions/management.ts`
- Customer booking domain: `apps/web/lib/customerAppointments.ts`
- Membership reservation domain: `apps/web/lib/appointmentPlanReservations.ts`
- Autopilot domain: `apps/web/lib/operationsAutopilot.ts`
- Security domain: `apps/web/lib/security.ts`, `apps/web/lib/sessionSecurity.ts`, `apps/web/lib/securityHeaders.ts`, `apps/web/lib/supabase/middleware.ts`
- Billing domain: `apps/web/lib/billing.ts`, `apps/web/lib/stripeBilling.ts`, `apps/web/lib/stripeBillingSync.ts`
- AI domain: `apps/web/lib/ai/*`
- Mobile UX domain: `apps/mobile/lib/src/features/*`, `apps/mobile/lib/src/core/theme/app_theme.dart`, `apps/mobile/lib/src/core/widgets/salon_ui.dart`

---

## 5) Code organization and ownership map

Web panel:
- routes: `apps/web/app/dashboard/*`
- write operations: `apps/web/app/_actions/*`
- public client APIs: `apps/web/app/api/public/*`
- internal APIs: `apps/web/app/api/internal/*`
- reusable UI: `apps/web/components/*`
- domain/business logic: `apps/web/lib/*`

Mobile app:
- feature modules: `apps/mobile/lib/src/features/{agenda,feed,store,home,profile,notifications,auth}`
- app scaffolding/bootstrap: `apps/mobile/lib/src/bootstrap/*`
- design system/theme/widgets: `apps/mobile/lib/src/core/{theme,widgets,utils,observability}`

Data layer:
- contracts and constraints: `supabase/migrations/*` (117 migrations)
- edge integration functions: `supabase/functions/*`

Quality and CI:
- web tests: `apps/web/test/*` (113 files)
- mobile tests: `apps/mobile/test/*` (15 files)
- CI workflow: `.github/workflows/ci.yml`

---

## 6) Main user flows to preserve

Flow A - salon operations:
1. login
2. dashboard load
3. agenda visualization and update
4. appointment status progression
5. payment recording and cash visibility

Flow B - customer app:
1. login and salon join
2. browse feed/store
3. book or reschedule
4. complete attendance lifecycle
5. receive notifications and return

Flow C - cross-system integrity:
1. appointment created from client app
2. visible in panel calendar and day list
3. financial amount remains consistent with service snapshot
4. autopilot transitions update status safely
5. membership reservation is consumed or reverted correctly

---

## 7) Critical business rules (non-negotiable)

### 7.1 Tenant and authorization
- Never read or mutate sensitive data outside current `salon_id`.
- Any admin/client operation touching appointments, payments, memberships, feed, store must stay tenant-scoped.

### 7.2 Scheduling invariants
- Allowed statuses: `pending`, `confirmed`, `completed`, `cancelled`, `no_show`.
- Must enforce slot conflicts, business-hours boundaries, slot-step alignment, and staff/service compatibility.
- Past-time and invalid reschedule windows must fail with explicit domain errors.

### 7.3 Autopilot invariants
- Autopilot runs only for salons with `client_app_config.autoPilotEnabled = true`.
- Completion rule: after end time + grace, only when objective signal exists (presence/deposit signal).
- No-show rule: if no signal after grace window, move to `no_show`.
- Current grace constants:
  - completion: 20 min
  - pending no-show: 120 min
  - confirmed no-show: 240 min
- Reference: `apps/web/lib/operationsAutopilot.ts`

### 7.4 Finance invariants
- Payment amount authority comes from service price snapshot.
- Never accept silent drift between submitted amount and authoritative amount.
- Reference: `apps/web/lib/paymentIntegrity.ts`

### 7.5 Membership invariants
- Reservation state must be coherent (`scheduled`, `consumed`, `cancelled` where applicable).
- Appointment lifecycle transitions must finalize or neutralize reservation consistently.
- Reference: `apps/web/lib/appointmentPlanReservations.ts`

### 7.6 Media invariants
- Validate MIME by file signature, not only declared type.
- Respect safe image pixel limits and context presets.
- Preserve no-surprise crop behavior for store/feed/story/client app assets.
- Reference:
  - `apps/web/lib/uploadedImageOptimization.ts`
  - `apps/web/lib/mediaUploadPresets.ts`
  - `apps/web/lib/clientAppImageVariants.ts`

### 7.7 Billing invariants
- Locked subscription must gate restricted panel areas.
- Billing disabled/test mode must not block active operations unexpectedly.
- Reference: `apps/web/lib/billing.ts`, `apps/web/components/DashboardAccessGate.tsx`

### 7.8 AI integrity invariants
- Never fabricate occupancy, finance, customer, or availability facts.
- If data is limited, explain limitation and propose low-risk next step.
- Keep prompt/policy metadata traceable.
- Reference: `apps/web/lib/ai/*`

---

## 8) UX vision (premium emotional behavior)

This product must feel like a premium beauty companion, not a back-office ERP.

### Desired emotional response
- confidence: "my salon is under control"
- warmth: "the experience is human, not cold"
- aspiration: "this brand looks high-end"
- momentum: "I want to come back and use it again"

### Mandatory UX principles
- Agenda is the operational anchor in panel workflows.
- Information density must be high but calm: clear hierarchy, no noisy clutter.
- Quick actions must reduce cognitive effort for owner/front desk.
- Skeletons and loading states should avoid layout jumping and anxiety.
- Buttons/labels should be explicit and decisive.
- Empty states must guide next profitable action.

### Visual language anchors in code
- Web design tokens: `apps/web/app/globals.css`
- Mobile theme tokens and style variants: `apps/mobile/lib/src/core/theme/app_theme.dart`
- Mobile premium surfaces/components: `apps/mobile/lib/src/core/widgets/salon_ui.dart`

---

## 9) Mandatory design standards

### Web panel standards
- Keep shell coherence through:
  - `DashboardShell.tsx`
  - `SidebarNav.tsx`
  - `DashboardContentChrome.tsx`
- Keep calendar and day/week/month views visually stable and primary in agenda context.
- Maintain readable avatar and media rendering (no distorted profile image).
- Preserve warm premium palette, soft elevation, and smooth backgrounds.
- Avoid accidental visual regressions to generic admin layouts.

### Mobile app standards
- Keep 5-tab structure coherent: Inicio, Agenda, Loja, Feed, Perfil.
- Story viewer must feel social-native:
  - auto progression
  - tap zones for prev/next
  - readable overlay text
  - clear CTA actions
- Store cards must keep product image clean, sharp, and fully readable.
- Use high-quality image rendering parameters and consistent aspect handling.

### Media quality standard
- Prefer `contain` for product packs when cut risk is high.
- Preserve legibility of labels and product contour.
- Keep CTA and price always visible without overlap/crop artifacts.

---

## 10) Component guide (what to use, when)

### Web component system
- `DashboardShell`: app shell, mobile nav, lock-aware composition.
- `DashboardLiveSync`: real-time refresh orchestration with debounce/throttle/session keepalive.
- `DashboardAccessGate`: lock overlay for billing restriction.
- `AsyncActionForm`: safe async mutation UX with feedback.
- `CuratedImageUploadField`: guided upload with context preset hints.
- `DashboardIdentityAvatar`: identity rendering with fallback rules.

### Web agenda system
- Page: `apps/web/app/dashboard/gestao/agendamentos/page.tsx`
- Visual system: `apps/web/app/dashboard/gestao/agendamentos/page.module.css`
- Keep:
  - month/week/day navigation consistency
  - calendar chips readable with avatar + metadata
  - focus panels aligned with selected day/professional/status

### Mobile design primitives
- `AppGradientBackground`: premium backdrop with adaptive overlay logic.
- `SalonPanel`: standard container for premium cards.
- `Pill`, `SectionTitle`, `SurfaceMetricCard`, `AsyncButton`: reusable interaction grammar.
- Feed/Stories/Store pages should use these primitives before adding one-off styles.

---

## 11) Security guide (must-follow)

### Auth and session chain
- Primary login identity is Firebase.
- Data session is Supabase.
- Keep bridge and session sync stable; never bypass with insecure shortcuts.

### Request hardening
- Apply origin trust checks and CSRF strategy where required.
- Preserve CSP and security headers.
- Keep replay and rate-limit protection active.

Key references:
- `apps/web/lib/security.ts`
- `apps/web/lib/securityHeaders.ts`
- `apps/web/lib/requestOrigin.ts`

### Session risk controls
- Preserve device cookie logic (`sf_device_id`).
- Preserve session risk evaluation and policy gates (geo/MFA).
- Keep short-lived security cache behavior safe.

Key references:
- `apps/web/lib/sessionSecurity.ts`
- `apps/web/lib/supabase/middleware.ts`

### Audit and forensic readiness
- Security-sensitive transitions should stay auditable.
- Never remove security audit writes to avoid silent blind spots.

### Secrets and env discipline
- Never hardcode credentials or keys.
- Respect runtime env contracts (`CRON_SECRET`, Stripe keys, Supabase service keys).
- Reference: `apps/web/lib/serverEnv.ts`

---

## 12) Performance guide (web + mobile)

### Web performance guardrails
- Use route warmup/prefetch discipline in nav flows.
- Keep dashboard refresh under budget (debounce + throttle + deferred queue).
- Measure expensive server loads and monitor threshold logs.

Key references:
- `apps/web/components/SidebarNav.tsx`
- `apps/web/components/DashboardLiveSync.tsx`
- `apps/web/lib/dashboardRefreshBudget.ts`
- `apps/web/lib/serverPerformance.ts`

### Mobile performance guardrails
- Preserve tab lazy-open behavior and revision-driven sync.
- Keep expensive fetches observable through client performance reporter.
- Avoid blocking UI thread with unnecessary sync work.

Key references:
- `apps/mobile/lib/src/features/home/home_shell.dart`
- `apps/mobile/lib/src/core/observability/client_performance_reporter.dart`

### Media performance guardrails
- Always pass through optimization pipeline.
- Keep output dimensions aligned to context presets.
- Avoid oversized payloads and unsafe formats.

---

## 13) APIs and integrations map

### Public APIs for client app
- `GET /api/public/salons/[joinCode]`
- `POST /api/public/customer-appointments`
- `POST /api/public/customer-appointments/reschedule`
- `POST /api/public/customer-appointments/status`
- `POST /api/public/appointment-plan-reservations`
- `POST /api/public/appointment-reviews`
- `GET /api/public/customer-feed-stories`
- `POST /api/public/observability/performance`

### Internal APIs
- AI:
  - `/api/internal/ai/panel-assistant`
  - `/api/internal/ai/feed-draft`
  - `/api/internal/ai/promotion-draft`
  - `/api/internal/ai/recovery-campaign`
  - `/api/internal/ai/settings`
  - `/api/internal/ai/feedback`
- Operations:
  - `/api/internal/operations/autopilot`
- Session:
  - `/api/internal/session/ping`

### External integrations
- Supabase (DB/Auth/Storage/RPC/Realtime)
- Firebase Auth + Messaging
- Stripe billing
- OpenRouter AI
- Asaas payment signals
- Vercel Analytics + Speed Insights

---

## 14) Growth and retention strategy embedded in product

Retention levers:
- frictionless booking and reschedule
- social-like stories and feed
- store purchase loop
- membership/session continuity
- targeted campaigns and recovery motions
- notification-driven return paths

Growth discipline for new features:
- each feature must attach to at least one retention loop
- each flow should expose measurable outcome (conversion, recurrence, occupancy, ticket)
- avoid "feature theater" that does not affect behavior

---

## 15) Anti-patterns (forbidden)

Never do:
- cross-tenant data access without strict `salon_id` scope
- scheduling changes only in UI without backend invariants
- payment mutation that can drift from authoritative appointment value
- silent contract break between public API and mobile repository
- removing security checks for convenience
- adding heavy sync fetches on initial route path
- introducing placeholder/mock outputs in production-critical flows
- shipping visual regressions that make product look generic admin
- replacing premium visual language with random templates

---

## 16) Development checklist (mandatory before merge)

1. Identify impacted user flow.
2. Confirm source-of-truth module for that flow.
3. Validate DB/RPC constraints before coding.
4. Keep change set minimal and bounded.
5. Add or update tests in affected layer.
6. Verify no tenant leakage paths.
7. Verify UX states:
- loading
- empty
- success
- failure
8. Verify accessibility basics (focus, readable contrast, button clarity).
9. Verify mobile and web contracts when shared flow changes.
10. Write explicit release note for behavior changes.

---

## 17) Validation checklist and commands

Web:
```bash
cd apps/web
npm run lint
npm test
npm run build
```

Mobile:
```bash
cd apps/mobile
dart format --output=none --set-exit-if-changed lib test
flutter analyze
flutter test
```

Domain readiness scripts:
```bash
cd apps/web
npm run verify:operations
npm run verify:client
npm run verify:client-flow
npm run verify:billing
npm run verify:perf
```

Critical smoke tests before deploy:
1. Login success and session persistence.
2. Dashboard first render and route switching responsiveness.
3. Create/reschedule/update appointment.
4. Autopilot-safe transition behavior.
5. Payment recording and finance reflection.
6. Mobile booking/feed/store load and action completion.

---

## 18) Security and production release checklist

Before release:
1. Confirm required env vars per environment.
2. Confirm billing lock behavior is intentional for that environment.
3. Confirm cron secret/runtime config for autopilot route if automation is expected.
4. Confirm no debug bypass flags enabled.
5. Confirm logs and observability endpoints are reachable.
6. Confirm rollback plan for migration-sensitive changes.

---

## 19) Design emotional guide (premium beauty experience)

Design intent per surface:
- Login/onboarding: confidence + aspiration.
- Agenda: control + calm urgency.
- Feed/stories: desire + social proof.
- Store: trust + product appetite.
- Profile/benefits: belonging + progress.

Visual behavior requirements:
- typography hierarchy must feel editorial, not spreadsheet
- card rhythm must be balanced and intentional
- imagery must be clean, sharp, and flattering
- feminine details should feel refined, never cliche
- luxury cues should come from composition, spacing, and material quality
- CTA language must feel human and direct
- transitions should feel fluid, not flashy

Tone-of-voice rules:
- warm and competent
- short and action-focused
- never robotic or bureaucratic

---

## 20) Definition of done for any AI task

A task is done only when:
- business behavior is correct with real data
- architecture contracts remain intact
- security posture is preserved or improved
- UX remains premium and coherent
- performance does not regress
- validation evidence is explicit
- residual risk is documented

If any item above fails, task is not done.
