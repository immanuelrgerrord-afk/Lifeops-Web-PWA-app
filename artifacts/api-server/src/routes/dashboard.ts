import { Router } from "express";
import { db, incomes, expenses, loans, goals, categories } from "@workspace/db";
import { eq, and, like, sum } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth.js";

const router = Router();

function calcEMI(principal: number, annualRate: number, tenureYears: number): number {
  const n = tenureYears * 12;
  if (annualRate === 0) return Math.round((principal / n) * 100) / 100;
  const r = annualRate / 100 / 12;
  return (principal * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
}

function monthsBetween(startDate: string): number {
  const start = new Date(startDate + "T00:00:00");
  const today = new Date();
  return Math.max(0,
    (today.getFullYear() - start.getFullYear()) * 12 +
    (today.getMonth() - start.getMonth())
  );
}

// Given a start date and recurrence type, compute the next occurrence after a given date
function nextOccurrence(startDate: string, recurrenceType: string): string {
  const start = new Date(startDate + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (recurrenceType === "one-time") return startDate;

  const intervalMonths: Record<string, number> = {
    monthly: 1,
    quarterly: 3,
    "half-yearly": 6,
    yearly: 12,
  };
  const interval = intervalMonths[recurrenceType] ?? 1;

  let next = new Date(start);
  while (next <= today) {
    next.setMonth(next.getMonth() + interval);
  }
  return next.toISOString().split("T")[0];
}

router.get("/dashboard", requireAuth, async (req, res) => {
  const userId = req.userId!;
  const now = new Date();
  const month = (req.query.month as string) ||
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const [incomeSum] = await db
    .select({ total: sum(incomes.amount) })
    .from(incomes)
    .where(and(eq(incomes.userId, userId), like(incomes.date, `${month}%`)));

  const [expenseSum] = await db
    .select({ total: sum(expenses.amount) })
    .from(expenses)
    .where(and(eq(expenses.userId, userId), like(expenses.date, `${month}%`)));

  const loanRows = await db.select().from(loans).where(eq(loans.userId, userId));
  const goalRows = await db.select().from(goals).where(eq(goals.userId, userId));

  const totalIncome = Number(incomeSum?.total ?? 0);
  const totalExpenses = Number(expenseSum?.total ?? 0);

  // EMI due this month = sum of all active loans' EMIs
  const emiDueThisMonth = loanRows.reduce((s, l) => {
    const elapsed = monthsBetween(l.startDate);
    const totalMonths = l.tenureYears * 12;
    if (elapsed < totalMonths) return s + Number(l.emi);
    return s;
  }, 0);

  const totalOutstanding = loanRows.reduce((l_acc, l) => {
    const principal = Number(l.principalAmount);
    const rate = Number(l.interestRate);
    const emi = Number(l.emi);
    const elapsed = Math.min(monthsBetween(l.startDate), l.tenureYears * 12);
    if (rate === 0) return l_acc + Math.max(0, principal - emi * elapsed);
    const r = rate / 100 / 12;
    const outstanding = principal * Math.pow(1 + r, elapsed) - emi * (Math.pow(1 + r, elapsed) - 1) / r;
    return l_acc + Math.max(0, outstanding);
  }, 0);

  // Net savings = income - expenses - active EMI commitments
  const savings = totalIncome - totalExpenses - emiDueThisMonth;

  const avgGoalProgress =
    goalRows.length > 0
      ? goalRows.reduce((s, g) => {
          const t = Number(g.targetAmount);
          const c = Number(g.currentAmount);
          return s + (t > 0 ? Math.min(100, (c / t) * 100) : 0);
        }, 0) / goalRows.length
      : 0;

  // Upcoming recurring for next 30 days
  const allIncomes = await db
    .select({
      id: incomes.id,
      categoryName: categories.name,
      amount: incomes.amount,
      date: incomes.date,
      recurrenceType: incomes.recurrenceType,
      occurrences: incomes.occurrences,
    })
    .from(incomes)
    .leftJoin(categories, and(eq(incomes.categoryId, categories.id), eq(categories.userId, userId)))
    .where(and(eq(incomes.userId, userId)));

  const allExpenses = await db
    .select({
      id: expenses.id,
      categoryName: categories.name,
      amount: expenses.amount,
      date: expenses.date,
      recurrenceType: expenses.recurrenceType,
      occurrences: expenses.occurrences,
    })
    .from(expenses)
    .leftJoin(categories, and(eq(expenses.categoryId, categories.id), eq(categories.userId, userId)))
    .where(and(eq(expenses.userId, userId)));

  const upcoming30 = new Date();
  upcoming30.setDate(upcoming30.getDate() + 30);

  const upcomingRecurring: Array<{
    id: number; type: string; categoryName: string; amount: number;
    recurrenceType: string; nextDate: string;
  }> = [];

  for (const inc of allIncomes) {
    if (inc.recurrenceType === "one-time") continue;
    const next = nextOccurrence(inc.date, inc.recurrenceType);
    const nextDt = new Date(next + "T00:00:00");
    if (nextDt <= upcoming30) {
      upcomingRecurring.push({
        id: inc.id,
        type: "income",
        categoryName: inc.categoryName ?? "",
        amount: Number(inc.amount),
        recurrenceType: inc.recurrenceType,
        nextDate: next,
      });
    }
  }

  for (const exp of allExpenses) {
    if (exp.recurrenceType === "one-time") continue;
    const next = nextOccurrence(exp.date, exp.recurrenceType);
    const nextDt = new Date(next + "T00:00:00");
    if (nextDt <= upcoming30) {
      upcomingRecurring.push({
        id: exp.id,
        type: "expense",
        categoryName: exp.categoryName ?? "",
        amount: Number(exp.amount),
        recurrenceType: exp.recurrenceType,
        nextDate: next,
      });
    }
  }

  upcomingRecurring.sort((a, b) => a.nextDate.localeCompare(b.nextDate));

  const monthlyIncomeRows = await db
    .select({
      id: incomes.id,
      userId: incomes.userId,
      categoryId: incomes.categoryId,
      categoryName: categories.name,
      amount: incomes.amount,
      date: incomes.date,
      notes: incomes.notes,
      recurrenceType: incomes.recurrenceType,
      occurrences: incomes.occurrences,
      createdAt: incomes.createdAt,
      updatedAt: incomes.updatedAt,
    })
    .from(incomes)
    .leftJoin(categories, and(eq(incomes.categoryId, categories.id), eq(categories.userId, userId)))
    .where(and(eq(incomes.userId, userId), like(incomes.date, `${month}%`)))
    .orderBy(incomes.date);

  const monthlyExpenseRows = await db
    .select({
      id: expenses.id,
      userId: expenses.userId,
      categoryId: expenses.categoryId,
      categoryName: categories.name,
      amount: expenses.amount,
      date: expenses.date,
      notes: expenses.notes,
      recurrenceType: expenses.recurrenceType,
      occurrences: expenses.occurrences,
      createdAt: expenses.createdAt,
      updatedAt: expenses.updatedAt,
    })
    .from(expenses)
    .leftJoin(categories, and(eq(expenses.categoryId, categories.id), eq(categories.userId, userId)))
    .where(and(eq(expenses.userId, userId), like(expenses.date, `${month}%`)))
    .orderBy(expenses.date);

  return res.json({
    totalIncome,
    totalExpenses,
    savings,
    activeLoans: loanRows.length,
    totalOutstanding: Math.round(totalOutstanding * 100) / 100,
    emiDueThisMonth: Math.round(emiDueThisMonth * 100) / 100,
    goalsCount: goalRows.length,
    avgGoalProgress: Math.round(avgGoalProgress * 10) / 10,
    monthlyIncomes: monthlyIncomeRows.map((r) => ({
      ...r,
      amount: Number(r.amount),
      categoryName: r.categoryName ?? "",
      recurrenceType: r.recurrenceType,
      occurrences: r.occurrences,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    })),
    monthlyExpenses: monthlyExpenseRows.map((r) => ({
      ...r,
      amount: Number(r.amount),
      categoryName: r.categoryName ?? "",
      recurrenceType: r.recurrenceType,
      occurrences: r.occurrences,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    })),
    upcomingRecurring,
  });
});

export default router;
