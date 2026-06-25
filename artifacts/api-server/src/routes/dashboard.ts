import { Router } from "express";
import { db, incomes, expenses, loans, goals, categories } from "@workspace/db";
import { eq, and, like, sum, ne, isNull, or, isNotNull } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth.js";
import { emiAmountForMonth, formatLoanMetrics } from "../lib/loanCalculations.js";
import { upcomingOccurrences, recurrenceLabel } from "../lib/recurrence.js";
import { syncRecurringForUser } from "../lib/recurringSync.js";

const router = Router();

router.get("/dashboard", requireAuth, async (req, res) => {
  const userId = req.userId!;
  const now = new Date();
  const month =
    (req.query.month as string) ||
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  await syncRecurringForUser(userId);

  const [incomeSum] = await db
    .select({ total: sum(incomes.amount) })
    .from(incomes)
    .where(
      and(
        eq(incomes.userId, userId),
        like(incomes.date, `${month}%`),
        or(isNotNull(incomes.parentId), eq(incomes.recurrenceType, "one-time")),
      ),
    );

  const [expenseSumRegular] = await db
    .select({ total: sum(expenses.amount) })
    .from(expenses)
    .leftJoin(categories, and(eq(expenses.categoryId, categories.id), eq(categories.userId, userId)))
    .where(
      and(
        eq(expenses.userId, userId),
        like(expenses.date, `${month}%`),
        or(isNotNull(expenses.parentId), eq(expenses.recurrenceType, "one-time")),
        or(ne(categories.name, "EMI"), isNull(categories.name)),
      ),
    );

  const loanRows = await db.select().from(loans).where(eq(loans.userId, userId));
  const goalRows = await db.select().from(goals).where(eq(goals.userId, userId));

  const totalIncome = Number(incomeSum?.total ?? 0);
  const totalExpenses = Number(expenseSumRegular?.total ?? 0);

  const emiDueThisMonth = loanRows.reduce(
    (s, l) => s + emiAmountForMonth(l, month, now),
    0,
  );

  const totalOutstanding = loanRows.reduce((acc, l) => {
    const metrics = formatLoanMetrics(l);
    if (metrics.isCompleted) return acc;
    return acc + metrics.outstandingBalance;
  }, 0);

  const activeLoans = loanRows.filter((l) => !formatLoanMetrics(l).isCompleted).length;

  const savings = totalIncome - totalExpenses - emiDueThisMonth;

  const avgGoalProgress =
    goalRows.length > 0
      ? goalRows.reduce((s, g) => {
          const t = Number(g.targetAmount);
          const c = Number(g.currentAmount);
          return s + (t > 0 ? Math.min(100, (c / t) * 100) : 0);
        }, 0) / goalRows.length
      : 0;

  const incomeTemplates = await db
    .select({
      id: incomes.id,
      categoryName: categories.name,
      amount: incomes.amount,
      date: incomes.date,
      recurrenceType: incomes.recurrenceType,
      occurrences: incomes.occurrences,
      generatedOccurrences: incomes.generatedOccurrences,
      notes: incomes.notes,
    })
    .from(incomes)
    .leftJoin(categories, and(eq(incomes.categoryId, categories.id), eq(categories.userId, userId)))
    .where(and(eq(incomes.userId, userId), isNull(incomes.parentId), ne(incomes.recurrenceType, "one-time")));

  const expenseTemplates = await db
    .select({
      id: expenses.id,
      categoryName: categories.name,
      amount: expenses.amount,
      date: expenses.date,
      recurrenceType: expenses.recurrenceType,
      occurrences: expenses.occurrences,
      generatedOccurrences: expenses.generatedOccurrences,
      notes: expenses.notes,
    })
    .from(expenses)
    .leftJoin(categories, and(eq(expenses.categoryId, categories.id), eq(categories.userId, userId)))
    .where(and(eq(expenses.userId, userId), isNull(expenses.parentId), ne(expenses.recurrenceType, "one-time")));

  const upcomingRecurringIncome: Array<{
    id: number; categoryName: string; amount: number; recurrenceType: string; nextDate: string;
  }> = [];

  const upcomingRecurringExpenses: Array<{
    id: number; categoryName: string; amount: number; recurrenceType: string; nextDate: string;
  }> = [];

  for (const inc of incomeTemplates) {
    const upcoming = upcomingOccurrences(
      inc.date,
      inc.recurrenceType,
      inc.occurrences,
      inc.generatedOccurrences,
    );
    for (const u of upcoming) {
      const displayName =
        inc.categoryName === "Other" && inc.notes?.trim() ? inc.notes.trim() : (inc.categoryName ?? "");
      upcomingRecurringIncome.push({
        id: inc.id,
        categoryName: displayName,
        amount: Number(inc.amount),
        recurrenceType: inc.recurrenceType,
        nextDate: u.date,
      });
    }
  }

  for (const exp of expenseTemplates) {
    const upcoming = upcomingOccurrences(
      exp.date,
      exp.recurrenceType,
      exp.occurrences,
      exp.generatedOccurrences,
    );
    for (const u of upcoming) {
      const displayName =
        exp.categoryName === "Other" && exp.notes?.trim() ? exp.notes.trim() : (exp.categoryName ?? "");
      upcomingRecurringExpenses.push({
        id: exp.id,
        categoryName: displayName,
        amount: Number(exp.amount),
        recurrenceType: exp.recurrenceType,
        nextDate: u.date,
      });
    }
  }

  upcomingRecurringIncome.sort((a, b) => a.nextDate.localeCompare(b.nextDate));
  upcomingRecurringExpenses.sort((a, b) => a.nextDate.localeCompare(b.nextDate));

  const upcomingRecurring = [
    ...upcomingRecurringIncome.map((i) => ({ ...i, type: "income" as const })),
    ...upcomingRecurringExpenses.map((e) => ({ ...e, type: "expense" as const })),
  ].sort((a, b) => a.nextDate.localeCompare(b.nextDate));

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
      generatedOccurrences: incomes.generatedOccurrences,
      nextOccurrenceDate: incomes.nextOccurrenceDate,
      parentId: incomes.parentId,
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
      generatedOccurrences: expenses.generatedOccurrences,
      nextOccurrenceDate: expenses.nextOccurrenceDate,
      parentId: expenses.parentId,
      createdAt: expenses.createdAt,
      updatedAt: expenses.updatedAt,
    })
    .from(expenses)
    .leftJoin(categories, and(eq(expenses.categoryId, categories.id), eq(categories.userId, userId)))
    .where(and(eq(expenses.userId, userId), like(expenses.date, `${month}%`)))
    .orderBy(expenses.date);

  const mapTx = (r: {
    id: number; userId: number; categoryId: number; categoryName: string | null;
    amount: string; date: string; notes: string | null; recurrenceType: string;
    occurrences: number; generatedOccurrences: number; nextOccurrenceDate: string | null;
    parentId: number | null; createdAt: Date; updatedAt: Date;
  }) => ({
    ...r,
    amount: Number(r.amount),
    categoryName: r.categoryName ?? "",
    notes: r.notes ?? undefined,
    recurrenceLabel: recurrenceLabel(r.recurrenceType),
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  });

  return res.json({
    totalIncome,
    totalExpenses,
    savings: Math.round(savings * 100) / 100,
    activeLoans,
    totalOutstanding: Math.round(totalOutstanding * 100) / 100,
    emiDueThisMonth: Math.round(emiDueThisMonth * 100) / 100,
    goalsCount: goalRows.length,
    avgGoalProgress: Math.round(avgGoalProgress * 10) / 10,
    monthlyIncomes: monthlyIncomeRows.map(mapTx),
    monthlyExpenses: monthlyExpenseRows.map(mapTx),
    upcomingRecurring,
    upcomingRecurringIncome,
    upcomingRecurringExpenses,
  });
});

export default router;
