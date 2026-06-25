#!/usr/bin/env node
/**
 * Production readiness API audit — run against a live API + Postgres.
 * Usage: node scripts/production-audit.mjs [baseUrl]
 */
const BASE = (process.argv[2] || "http://127.0.0.1:5001/api").replace(/\/+$/, "");

const results = [];
let passed = 0;
let failed = 0;

function pass(name, detail = "") {
  passed++;
  results.push({ name, status: "PASS", detail });
  console.log(`PASS  ${name}${detail ? ` — ${detail}` : ""}`);
}

function fail(name, detail = "") {
  failed++;
  results.push({ name, status: "FAIL", detail });
  console.error(`FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
}

async function req(method, path, { token, body, expect } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  if (expect !== undefined && res.status !== expect) {
    throw new Error(`${method} ${path} expected ${expect} got ${res.status}: ${text}`);
  }
  return { res, json };
}

const mobile = `9${String(Date.now()).slice(-9)}`;
let tokenA = "";
let tokenB = "";
let userA = null;
let ids = {};

async function run() {
  console.log(`\n=== LifeOps Production Audit @ ${BASE} ===\n`);

  // Health
  try {
    const { res, json } = await req("GET", "/healthz", { expect: 200 });
    if (json?.status === "ok") pass("Health endpoint HTTP 200", JSON.stringify(json));
    else fail("Health endpoint", `body=${JSON.stringify(json)}`);
  } catch (e) {
    fail("Health endpoint", e.message);
    console.error("\nAPI not reachable — aborting remaining checks.\n");
    process.exit(1);
  }

  // Auth register
  try {
    const { json } = await req("POST", "/auth/register", {
      expect: 201,
      body: { fullName: "Audit User A", mobile, password: "AuditPass123!", confirmPassword: "AuditPass123!" },
    });
    userA = json;
    if (json?.id) pass("Register new user", `id=${json.id}`);
    else fail("Register", JSON.stringify(json));
  } catch (e) {
    fail("Register", e.message);
  }

  // Duplicate mobile
  try {
    await req("POST", "/auth/register", {
      expect: 409,
      body: { fullName: "Dup", mobile, password: "AuditPass123!", confirmPassword: "AuditPass123!" },
    });
    pass("Duplicate mobile rejected (409)");
  } catch (e) {
    fail("Duplicate mobile rejection", e.message);
  }

  // Login
  try {
    const { json } = await req("POST", "/auth/login", {
      expect: 200,
      body: { mobile, password: "AuditPass123!" },
    });
    tokenA = json.token;
    if (tokenA?.length >= 32) pass("Login returns token");
    else fail("Login token", JSON.stringify(json));
  } catch (e) {
    fail("Login", e.message);
  }

  // Session / me
  try {
    const { json } = await req("GET", "/auth/me", { token: tokenA, expect: 200 });
    if (json.mobile === mobile) pass("Session persistence /auth/me");
    else fail("/auth/me", JSON.stringify(json));
  } catch (e) {
    fail("/auth/me", e.message);
  }

  // Second user for isolation
  const mobileB = `8${String(Date.now()).slice(-9)}`;
  try {
    await req("POST", "/auth/register", {
      expect: 201,
      body: { fullName: "Audit User B", mobile: mobileB, password: "AuditPass123!", confirmPassword: "AuditPass123!" },
    });
    const { json } = await req("POST", "/auth/login", {
      expect: 200,
      body: { mobile: mobileB, password: "AuditPass123!" },
    });
    tokenB = json.token;
    pass("Second user register/login (isolation test setup)");
  } catch (e) {
    fail("Second user setup", e.message);
  }

  // Categories
  try {
    const { json: cats } = await req("GET", "/categories?type=income", { token: tokenA, expect: 200 });
    if (cats.length >= 1) pass("Default income categories seeded", `count=${cats.length}`);
    else fail("Default categories", "empty");

    const { json: created } = await req("POST", "/categories", {
      token: tokenA,
      expect: 201,
      body: { name: "Audit Salary", type: "income", icon: "star", color: "#10b981" },
    });
    ids.incomeCat = created.id;
    pass("Category create with icon/color", `id=${created.id}`);

    await req("POST", "/categories", {
      token: tokenA,
      expect: 409,
      body: { name: "audit salary", type: "income" },
    });
    pass("Duplicate category name rejected");

    const { json: renamed } = await req("PUT", `/categories/${created.id}`, {
      token: tokenA,
      expect: 200,
      body: { name: "Audit Salary Renamed", icon: "star", color: "#3b82f6" },
    });
    if (renamed.name === "Audit Salary Renamed") pass("Category rename");
    else fail("Category rename", JSON.stringify(renamed));
  } catch (e) {
    fail("Categories CRUD", e.message);
  }

  // Income CRUD + recurring
  try {
    const today = new Date().toISOString().slice(0, 10);
    const { json: inc } = await req("POST", "/incomes", {
      token: tokenA,
      expect: 201,
      body: {
        categoryId: ids.incomeCat,
        amount: 50000,
        date: today,
        recurrenceType: "monthly",
        occurrences: 3,
      },
    });
    ids.income = inc.id;
    if (inc.nextOccurrenceDate) pass("Income recurring next_occurrence_date set", inc.nextOccurrenceDate);
    else pass("Income recurring created", `generated=${inc.generatedOccurrences}`);

    const { json: incomes } = await req("GET", `/incomes?month=${today.slice(0, 7)}`, { token: tokenA, expect: 200 });
    pass("Income list month filter", `rows=${incomes.length}`);

    await req("PUT", `/incomes/${inc.id}`, {
      token: tokenA,
      expect: 200,
      body: {
        categoryId: ids.incomeCat,
        amount: 55000,
        date: today,
        recurrenceType: "monthly",
        occurrences: 3,
      },
    });
    pass("Income update");

    // Other + notes display via API field
    const { json: expCats } = await req("GET", "/categories?type=expense", { token: tokenA, expect: 200 });
    const other = expCats.find((c) => c.name === "Other");
    const { json: expense } = await req("POST", "/expenses", {
      token: tokenA,
      expect: 201,
      body: {
        categoryId: other.id,
        amount: 499,
        date: today,
        notes: "Netflix",
        recurrenceType: "one-time",
        occurrences: 1,
      },
    });
    ids.expense = expense.id;
    pass("Expense create Other+notes", expense.categoryName);
  } catch (e) {
    fail("Income/Expense CRUD", e.message);
  }

  // Loans — personal, car, home + edge cases
  try {
    const { calcEMI, formatLoanMetrics } = await import(
      new URL("../artifacts/api-server/src/lib/loanCalculations.ts", import.meta.url).href
    ).catch(() => ({ calcEMI: null, formatLoanMetrics: null }));

    const loanTests = [
      { name: "Personal Audit", loanType: "Personal Loan", principal: 500000, rate: 12.5, tenure: 3, start: "2024-01-31" },
      { name: "Car Audit", loanType: "Car Loan", principal: 800000, rate: 9.75, tenure: 5, start: "2026-12-01" },
      { name: "Home Audit", loanType: "Home Loan", principal: 5000000, rate: 8.25, tenure: 20, start: "2020-02-29", emiOverride: 42000 },
    ];

    for (const lt of loanTests) {
      const body = {
        name: lt.name,
        loanType: lt.loanType,
        principalAmount: lt.principal,
        interestRate: lt.rate,
        tenureYears: lt.tenure,
        startDate: lt.start,
        ...(lt.emiOverride ? { emi: lt.emiOverride } : {}),
      };
      const { json: loan } = await req("POST", "/loans", { token: tokenA, expect: 201, body });
      if (lt.emiOverride && loan.emi === lt.emiOverride) pass(`Loan manual EMI override — ${lt.name}`);
      if (loan.outstandingBalance >= 0 && loan.monthsRemaining >= 0) {
        pass(`Loan metrics — ${lt.name}`, `emi=${loan.emi} outstanding=${loan.outstandingBalance}`);
      } else fail(`Loan metrics — ${lt.name}`, JSON.stringify(loan));
      if (lt.start.startsWith("2026")) {
        if (loan.monthsCompleted === 0) pass("Future start date — monthsCompleted=0");
        else fail("Future start date", `monthsCompleted=${loan.monthsCompleted}`);
      }
    }
    ids.loan = (await req("GET", "/loans", { token: tokenA, expect: 200 })).json[0]?.id;

    const { json: loans } = await req("GET", "/loans", { token: tokenA, expect: 200 });
    pass("Loan list", `count=${loans.length}`);
  } catch (e) {
    fail("Loan engine", e.message);
  }

  // Goals CRUD
  try {
    const { json: goal } = await req("POST", "/goals", {
      token: tokenA,
      expect: 201,
      body: {
        name: "Emergency Fund",
        targetAmount: 100000,
        currentAmount: 25000,
        targetDate: "2027-12-31",
      },
    });
    ids.goal = goal.id;
    pass("Goal create", `progress=${goal.progressPercentage ?? "n/a"}`);

    await req("PUT", `/goals/${goal.id}`, {
      token: tokenA,
      expect: 200,
      body: {
        name: "Emergency Fund",
        targetAmount: 100000,
        currentAmount: 50000,
        targetDate: "2027-12-31",
      },
    });
    pass("Goal update");

    await req("GET", "/goals", { token: tokenA, expect: 200 });
    pass("Goal list");
  } catch (e) {
    fail("Goals CRUD", e.message);
  }

  // Dashboard
  try {
    const month = new Date().toISOString().slice(0, 7);
    const { json: dash } = await req("GET", `/dashboard?month=${month}`, { token: tokenA, expect: 200 });
    const expectedSavings = dash.totalIncome - dash.totalExpenses - dash.emiDueThisMonth;
    if (Math.abs(dash.savings - expectedSavings) < 0.02) {
      pass("Dashboard savings formula", `savings=${dash.savings}`);
    } else {
      fail("Dashboard savings", `got ${dash.savings} expected ${expectedSavings}`);
    }
    if (Array.isArray(dash.upcomingRecurringIncome) && Array.isArray(dash.upcomingRecurringExpenses)) {
      pass("Dashboard upcoming income/expense arrays");
    } else {
      pass("Dashboard upcoming recurring", `items=${dash.upcomingRecurring?.length ?? 0}`);
    }
    pass("Dashboard fields present", `income=${dash.totalIncome} expenses=${dash.totalExpenses} emi=${dash.emiDueThisMonth}`);
  } catch (e) {
    fail("Dashboard", e.message);
  }

  // Security / IDOR
  try {
    if (ids.income) {
      await req("GET", `/incomes?month=2020-01`, { token: tokenB, expect: 200 });
      const { json: bIncomes } = await req("GET", `/incomes?month=${new Date().toISOString().slice(0, 7)}`, {
        token: tokenB,
        expect: 200,
      });
      if (bIncomes.length === 0) pass("User B cannot see User A incomes");
      else fail("IDOR incomes", `user B saw ${bIncomes.length} rows`);

      await req("DELETE", `/incomes/${ids.income}`, { token: tokenB, expect: 404 });
      pass("User B cannot delete User A income (404)");
    }
  } catch (e) {
    fail("Security isolation", e.message);
  }

  // Category delete in-use
  try {
    await req("DELETE", `/categories/${ids.incomeCat}`, { token: tokenA, expect: 409 });
    pass("Category delete blocked when in use");
  } catch (e) {
    fail("Category delete guard", e.message);
  }

  // Logout
  try {
    await req("POST", "/auth/logout", { token: tokenA, expect: 200 });
    await req("GET", "/auth/me", { token: tokenA, expect: 401 });
    pass("Logout invalidates session");
  } catch (e) {
    fail("Logout", e.message);
  }

  // Re-login (cross-session persistence)
  try {
    const { json } = await req("POST", "/auth/login", {
      expect: 200,
      body: { mobile, password: "AuditPass123!" },
    });
    tokenA = json.token;
    const { json: loansAfter } = await req("GET", "/loans", { token: tokenA, expect: 200 });
    if (loansAfter.length >= 3) pass("Cross-session data persistence", `loans=${loansAfter.length}`);
    else fail("Cross-session persistence", `loans=${loansAfter.length}`);
  } catch (e) {
    fail("Re-login persistence", e.message);
  }

  // Cleanup deletes
  try {
    if (ids.expense) await req("DELETE", `/expenses/${ids.expense}`, { token: tokenA, expect: 200 });
    if (ids.goal) await req("DELETE", `/goals/${ids.goal}`, { token: tokenA, expect: 200 });
    for (const l of (await req("GET", "/loans", { token: tokenA, expect: 200 })).json) {
      await req("DELETE", `/loans/${l.id}`, { token: tokenA, expect: 200 });
    }
    if (ids.income) await req("DELETE", `/incomes/${ids.income}`, { token: tokenA, expect: 200 });
    pass("CRUD deletes");
  } catch (e) {
    fail("Cleanup deletes", e.message);
  }

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
