# LifeOps Mobile App — Project Audit

**Audit date:** 2025-06-25  
**Auditor role:** Senior Staff Software Engineer (read-only investigation)  
**Scope:** Full repository review — no code changes made during this audit.

---

## 1. Architecture Overview

LifeOps is a **pnpm monorepo** personal-finance application targeting mobile-first web (Expo) with a separate Express API backend. Data flows:

```
┌─────────────────────┐     HTTPS + Bearer token     ┌──────────────────────┐
│  artifacts/mobile   │ ───────────────────────────► │  artifacts/api-server │
│  Expo Router + RN   │         /api/*               │  Express 5 + Drizzle  │
│  React Query client │ ◄─────────────────────────── │  PostgreSQL (Neon)    │
└─────────────────────┘         JSON responses       └──────────────────────┘
         │                                                      │
         │ AsyncStorage (auth only*)                              │ DATABASE_URL
         ▼                                                      ▼
   lifeops_auth_token                                    Neon PostgreSQL
   lifeops_user (profile cache)
```

**Shared libraries (`lib/`):**

| Package | Purpose |
|---------|---------|
| `@workspace/db` | Drizzle ORM schema + `pg` connection pool |
| `@workspace/api-spec` | OpenAPI 3.1 spec + Orval codegen config |
| `@workspace/api-client-react` | Orval-generated React Query hooks + custom fetch |
| `@workspace/api-zod` | Orval-generated Zod schemas (not wired into API handlers) |

**Additional artifact:** `artifacts/mockup-sandbox` — Vite/React component preview sandbox (not part of production runtime).

**Deployment target:** Replit autoscale (`.replit`), with post-build `pnpm store prune`.

---

## 2. Folder Structure

```
LifeOps-Mob app/
├── package.json                 # Root workspace scripts (typecheck, build)
├── pnpm-workspace.yaml          # Workspace + catalog + esbuild platform overrides
├── tsconfig.json / tsconfig.base.json
├── .replit                      # Replit deployment config
├── attached_assets/             # Product spec / design assets
├── docs/                        # This audit document
├── artifacts/
│   ├── api-server/              # Express REST API
│   │   └── src/
│   │       ├── app.ts           # Express middleware + /api mount
│   │       ├── index.ts         # PORT listener
│   │       ├── middlewares/auth.ts
│   │       └── routes/          # auth, categories, incomes, expenses, loans, goals, dashboard, health
│   ├── mobile/                  # Expo 54 + expo-router app
│   │   ├── app/                 # File-based routes (auth, tabs, profile, categories)
│   │   ├── components/          # Modals, cards, shared UI
│   │   ├── context/AuthContext.tsx
│   │   ├── hooks/useColors.ts
│   │   ├── constants/colors.ts
│   │   └── utils/date.ts
│   └── mockup-sandbox/          # Component preview (Vite)
├── lib/
│   ├── db/src/schema/index.ts   # Drizzle PostgreSQL schema
│   ├── api-spec/openapi.yaml    # API contract (v0.3.0)
│   ├── api-client-react/        # Generated + custom-fetch mutator
│   └── api-zod/                 # Generated Zod (unused in handlers)
└── scripts/
    └── src/migrate.ts           # Manual migration helper
```

---

## 3. Technology Stack

| Layer | Technology |
|-------|------------|
| **Package manager** | pnpm (enforced via `preinstall`; npm/yarn blocked) |
| **Language** | TypeScript ~5.9 |
| **Mobile framework** | Expo ~54, React Native 0.81, React 19.1 |
| **Routing (mobile)** | expo-router ~6 (file-based) |
| **API framework** | Express 5.2 |
| **ORM** | Drizzle ORM 0.45 + `drizzle-kit` |
| **Database driver** | `pg` (node-postgres) — PostgreSQL dialect |
| **State management** | TanStack React Query v5 (server state) + React Context (auth) |
| **Auth hashing** | bcrypt (12 salt rounds) |
| **Auth tokens** | Opaque 64-char hex tokens in DB (**not JWT**) |
| **API contract** | OpenAPI 3.1 + Orval codegen |
| **Logging** | Pino + pino-http |
| **Build (API)** | esbuild via `build.mjs` |
| **Build (mobile)** | Custom `scripts/build.js` (static Expo web export) |
| **Linting** | **None configured** at project level |

---

## 4. Database Schema Summary

**Engine:** PostgreSQL only (`dialect: "postgresql"` in `lib/db/drizzle.config.ts`). Compatible with **Neon** when `DATABASE_URL` points to a Neon connection string. No SQLite, MongoDB, or client-side DB in application code.

### Tables

| Table | Key columns | Relations |
|-------|-------------|-----------|
| `users` | `id`, `full_name`, `mobile` (**UNIQUE**), `password_hash`, timestamps | — |
| `user_tokens` | `id`, `user_id` → users (CASCADE), `token` (**UNIQUE**), `created_at` | One active session per user |
| `categories` | `id`, `user_id`, `name`, `type`, `is_default`, `icon`, `color` | FK → users |
| `incomes` | `id`, `user_id`, `category_id`, `amount`, `date`, `notes`, `recurrence_type`, `occurrences` | FK → users, categories |
| `expenses` | Same shape as incomes | FK → users, categories |
| `loans` | `id`, `user_id`, `name`, `loan_type`, `principal_amount`, `interest_rate`, `tenure_years`, `emi`, `start_date` | FK → users; outstanding computed at read time |
| `goals` | `id`, `user_id`, `name`, `target_amount`, `current_amount`, `target_date` | FK → users |

**Notes:**
- Dates stored as `varchar(10)` in `YYYY-MM-DD` format (not `DD-MM-YYYY` as product spec may require).
- `outstanding_balance` is **not persisted** — computed on every loan read.
- Category `type` column accepts any string at DB level; API only seeds/filters `income` and `expense`.

---

## 5. Authentication Audit

| Requirement | Status | Details |
|-------------|--------|---------|
| Mobile number + password login | ✅ Complete | `POST /api/auth/login` |
| Password hashing | ✅ Complete | bcrypt, 12 rounds (`SALT_ROUNDS = 12`) |
| Password verification | ✅ Complete | `bcrypt.compare` on login and change-password |
| JWT/session handling | ⚠️ Partial | **Opaque DB tokens**, not JWT. Bearer header lookup in `user_tokens`. Single active session (old tokens deleted on login). |
| User isolation | ⚠️ Partial | All protected routes filter by `req.userId`. **Gap:** income/expense POST/PUT do not verify `categoryId` belongs to the authenticated user. |
| UNIQUE mobile number | ✅ Complete | DB unique constraint + 409 on register |
| Every query filtered by `user_id` | ⚠️ Partial | All domain CRUD uses `userId`. Category lookup on income/expense create uses `categoryId` only (no ownership check). |

**Additional auth endpoints:**

| Endpoint | Status |
|----------|--------|
| Register | ✅ Seeds 21 default categories |
| Logout | ✅ Deletes token row |
| GET /auth/me | ✅ |
| Change password | ✅ |
| Forgot password | ❌ Stub — always returns success, no DB/SMS action |

**Security gaps:**
- Tokens never expire (no TTL column or cleanup).
- Auth tokens stored in AsyncStorage (unencrypted) — acceptable for MVP but not production-hardened.
- CORS wide open (`cors()` with no origin restriction).
- No rate limiting on login/register.
- `cookie-parser` in dependencies but unused.

---

## 6. Feature Completion Table

| Feature | Complete | Partial | Missing |
|---------|:--------:|:-------:|:-------:|
| **Auth — Register/Login/Logout** | ✅ | | |
| **Auth — Change password** | ✅ | | |
| **Auth — Forgot password** | | | ✅ |
| **Auth — JWT** | | | ✅ (uses opaque tokens instead) |
| **Categories — Income/Expense CRUD** | ✅ | | |
| **Categories — Loan/Goal types** | | ✅ UI tabs exist | API only supports income/expense |
| **Categories — Icon/color on create** | | ✅ Update only | Create ignores icon/color |
| **Income — CRUD** | ✅ | | |
| **Income — Recurrence UI** | ✅ | | |
| **Income — Recurrence display in list** | | | ✅ (TransactionItem shows date only) |
| **Income — Future schedule generation** | | | ✅ |
| **Expense — CRUD** | ✅ | | |
| **Expense — Recurrence UI + display** | ✅ | | |
| **Expense — EMI category smart display** | ✅ | | |
| **Expense — Future schedule generation** | | | ✅ |
| **Loan — CRUD** | ✅ | | |
| **Loan — EMI auto-calculation** | ✅ | | |
| **Loan — Outstanding/end date/months** | ✅ | | |
| **Loan — Interest paid/remaining** | ✅ | | |
| **Loan — Prepayment simulator (UI)** | ✅ | | |
| **Loan — Prepayment simulator (API)** | | | ✅ |
| **Goal — CRUD** | ✅ | | |
| **Goal — Progress calculation** | ✅ | | |
| **Dashboard — Monthly income/expenses** | ✅ | | |
| **Dashboard — EMI due / net savings** | | ✅ | Formula concerns (see § Dashboard) |
| **Dashboard — Goal progress** | ✅ | | |
| **Dashboard — Upcoming recurring** | | ✅ | Next occurrence only; ignores `occurrences` |
| **Dashboard — Recent transactions** | ✅ | | |
| **Recurring — One Time / Monthly / Quarterly / Half-Yearly / Yearly** | ✅ UI + storage | | Server schedule gen |
| **Recurring — Occurrence count enforcement** | | | ✅ |
| **Recurring — Total planned amount (UI)** | ✅ ExpenseCard | ✅ Income list | |
| **Theme preference storage** | | | ✅ (always dark; no toggle) |
| **OpenAPI/Zod validation in handlers** | | | ✅ (manual validation only) |
| **Mobile responsive breakpoints** | | ✅ Mobile-first | No tablet/desktop layouts |

---

## 7. Bugs Found

### Critical / High

1. **Category cross-user reference (IDOR):** `POST/PUT /incomes` and `/expenses` accept any valid `categoryId` without verifying it belongs to `req.userId`. A user could attach another user's category to their transaction.

2. **Loan/Goal category tabs broken:** `categories.tsx` exposes tabs for `loan` and `goal` types, but API GET `/categories?type=loan|goal` returns empty (only income/expense seeded). Creating loan/goal categories works at DB level but has no functional integration with loans/goals features. TypeScript error: `CategoryType` includes `"loan" | "goal"` but `GetCategoriesType` only allows `"income" | "expense"`.

3. **AsyncStorage stores user profile (`lifeops_user`):** Violates requirement that client storage should only hold auth token and theme preference. Profile should come from `GET /auth/me` on startup.

4. **`monthsBetween` ignores day-of-month:** Uses calendar month delta only. A loan starting on the 25th counts as 1 month elapsed on the 1st of the next month, overstating elapsed months and understating outstanding balance.

5. **Dashboard `emiDueThisMonth` ignores selected month:** Always sums active loan EMIs based on today's date, even when user navigates to a past/future month on the dashboard. Net savings for historical months incorrectly subtracts current EMI obligations.

6. **Loans screen `totalEmi` sums all loans:** Includes completed loans (`monthsRemaining === 0`) unlike dashboard which filters `elapsed < totalMonths`.

### Medium

7. **Delete endpoints silent on missing rows:** Returns `{ message: "Deleted" }` even when 0 rows affected.

8. **Loan delete doesn't invalidate dashboard query:** Unlike income/expense/goals mutations.

9. **Category create ignores icon/color:** UI collects selections but `createMutation.mutate({ data: { name, type: activeTab } })` omits them.

10. **ExpenseCard EMI logic conflates recurrence `occurrences` with loan tenure:** For category `"EMI"`, treats `occurrences` as total EMI months — not linked to actual loan records.

11. **Prepayment simulator keeps EMI constant after lump sum:** Mathematically, bank would recalculate a lower EMI for same tenure; simulator assumes same EMI with shorter tenure (acceptable for one scenario but should be documented).

12. **Dead code:** `calcPrepay()` function in `LoanCard.tsx` is defined but unused; `isHomeLoan` computed but unused.

13. **OpenAPI vs API mismatch:** OpenAPI allows category types `loan|goal`; GET query param enum in OpenAPI path only lists `income|expense`.

### Low

14. **Date format inconsistency:** Storage uses `YYYY-MM-DD`; forms display `DD-MM-YYYY` for income/expense/loans but `YYYY-MM-DD` for goals.

15. **Income list hides recurrence metadata** while expense list shows it.

16. **No token expiry or refresh mechanism.**

---

## 8. Technical Debt

| Area | Debt |
|------|------|
| **Validation** | Manual inline checks in routes; `@workspace/api-zod` generated but unused |
| **Error handling** | No global error middleware; async route errors rely on Express default |
| **Code duplication** | EMI/outstanding formulas duplicated in `loans.ts` and `dashboard.ts`; client duplicates in `AddLoanModal.tsx` and `LoanCard.tsx` |
| **Auth model** | Opaque tokens without expiry; profile cached in AsyncStorage |
| **Recurring transactions** | Metadata-only storage; no schedule table or occurrence generation |
| **Testing** | No unit, integration, or E2E tests in repository |
| **Linting/formatting** | Prettier in root devDeps but no ESLint config; no pre-commit hooks |
| **Platform overrides** | `pnpm-workspace.yaml` excludes all non-Linux esbuild/lightningcss binaries — breaks local macOS builds |
| **Category model** | OpenAPI promises 4 types; implementation supports 2 functionally |
| **Security** | No rate limiting, no CORS restriction, unencrypted token storage |
| **Forgot password** | Placeholder stub |
| **Mockup sandbox** | Present but disconnected from production app |

---

## 9. Build Issues

### Commands run

```bash
# Root workspace
pnpm run build          → FAILED

# API server
pnpm run typecheck      → FAILED (tsc not found)
pnpm run build          → FAILED (@esbuild/darwin-arm64 not found)

# Mobile
pnpm run typecheck      → FAILED (60+ TypeScript errors)
pnpm run build          → FAILED (EXPO_PUBLIC_DOMAIN not set)
```

### Root cause summary

| Issue | Cause |
|-------|-------|
| `tsc: command not found` | Root `node_modules` missing — `pnpm install` not run at workspace root |
| `@esbuild/darwin-arm64` missing | `pnpm-workspace.yaml` overrides exclude macOS esbuild packages (Replit Linux-targeted config) |
| Mobile typecheck failures | Strict TS + implicit `any` in app code; Orval-generated client type mismatches with `@tanstack/react-query` v5 |
| Mobile build failure | Requires `EXPO_PUBLIC_DOMAIN`, `REPLIT_DEV_DOMAIN`, or `REPLIT_INTERNAL_APP_DOMAIN` |
| API runtime | Requires `DATABASE_URL` and `PORT` |

### Prior build evidence

`.tsbuildinfo` files exist in `artifacts/mobile`, `artifacts/api-server`, and `lib/*` — indicating successful typecheck on Replit (Linux) environment previously.

### Missing dependencies (local macOS)

- Root: `typescript`, `prettier` (declared but not installed)
- `artifacts/api-server`: platform-specific esbuild binary excluded by overrides

---

## 10. Runtime Issues

Runtime could not be fully verified locally due to missing environment variables and build failures.

| Component | Blocker | Expected behavior |
|-----------|---------|-------------------|
| API server | `DATABASE_URL`, `PORT` | Express listens, connects to PostgreSQL |
| Mobile dev | `EXPO_PUBLIC_DOMAIN`, Replit proxy vars | Expo dev server + API proxy |
| Mobile production build | `EXPO_PUBLIC_DOMAIN` | Static web export via `scripts/build.js` |
| DB migrations | `DATABASE_URL` | `drizzle-kit push` or `scripts/src/migrate.ts` |

**Potential runtime issues (from code review):**

- Unhandled promise rejections in route handlers (no try/catch).
- `setBaseUrl(`https://${process.env.EXPO_PUBLIC_DOMAIN}`)` — undefined domain produces `https://undefined` API calls.
- Auth loading race: app may flash auth screen before AsyncStorage read completes (mitigated by `loading` gate).

---

## 11. Security Concerns

| Severity | Concern |
|----------|---------|
| **High** | Category IDOR — cross-user category reference on income/expense create |
| **High** | Auth tokens in unencrypted AsyncStorage (XSS/web) or device backup exposure |
| **Medium** | No token expiration — stolen token valid indefinitely |
| **Medium** | CORS allows all origins |
| **Medium** | No rate limiting on auth endpoints (brute force) |
| **Medium** | Forgot-password stub could enable user enumeration if implemented incorrectly |
| **Low** | Password minimum length only 6 characters |
| **Low** | No HTTPS enforcement at application layer (relies on deployment) |
| **Low** | Delete operations don't confirm row ownership result (information leakage minimal) |

---

## 12. Performance Concerns

| Area | Concern |
|------|---------|
| **Dashboard query** | Loads ALL incomes/expenses for recurring preview on every dashboard request — N+1 pattern avoided but full table scan per user |
| **Loan list** | Outstanding recalculated per loan on every GET (acceptable for small datasets) |
| **React Query** | 30s staleTime reasonable; no pagination on any list endpoint |
| **No DB indexes** | Beyond PK/unique constraints, no indexes on `user_id + date` columns used in month filters |
| **Single session** | Token delete+insert on every login — minor write amplification |
| **Mobile lists** | Full FlatList render without virtualization tuning for large datasets |

---

## 13. Mobile UI Issues

**Audit method:** Static code review (no live viewport testing). App is mobile-first with no explicit breakpoint handling for 375/390/430/768/1024px.

### Layout patterns observed

- Fixed horizontal padding 16–20px
- 2-column stat grids (`flex: 1` on StatCard)
- Horizontal chip scrollers for categories, recurrence, loan types
- FAB positioned `bottom: insets.bottom + 90`
- Tab bar height 84px on web

### Potential issues by viewport

| Width | Screen / Component | Issue |
|-------|-------------------|-------|
| **375px** | Dashboard month label (`minWidth: 160`) | May crowd header alongside avatar on narrow screens |
| **375px** | Categories 4-tab row (`flex: 1` each) | Tab labels may truncate ("Expense", "Income" OK; tight spacing) |
| **375px** | LoanCard grid (`width: "30%"`) | 3-column grid — labels like "Principal Paid" may wrap awkwardly |
| **390px** | Same as 375px | Slightly more room; issues persist |
| **430px** | Stat cards 2-column | Generally acceptable |
| **768px** | All screens | Content stretches full width — no max-width container; poor tablet layout |
| **1024px** | All screens | Same — single column centered content with excessive whitespace; tab bar full width |

### Touch target concerns

| Element | Size | Apple HIG (44pt) |
|---------|------|------------------|
| Month nav buttons | 36×36 | ❌ Below minimum |
| Back/close buttons | 36×36 | ❌ Below minimum |
| Category tab buttons | ~flex 1/4 width | ✅ Height OK |
| FAB | 56×56 | ✅ |
| Chip selectors | ~32–40px height | ⚠️ Borderline |

### Overflow / clipping

- `overflow: "hidden"` on progress bars and cards — intentional clipping
- Horizontal chip `ScrollView` prevents vertical overflow for long category names
- No `numberOfLines` / ellipsis on long loan names or category chips — potential horizontal overflow inside chips
- `ExpenseCard` 3-column footer grid (`width: "33.33%"`) may clip on narrow screens

### Web-specific

- Extra header padding on web (`Platform.OS === "web" ? 30 : 12`)
- Tab bar fixed height 84px
- No responsive sidebar or multi-column layout at 768/1024px

---

## 14. Exact Files That Require Modification

### Authentication & security
- `artifacts/api-server/src/routes/incomes.ts` — category ownership validation
- `artifacts/api-server/src/routes/expenses.ts` — category ownership validation
- `artifacts/api-server/src/routes/auth.ts` — forgot-password implementation, optional token TTL
- `artifacts/api-server/src/middlewares/auth.ts` — optional token expiry check
- `artifacts/mobile/context/AuthContext.tsx` — remove `lifeops_user` cache; fetch profile from API

### Categories
- `artifacts/api-server/src/routes/categories.ts` — validate `type` enum; loan/goal support or restrict
- `artifacts/mobile/app/categories.tsx` — align tabs with API; fix TS type mismatch; pass icon/color on create
- `lib/api-spec/openapi.yaml` — reconcile category type enum with implementation

### Recurring transactions
- `artifacts/api-server/src/routes/incomes.ts` — recurrence enum validation, schedule generation
- `artifacts/api-server/src/routes/expenses.ts` — same
- `artifacts/api-server/src/routes/dashboard.ts` — respect `occurrences`; month-aware recurring
- `artifacts/mobile/components/TransactionItem.tsx` — show recurrence on income rows

### Loans
- `artifacts/api-server/src/routes/loans.ts` — extract shared calc utils; fix `monthsBetween` day logic
- `artifacts/api-server/src/routes/dashboard.ts` — dedupe calc utils; month-aware EMI; consistent rounding
- `artifacts/mobile/components/LoanCard.tsx` — remove dead code; prepay formula alignment
- `artifacts/mobile/app/(tabs)/loans.tsx` — filter completed loans from totalEmi; invalidate dashboard on delete

### Dashboard
- `artifacts/api-server/src/routes/dashboard.ts` — month-scoped EMI/savings calculation
- `artifacts/mobile/app/(tabs)/index.tsx` — client-side label clarity if server formula changes

### Database
- `lib/db/src/schema/index.ts` — optional indexes; recurrence schedule table if implementing generation
- `lib/db/drizzle.config.ts` — no change expected

### Build / tooling
- `pnpm-workspace.yaml` — macOS esbuild overrides (or conditional per platform)
- `package.json` (root) — ensure install works cross-platform
- `lib/api-spec/orval.config.ts` — regenerate client after OpenAPI fixes
- `lib/api-client-react/src/generated/api.ts` — regenerate (fix TanStack Query v5 types)
- `artifacts/mobile/tsconfig.json` — possibly exclude generated src from strict check or fix Orval output
- `artifacts/mobile/app/_layout.tsx` — guard against undefined `EXPO_PUBLIC_DOMAIN`

### UI / UX
- `artifacts/mobile/constants/colors.ts` — theme toggle support if required
- `artifacts/mobile/hooks/useColors.ts` — persist theme preference
- `artifacts/mobile/app/(tabs)/_layout.tsx` — fix implicit `any` on tabBarIcon
- `artifacts/mobile/components/StatCard.tsx` — responsive max-width for tablet
- Multiple tab screens — increase touch targets to 44px minimum

### Error handling
- `artifacts/api-server/src/app.ts` — global error middleware

---

## 15. Recommended Implementation Order

### Phase 1 — Unblock build & environment (prerequisite)
1. Run `pnpm install` at workspace root.
2. Fix `pnpm-workspace.yaml` esbuild overrides for local macOS development (or document Replit-only builds).
3. Set required env vars: `DATABASE_URL`, `PORT`, `EXPO_PUBLIC_DOMAIN`.
4. Verify API and mobile typecheck pass (fix Orval/TanStack type errors).

### Phase 2 — Security & data integrity (critical)
5. Add category ownership validation on income/expense create/update.
6. Remove `lifeops_user` from AsyncStorage; use `/auth/me` on app load.
7. Add category `type` validation (income vs expense) on transaction create.

### Phase 3 — Correct financial calculations
8. Fix `monthsBetween` to account for day-of-month (or document calendar-month convention explicitly).
9. Align dashboard EMI/savings with selected month vs current obligations — define product rule first.
10. Filter completed loans from loans screen `totalEmi`.
11. Extract shared loan calculation module (server + client).

### Phase 4 — Feature completion
12. Implement recurring transaction schedule generation (or remove `occurrences` from UI if out of scope).
13. Fix category loan/goal tabs — either implement fully or remove from UI.
14. Pass icon/color on category create.
15. Show recurrence on income list items.
16. Implement forgot-password (OTP/SMS) or remove UI.

### Phase 5 — API quality
17. Wire `@workspace/api-zod` into Express middleware for request validation.
18. Add global error handler and consistent error response shape.
19. Regenerate OpenAPI client; fix TypeScript errors.

### Phase 6 — UX & polish
20. Increase touch targets to 44px minimum.
21. Add max-width container for tablet/desktop (768px+).
22. Theme preference storage if required.
23. Invalidate dashboard on loan delete.

### Phase 7 — Production readiness
24. Token expiration policy.
25. Rate limiting on auth routes.
26. DB indexes on `(user_id, date)`.
27. Test suite (loan formulas, auth, CRUD isolation).

---

## Appendix A — API Endpoint Inventory

| Method | Path | Auth | Validation | Notes |
|--------|------|:----:|:----------:|-------|
| GET | `/healthz` | No | Zod response only | |
| POST | `/auth/register` | No | Manual | bcrypt, unique mobile |
| POST | `/auth/login` | No | Manual | |
| POST | `/auth/logout` | Optional | — | |
| GET | `/auth/me` | Yes | — | |
| POST | `/auth/change-password` | Yes | Manual | |
| POST | `/auth/forgot-password` | No | Stub | No-op |
| GET | `/categories` | Yes | — | Optional `?type=` filter |
| POST | `/categories` | Yes | Manual | No type enum check |
| PUT | `/categories/:id` | Yes | Manual | |
| DELETE | `/categories/:id` | Yes | — | Silent if missing |
| GET | `/incomes` | Yes | — | Optional `?month=YYYY-MM` |
| POST | `/incomes` | Yes | Manual | No category ownership check |
| PUT | `/incomes/:id` | Yes | Manual | |
| DELETE | `/incomes/:id` | Yes | — | |
| GET | `/expenses` | Yes | — | Same as incomes |
| POST | `/expenses` | Yes | Manual | Same gaps |
| PUT | `/expenses/:id` | Yes | Manual | |
| DELETE | `/expenses/:id` | Yes | — | |
| GET | `/loans` | Yes | — | Returns computed fields |
| POST | `/loans` | Yes | Manual + tenure rules | |
| PUT | `/loans/:id` | Yes | Manual | |
| DELETE | `/loans/:id` | Yes | — | |
| GET | `/goals` | Yes | — | Includes progressPercentage |
| POST | `/goals` | Yes | Manual | |
| PUT | `/goals/:id` | Yes | Partial | Allows empty partial update |
| DELETE | `/goals/:id` | Yes | — | |
| GET | `/dashboard` | Yes | — | Optional `?month=YYYY-MM` |

---

## Appendix B — Loan Formula Verification

### EMI (standard reducing balance) ✅ Correct

```
n = tenureYears × 12
r = annualRate / 100 / 12
EMI = P × r × (1+r)^n / ((1+r)^n - 1)    [when r > 0]
EMI = P / n                                 [when r = 0]
```

Implemented identically in `loans.ts`, `dashboard.ts`, `AddLoanModal.tsx`.

**Example:** P=₹10,00,000, r=8.5%, n=240 → EMI ≈ ₹8,678 (matches standard calculators).

### Outstanding after k months ✅ Correct formula

```
B_k = P × (1+r)^k − EMI × ((1+r)^k − 1) / r
```

Standard amortization closed-form. Implemented in `calcOutstanding()`.

### Months elapsed ⚠️ Simplified

Uses `(yearDiff × 12 + monthDiff)` without day comparison. Overcounts if today's day < start day.

### End date

`startDate + tenureYears × 12 months` via `setMonth()` — does not adjust for month-end edge cases (e.g., Jan 31 + 1 month).

### Interest paid

`interestPaid = max(0, EMI × elapsed − (principal − outstanding))` — consistent with amortization.

### Total interest

`EMI × totalMonths − principal` — correct for fixed-EMI loan.

### Prepayment simulator (client) ✅ Approximate

Uses `n = ceil(−ln(1 − B×r/EMI) / ln(1+r))` — correct for fixed EMI, reduced tenure after lump sum. Interest saved formula is simplified but directionally correct.

---

## Appendix C — Dashboard Formula Verification

| Metric | Formula | Correct? |
|--------|---------|:----------:|
| **Income** | `SUM(amount) WHERE user_id AND date LIKE 'YYYY-MM%'` | ✅ |
| **Expenses** | Same pattern | ✅ |
| **EMI Due This Month** | `SUM(emi) WHERE elapsed < totalMonths` (today-based) | ⚠️ Not month-scoped |
| **Net Savings** | `income − expenses − emiDueThisMonth` | ⚠️ EMI not aligned to selected month |
| **Outstanding Loans** | Sum of per-loan outstanding formula | ✅ (day issue inherited) |
| **Goal Progress** | `AVG(min(100, current/target × 100))` | ✅ |

---

## Appendix D — Client Storage Audit (localStorage / AsyncStorage)

On **web**, `@react-native-async-storage/async-storage` uses `localStorage` under the hood.

| Key | Location | Content | Allowed? |
|-----|----------|---------|:--------:|
| `lifeops_auth_token` | `AuthContext.tsx` | Bearer token string | ✅ Auth token |
| `lifeops_user` | `AuthContext.tsx` | `{ id, fullName, mobile }` JSON | ❌ Application data |

**No other application keys** found in project source code.

**Theme preference:** Not persisted anywhere. App always renders dark palette (`constants/colors.ts` — light and dark identical).

---

## Appendix E — Environment Variables

| Variable | Required by | Purpose |
|----------|-------------|---------|
| `DATABASE_URL` | API, Drizzle, migrations | PostgreSQL connection (Neon-compatible) |
| `PORT` | `api-server/index.ts` | HTTP listen port |
| `NODE_ENV` | Logger | production vs development logging |
| `LOG_LEVEL` | Logger | Pino level (default `info`) |
| `EXPO_PUBLIC_DOMAIN` | Mobile `_layout.tsx`, build | API base URL host |
| `REPLIT_DEV_DOMAIN` | Mobile dev script | Replit dev proxy |
| `REPLIT_EXPO_DEV_DOMAIN` | Mobile dev script | Expo packager proxy |
| `REPL_ID` | Mobile dev script | Replit identifier |
| `REPLIT_INTERNAL_APP_DOMAIN` | Mobile build script | Production domain fallback |

---

*End of audit. No code changes were made. Awaiting approval before implementation.*
