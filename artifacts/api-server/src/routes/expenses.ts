import { Router } from "express";
import { db, expenses, categories, loans } from "@workspace/db";
import { eq, and, like, or, isNotNull, isNull, ne } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth.js";
import { getOwnedCategory } from "../lib/categories.js";
import { isValidRecurrenceType, nextOccurrenceDate } from "../lib/recurrence.js";
import { syncRecurringForUser } from "../lib/recurringSync.js";
import { formatLoanMetrics } from "../lib/loanCalculations.js";
import { findMatchingLoan } from "../lib/emiMatching.js";
import { buildTemplateMap, resolveRecurrenceDisplay } from "../lib/transactionFormat.js";

const router = Router();

function buildEmiDetails(
  amount: number,
  loan: (typeof loans.$inferSelect) | null,
  notes?: string | null,
) {
  if (loan) {
    const metrics = formatLoanMetrics(loan);
    return {
      matched: true,
      loanName: loan.name,
      emiAmount: Number(loan.emi),
      emiStartDate: loan.startDate,
      emiDurationMonths: metrics.totalMonths,
      monthsCompleted: metrics.monthsCompleted,
      monthsRemaining: metrics.monthsRemaining,
      totalPaid: Math.round((metrics.principalPaid + metrics.interestPaid) * 100) / 100,
      remainingAmount: metrics.outstandingBalance,
      nextEmiDate: metrics.nextEmiDate,
      completionPercentage: metrics.completionPercentage,
    };
  }

  return {
    matched: false,
    loanName: notes?.trim() || undefined,
    emiAmount: amount,
    unmatchedMessage: "Linked loan not found.",
  };
}

function formatExpense(
  r: {
    id: number; userId: number; categoryId: number; categoryName: string | null;
    categoryIcon: string | null; categoryColor: string | null;
    amount: string; date: string; notes: string | null;
    recurrenceType: string; occurrences: number;
    generatedOccurrences: number; nextOccurrenceDate: string | null;
    parentId: number | null;
    createdAt: Date; updatedAt: Date;
  },
  loanRows: (typeof loans.$inferSelect)[],
  templateMap: ReturnType<typeof buildTemplateMap>,
) {
  const amount = Number(r.amount);
  const recurrence = resolveRecurrenceDisplay(r, templateMap);
  const base = {
    id: r.id,
    userId: r.userId,
    categoryId: r.categoryId,
    categoryName: r.categoryName ?? "",
    categoryIcon: r.categoryIcon ?? undefined,
    categoryColor: r.categoryColor ?? undefined,
    amount,
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
    isMaterializedOccurrence: recurrence.isMaterializedOccurrence,
    templateId: recurrence.templateId,
    isRecurringTemplate: r.parentId == null && r.recurrenceType !== "one-time",
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };

  if (r.categoryName === "EMI") {
    const loan = findMatchingLoan(loanRows, amount, r.notes);
    return { ...base, emiDetails: buildEmiDetails(amount, loan, r.notes) };
  }

  return base;
}

function validateRecurrence(recurrenceType?: string, occurrences?: number): string | null {
  if (recurrenceType && !isValidRecurrenceType(recurrenceType)) {
    return "Invalid recurrence type.";
  }
  if (occurrences !== undefined && (!Number.isInteger(occurrences) || occurrences < 1)) {
    return "Occurrence count must be at least 1.";
  }
  if (occurrences !== undefined && occurrences > 9999) {
    return "Occurrence count cannot exceed 9,999.";
  }
  return null;
}

async function loadExpenseTemplates(userId: number) {
  return db
    .select({
      id: expenses.id,
      amount: expenses.amount,
      date: expenses.date,
      recurrenceType: expenses.recurrenceType,
      occurrences: expenses.occurrences,
    })
    .from(expenses)
    .where(and(eq(expenses.userId, userId), isNull(expenses.parentId), ne(expenses.recurrenceType, "one-time")));
}

const expenseSelect = {
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
};

router.get("/expenses", requireAuth, async (req, res) => {
  await syncRecurringForUser(req.userId!);
  const userId = req.userId!;
  const { month } = req.query as { month?: string };
  const conditions = [
    eq(expenses.userId, userId),
    or(isNotNull(expenses.parentId), eq(expenses.recurrenceType, "one-time")),
  ];
  if (month) conditions.push(like(expenses.date, `${month}%`));

  const [loanRows, templates, rows] = await Promise.all([
    db.select().from(loans).where(eq(loans.userId, userId)),
    loadExpenseTemplates(userId),
    db
      .select(expenseSelect)
      .from(expenses)
      .leftJoin(categories, and(eq(expenses.categoryId, categories.id), eq(categories.userId, userId)))
      .where(and(...conditions))
      .orderBy(expenses.date),
  ]);

  const templateMap = buildTemplateMap(templates);
  return res.json(rows.map((r) => formatExpense(r, loanRows, templateMap)));
});

router.post("/expenses", requireAuth, async (req, res) => {
  const userId = req.userId!;
  const { categoryId, amount, date, notes, recurrenceType, occurrences } = req.body as {
    categoryId?: number; amount?: number; date?: string; notes?: string;
    recurrenceType?: string; occurrences?: number;
  };
  if (!categoryId) return res.status(400).json({ message: "Category is required." });
  if (!amount || amount <= 0) return res.status(400).json({ message: "Amount must be greater than 0." });
  if (!date) return res.status(400).json({ message: "Date is required." });

  const recErr = validateRecurrence(recurrenceType, occurrences);
  if (recErr) return res.status(400).json({ message: recErr });

  const owned = await getOwnedCategory(userId, categoryId, "expense");
  if ("error" in owned) return res.status(owned.status).json({ message: owned.error });

  const type = recurrenceType ?? "one-time";
  const count = type === "one-time" ? 1 : (occurrences ?? 1);
  const nextDate = type === "one-time" ? null : nextOccurrenceDate(date, type, count, 0);

  const now = new Date();
  const [row] = await db
    .insert(expenses)
    .values({
      userId,
      categoryId,
      amount: String(amount),
      date,
      notes: notes ?? null,
      recurrenceType: type,
      occurrences: count,
      generatedOccurrences: 0,
      nextOccurrenceDate: nextDate,
      updatedAt: now,
    })
    .returning();

  await syncRecurringForUser(userId);
  const [loanRows, templates] = await Promise.all([
    db.select().from(loans).where(eq(loans.userId, userId)),
    loadExpenseTemplates(userId),
  ]);
  const templateMap = buildTemplateMap(templates);
  return res.status(201).json(
    formatExpense(
      {
        ...row,
        categoryName: owned.category.name,
        categoryIcon: owned.category.icon,
        categoryColor: owned.category.color,
      },
      loanRows,
      templateMap,
    ),
  );
});

router.put("/expenses/:id", requireAuth, async (req, res) => {
  const userId = req.userId!;
  const id = Number(req.params.id);
  const { categoryId, amount, date, notes, recurrenceType, occurrences } = req.body as {
    categoryId?: number; amount?: number; date?: string; notes?: string;
    recurrenceType?: string; occurrences?: number;
  };
  if (!categoryId) return res.status(400).json({ message: "Category is required." });
  if (!amount || amount <= 0) return res.status(400).json({ message: "Amount must be greater than 0." });
  if (!date) return res.status(400).json({ message: "Date is required." });

  const recErr = validateRecurrence(recurrenceType, occurrences);
  if (recErr) return res.status(400).json({ message: recErr });

  const owned = await getOwnedCategory(userId, categoryId, "expense");
  if ("error" in owned) return res.status(owned.status).json({ message: owned.error });

  const [existing] = await db
    .select()
    .from(expenses)
    .where(and(eq(expenses.id, id), eq(expenses.userId, userId)));

  if (!existing) return res.status(404).json({ message: "Not found" });

  const type = recurrenceType ?? "one-time";
  const count = type === "one-time" ? 1 : (occurrences ?? 1);
  const recurrenceUnchanged =
    existing.recurrenceType === type && existing.occurrences === count;
  const nextDate =
    type === "one-time"
      ? null
      : recurrenceUnchanged && existing.nextOccurrenceDate
        ? existing.nextOccurrenceDate
        : nextOccurrenceDate(date, type, count, existing.generatedOccurrences);

  const now = new Date();
  const [row] = await db
    .update(expenses)
    .set({
      categoryId,
      amount: String(amount),
      date,
      notes: notes ?? null,
      recurrenceType: type,
      occurrences: count,
      generatedOccurrences: recurrenceUnchanged ? existing.generatedOccurrences : 0,
      nextOccurrenceDate: nextDate,
      updatedAt: now,
    })
    .where(and(eq(expenses.id, id), eq(expenses.userId, userId)))
    .returning();

  if (!row) return res.status(404).json({ message: "Not found" });
  await syncRecurringForUser(userId);
  const [loanRows, templates] = await Promise.all([
    db.select().from(loans).where(eq(loans.userId, userId)),
    loadExpenseTemplates(userId),
  ]);
  const templateMap = buildTemplateMap(templates);
  return res.json(
    formatExpense(
      {
        ...row,
        categoryName: owned.category.name,
        categoryIcon: owned.category.icon,
        categoryColor: owned.category.color,
      },
      loanRows,
      templateMap,
    ),
  );
});

router.delete("/expenses/:id", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  await db.delete(expenses).where(and(eq(expenses.parentId, id), eq(expenses.userId, req.userId!)));
  const [row] = await db
    .delete(expenses)
    .where(and(eq(expenses.id, id), eq(expenses.userId, req.userId!)))
    .returning({ id: expenses.id });
  if (!row) return res.status(404).json({ message: "Not found" });
  return res.json({ message: "Deleted" });
});

export default router;
