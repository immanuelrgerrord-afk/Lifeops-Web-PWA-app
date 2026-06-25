import { Router } from "express";
import { db, incomes, expenses, loans, goals, categories } from "@workspace/db";
import { eq, and, like, sum, ne, isNull, or, isNotNull } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth.js";
import { upcomingOccurrences, occurrenceDate, recurrenceLabel, totalPlannedCost } from "../lib/recurrence.js";
import { syncRecurringForUser } from "../lib/recurringSync.js";
import { buildTemplateMap, resolveRecurrenceDisplay } from "../lib/transactionFormat.js";
import {
  buildLoanDashboardSummary,
  buildMonthlyFixedCommitments,
  calculateMonthlySavings,
} from "../lib/dashboardFinancials.js";

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

  const loanRows = await db.select().from(loans).where(eq(loans.userId, userId));
  const goalRows = await db.select().from(goals).where(eq(goals.userId, userId));

  const totalIncome = Number(incomeSum?.total ?? 0);

  const [incomeTemplatesForMap, expenseTemplatesForMap, monthlyIncomeRows, monthlyExpenseRows] =
    await Promise.all([
      db
        .select({
          id: incomes.id,
          amount: incomes.amount,
          date: incomes.date,
          recurrenceType: incomes.recurrenceType,
          occurrences: incomes.occurrences,
        })
        .from(incomes)
        .where(and(eq(incomes.userId, userId), isNull(incomes.parentId), ne(incomes.recurrenceType, "one-time"))),
      db
        .select({
          id: expenses.id,
          amount: expenses.amount,
          date: expenses.date,
          recurrenceType: expenses.recurrenceType,
          occurrences: expenses.occurrences,
        })
        .from(expenses)
        .where(and(eq(expenses.userId, userId), isNull(expenses.parentId), ne(expenses.recurrenceType, "one-time"))),
      db
        .select({
          id: incomes.id,
          userId: incomes.userId,
          categoryId: incomes.categoryId,
          categoryName: categories.name,
          categoryIcon: categories.icon,
          categoryColor: categories.color,
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
        .where(
          and(
            eq(incomes.userId, userId),
            like(incomes.date, `${month}%`),
            or(isNotNull(incomes.parentId), eq(incomes.recurrenceType, "one-time")),
          ),
        )
        .orderBy(incomes.date),
      db
        .select({
          id: expenses.id,
          userId: expenses.userId,
          categoryId: expenses.categoryId,
          categoryName: categories.name,
          categoryIcon: categories.icon,
          categoryColor: categories.color,
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
        .where(
          and(
            eq(expenses.userId, userId),
            like(expenses.date, `${month}%`),
            or(isNotNull(expenses.parentId), eq(expenses.recurrenceType, "one-time")),
          ),
        )
        .orderBy(expenses.date),
    ]);

  const savingsBreakdown = calculateMonthlySavings(
    totalIncome,
    monthlyExpenseRows.map((r) => ({
      amount: r.amount,
      categoryName: r.categoryName,
      notes: r.notes,
    })),
    loanRows,
    month,
    now,
  );

  const loanSummary = buildLoanDashboardSummary(loanRows, month, now);

  const recurringExpenseTemplates = await db
    .select({
      id: expenses.id,
      categoryName: categories.name,
      categoryIcon: categories.icon,
      categoryColor: categories.color,
      amount: expenses.amount,
      recurrenceType: expenses.recurrenceType,
      notes: expenses.notes,
    })
    .from(expenses)
    .leftJoin(categories, and(eq(expenses.categoryId, categories.id), eq(categories.userId, userId)))
    .where(and(eq(expenses.userId, userId), isNull(expenses.parentId), ne(expenses.recurrenceType, "one-time")));

  const monthlyFixedCommitments = buildMonthlyFixedCommitments(
    loanRows,
    recurringExpenseTemplates,
    month,
    now,
  );

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
      categoryIcon: categories.icon,
      categoryColor: categories.color,
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
      categoryIcon: categories.icon,
      categoryColor: categories.color,
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

  type UpcomingItem = {
    id: number;
    categoryName: string;
    categoryIcon?: string;
    categoryColor?: string;
    amount: number;
    recurrenceType: string;
    occurrences: number;
    recurrenceLabel: string;
    totalPlannedCost: number;
    startDate: string;
    endDate: string;
    nextDate: string;
  };

  const upcomingRecurringIncome: UpcomingItem[] = [];
  const upcomingRecurringExpenses: UpcomingItem[] = [];

  const pushUpcoming = (
    target: UpcomingItem[],
    row: (typeof incomeTemplates)[number],
    nextDate: string,
  ) => {
    const displayName =
      row.categoryName === "Other" && row.notes?.trim() ? row.notes.trim() : (row.categoryName ?? "");
    const amount = Number(row.amount);
    const endDate = occurrenceDate(row.date, row.recurrenceType, row.occurrences - 1);
    target.push({
      id: row.id,
      categoryName: displayName,
      categoryIcon: row.categoryIcon ?? undefined,
      categoryColor: row.categoryColor ?? undefined,
      amount,
      recurrenceType: row.recurrenceType,
      occurrences: row.occurrences,
      recurrenceLabel: recurrenceLabel(row.recurrenceType),
      totalPlannedCost: totalPlannedCost(amount, row.recurrenceType, row.occurrences),
      startDate: row.date,
      endDate,
      nextDate,
    });
  };

  for (const inc of incomeTemplates) {
    const upcoming = upcomingOccurrences(
      inc.date,
      inc.recurrenceType,
      inc.occurrences,
      inc.generatedOccurrences,
    );
    for (const u of upcoming) {
      pushUpcoming(upcomingRecurringIncome, inc, u.date);
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
      pushUpcoming(upcomingRecurringExpenses, exp, u.date);
    }
  }

  upcomingRecurringIncome.sort((a, b) => a.nextDate.localeCompare(b.nextDate));
  upcomingRecurringExpenses.sort((a, b) => a.nextDate.localeCompare(b.nextDate));

  const upcomingRecurring = [
    ...upcomingRecurringIncome.map((i) => ({ ...i, type: "income" as const })),
    ...upcomingRecurringExpenses.map((e) => ({ ...e, type: "expense" as const })),
  ].sort((a, b) => a.nextDate.localeCompare(b.nextDate));

  const incomeTemplateMap = buildTemplateMap(incomeTemplatesForMap);
  const expenseTemplateMap = buildTemplateMap(expenseTemplatesForMap);

  const mapIncome = (r: (typeof monthlyIncomeRows)[number]) => {
    const recurrence = resolveRecurrenceDisplay(r, incomeTemplateMap);
    return {
      id: r.id,
      userId: r.userId,
      categoryId: r.categoryId,
      categoryName: r.categoryName ?? "",
      categoryIcon: r.categoryIcon ?? undefined,
      categoryColor: r.categoryColor ?? undefined,
      amount: Number(r.amount),
      date: r.date,
      notes: r.notes ?? undefined,
      recurrenceType: recurrence.recurrenceType,
      occurrences: recurrence.occurrences,
      occurrenceCount: recurrence.occurrenceCount,
      perOccurrenceAmount: recurrence.perOccurrenceAmount,
      generatedOccurrences: r.generatedOccurrences,
      nextOccurrenceDate: r.nextOccurrenceDate,
      parentId: r.parentId,
      recurrenceLabel: recurrence.recurrenceLabel,
      recurrenceStartDate: recurrence.recurrenceStartDate,
      recurrenceEndDate: recurrence.recurrenceEndDate,
      totalPlannedCost: recurrence.totalPlannedCost,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    };
  };

  const mapExpense = (r: (typeof monthlyExpenseRows)[number]) => {
    const recurrence = resolveRecurrenceDisplay(r, expenseTemplateMap);
    return {
      id: r.id,
      userId: r.userId,
      categoryId: r.categoryId,
      categoryName: r.categoryName ?? "",
      categoryIcon: r.categoryIcon ?? undefined,
      categoryColor: r.categoryColor ?? undefined,
      amount: Number(r.amount),
      date: r.date,
      notes: r.notes ?? undefined,
      recurrenceType: recurrence.recurrenceType,
      occurrences: recurrence.occurrences,
      occurrenceCount: recurrence.occurrenceCount,
      perOccurrenceAmount: recurrence.perOccurrenceAmount,
      generatedOccurrences: r.generatedOccurrences,
      nextOccurrenceDate: r.nextOccurrenceDate,
      parentId: r.parentId,
      recurrenceLabel: recurrence.recurrenceLabel,
      recurrenceStartDate: recurrence.recurrenceStartDate,
      recurrenceEndDate: recurrence.recurrenceEndDate,
      totalPlannedCost: recurrence.totalPlannedCost,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    };
  };

  const monthlyIncomes = monthlyIncomeRows.map(mapIncome);
  const monthlyExpenses = monthlyExpenseRows.map(mapExpense);

  type CategoryAgg = {
    categoryId: number;
    categoryName: string;
    categoryIcon?: string;
    categoryColor?: string;
    total: number;
  };

  const aggregateByCategory = (
    rows: Array<{
      categoryId: number;
      categoryName: string;
      categoryIcon?: string;
      categoryColor?: string;
      amount: number;
    }>,
    excludeEmi = false,
  ): CategoryAgg[] => {
    const map = new Map<number, CategoryAgg>();
    for (const row of rows) {
      if (excludeEmi && row.categoryName === "EMI") continue;
      const existing = map.get(row.categoryId);
      if (existing) {
        existing.total += row.amount;
      } else {
        map.set(row.categoryId, {
          categoryId: row.categoryId,
          categoryName: row.categoryName,
          categoryIcon: row.categoryIcon,
          categoryColor: row.categoryColor,
          total: row.amount,
        });
      }
    }
    return [...map.values()].sort((a, b) => b.total - a.total);
  };

  const topSpendingCategories = aggregateByCategory(monthlyExpenses, true).slice(0, 8);
  const topIncomeCategories = aggregateByCategory(monthlyIncomes).slice(0, 8);

  return res.json({
    totalIncome: savingsBreakdown.totalIncome,
    totalExpenses: savingsBreakdown.totalExpenses,
    savings: savingsBreakdown.savings,
    activeLoans: loanSummary.activeLoans,
    totalOutstanding: loanSummary.totalOutstanding,
    totalRemainingInterest: loanSummary.totalRemainingInterest,
    avgLoanCompletion: loanSummary.avgLoanCompletion,
    emiDueThisMonth: savingsBreakdown.emiDueThisMonth,
    goalsCount: goalRows.length,
    avgGoalProgress: Math.round(avgGoalProgress * 10) / 10,
    loanSummary,
    monthlyFixedCommitments,
    monthlyIncomes,
    monthlyExpenses,
    topSpendingCategories,
    topIncomeCategories,
    upcomingRecurring,
    upcomingRecurringIncome,
    upcomingRecurringExpenses,
  });
});

export default router;
