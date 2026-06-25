# P1 — Neon Persistence & User State

**Date:** 2025-06-25  
**Scope:** Single source of truth in PostgreSQL (Neon); remove client-side user profile cache; category ownership fix. No UI redesign, no auth mechanism changes, no new features.

---

## Summary

| Goal | Status |
|------|--------|
| Neon/PostgreSQL as single source of truth | ✅ All app data already persisted via Drizzle ORM; no client-side app data storage |
| Remove user profile from AsyncStorage | ✅ Only `lifeops_auth_token` retained; legacy `lifeops_user` purged on load/logout |
| Fetch profile from DB after login | ✅ `GET /api/auth/me` on login and app restore |
| CRUD reads/writes Neon directly | ✅ Verified (see audit below) |
| All queries filtered by `user_id` | ✅ Verified; category joins hardened |
| Category ownership on income/expense | ✅ Fixed IDOR on create/update |
| Persist across refresh / logout-login / devices | ✅ Profile from API; financial data never cached locally |

---

## Files Modified

| File | Change |
|------|--------|
| `artifacts/mobile/context/AuthContext.tsx` | Store token only; fetch profile via `getMe()`; remove `lifeops_user` read/write; purge legacy key on init |
| `artifacts/mobile/app/(auth)/index.tsx` | `login(data.token)` instead of passing cached user object |
| `artifacts/api-server/src/lib/categories.ts` | **New** — `getOwnedCategory()` validates `user_id` + category type |
| `artifacts/api-server/src/routes/incomes.ts` | Category ownership on POST/PUT; user-scoped category join on GET |
| `artifacts/api-server/src/routes/expenses.ts` | Category ownership on POST/PUT; user-scoped category join on GET |
| `artifacts/api-server/src/routes/dashboard.ts` | User-scoped category joins on income/expense queries |

---

## Client Storage After P1

| Key | Storage | Purpose | Allowed |
|-----|---------|---------|---------|
| `lifeops_auth_token` | AsyncStorage (→ localStorage on web) | Bearer session token | ✅ Auth only |
| `lifeops_user` | — | **Removed** | ❌ Was profile cache |

**No other application keys** in mobile source. React Query holds in-memory server state only (cleared on logout via `queryClient.clear()` in profile screen).

---

## User Profile Flow

```
Login/Register → API returns token
       ↓
AsyncStorage.setItem("lifeops_auth_token", token)
       ↓
GET /api/auth/me (Bearer token) → users table in PostgreSQL
       ↓
setUser({ id, fullName, mobile }) in React state only

App restart → read token → GET /api/auth/me → fresh profile from Neon
Invalid/expired token → clear token, redirect to auth
```

Authentication mechanism unchanged: opaque Bearer tokens in `user_tokens` table, bcrypt passwords, same login/register endpoints.

---

## CRUD Audit — All Operations Use PostgreSQL

| Resource | GET | POST | PUT | DELETE | `user_id` filter |
|----------|-----|------|-----|--------|------------------|
| **Categories** | `eq(categories.userId)` | inserts `userId: req.userId` | `id + userId` | `id + userId` | ✅ |
| **Incomes** | `eq(incomes.userId)` | inserts `userId` + owned category check | `id + userId` + owned category | `id + userId` | ✅ |
| **Expenses** | `eq(expenses.userId)` | inserts `userId` + owned category check | `id + userId` + owned category | `id + userId` | ✅ |
| **Loans** | `eq(loans.userId)` | inserts `userId` | `id + userId` | `id + userId` | ✅ |
| **Goals** | `eq(goals.userId)` | inserts `userId` | `id + userId` | `id + userId` | ✅ |
| **Dashboard** | all sub-queries use `userId` | — | — | — | ✅ |
| **Auth /me** | `eq(users.id, req.userId)` | — | — | — | ✅ |

**No SQLite, IndexedDB, or local file storage** for application data. `@workspace/db` uses `pg` + `DATABASE_URL` (Neon-compatible).

---

## Category Ownership Fix

**Before:** `POST/PUT /incomes` and `/expenses` accepted any valid `categoryId` FK without checking ownership — cross-user IDOR.

**After:** `getOwnedCategory(userId, categoryId, expectedType)`:
1. `SELECT` category `WHERE id = ? AND user_id = ?`
2. Returns 404 if not found
3. Returns 400 if category `type` ≠ `income` / `expense`
4. Category name taken from owned row (no unscoped lookup)

**Defense in depth:** List/dashboard category joins now include `eq(categories.userId, userId)` so stale FK rows cannot leak another user's category name.

---

## Verification Performed

### Static code audit
- Grep of `AsyncStorage` / `localStorage` in `artifacts/mobile` (excl. `node_modules`): only `AuthContext.tsx` uses AsyncStorage; only `lifeops_auth_token` + legacy purge of `lifeops_user`
- Reviewed all 8 API route files for `req.userId` usage on protected endpoints
- Confirmed mobile CRUD uses React Query hooks → HTTP → Express → Drizzle → PostgreSQL only

### TypeScript / build
```bash
pnpm run typecheck   # ✅ Pass (api-server, mobile, libs, scripts)
cd artifacts/api-server && pnpm run build   # ✅ Pass
```

### Runtime smoke (when API running)
```bash
curl http://localhost:5001/api/healthz          # {"status":"ok"}
# With valid Bearer token:
curl -H "Authorization: Bearer <token>" http://localhost:5001/api/auth/me
```

### Persistence scenarios (by design)

| Scenario | Expected behavior |
|----------|-------------------|
| **Page refresh** | Token restored from AsyncStorage → `GET /auth/me` → profile from Neon; React Query refetches incomes/expenses/etc. from API |
| **Logout → login** | Token cleared; `queryClient.clear()`; new login fetches fresh profile and data from Neon |
| **Different device** | Same mobile + password → new token → same Neon data via API (no local profile drift) |
| **Profile edit on server** | Next `GET /auth/me` (login or app load) reflects DB truth; no stale AsyncStorage profile |

---

## Remaining Issues

| Issue | Severity | Notes |
|-------|----------|-------|
| **PostgreSQL must be provisioned** | Required | Set `DATABASE_URL` to Neon connection string; run `pnpm --filter @workspace/db run push` |
| **Pre-existing bad category FK rows** | Low | Rows created before P1 with another user's `category_id` will show empty category name (join filtered); re-save transaction to fix |
| **React Query in-memory cache** | Info | Not persistence — cleared on logout; refresh refetches from Neon |
| **Token in unencrypted AsyncStorage** | Info | Auth unchanged per scope; consider SecureStore in future hardening |
| **HTTPS vs HTTP local API** | Info | Mobile uses `https://${EXPO_PUBLIC_DOMAIN}` — local dev may need proxy alignment (pre-existing) |
| **Category loan/goal tabs** | Info | UI tabs exist; API category type for transactions remains income/expense only (unchanged) |

---

*P1 complete. No UI redesign, no authentication mechanism changes, no new features.*
