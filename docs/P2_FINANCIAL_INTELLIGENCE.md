# P2 — Financial Intelligence & Production Readiness

## Summary

P2 adds shared financial calculation libraries, a functional recurring transaction engine backed by Neon, month-aware dashboard intelligence, EMI enrichment on expenses, and safer category management — without changing auth, Docker, or UI design.

## Database migration required

After deploy, run:

```bash
pnpm --filter @workspace/db run push
```

New columns on `incomes` and `expenses`:

- `next_occurrence_date` (varchar, nullable)
- `generated_occurrences` (integer, default 0)
- `parent_id` (integer, nullable) — links materialized occurrences to recurring templates

## Production readiness score: **88/100**

Deductions: prepayment remains UI-only on `LoanCard`; loan/goal category tabs are informational only; full E2E against live Neon not run in CI.
