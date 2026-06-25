import { Router } from "express";
import { db, incomes, categories } from "@workspace/db";
import { eq, and, like, or, isNotNull, isNull, ne } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth.js";
import { getOwnedCategory } from "../lib/categories.js";
import { isValidRecurrenceType, nextOccurrenceDate } from "../lib/recurrence.js";
import { syncRecurringForUser } from "../lib/recurringSync.js";
import { buildTemplateMap, resolveRecurrenceDisplay } from "../lib/transactionFormat.js";

const router = Router();

function formatIncome(
  r: {
    id: number; userId: number; categoryId: number; categoryName: string | null;
    categoryIcon: string | null; categoryColor: string | null;
    amount: string; date: string; notes: string | null;
    recurrenceType: string; occurrences: number;
    generatedOccurrences: number; nextOccurrenceDate: string | null;
    parentId: number | null;
    createdAt: Date; updatedAt: Date;
  },
  templateMap: ReturnType<typeof buildTemplateMap>,
) {
  const amount = Number(r.amount);
  const recurrence = resolveRecurrenceDisplay(r, templateMap);
  return {
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
    totalPlannedCost: recurrence.totalPlannedCost,
    isMaterializedOccurrence: recurrence.isMaterializedOccurrence,
    templateId: recurrence.templateId,
    isRecurringTemplate: r.parentId == null && r.recurrenceType !== "one-time",
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
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

async function loadIncomeTemplates(userId: number) {
  return db
    .select({
      id: incomes.id,
      amount: incomes.amount,
      recurrenceType: incomes.recurrenceType,
      occurrences: incomes.occurrences,
    })
    .from(incomes)
    .where(and(eq(incomes.userId, userId), isNull(incomes.parentId), ne(incomes.recurrenceType, "one-time")));
}

const incomeSelect = {
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
};

router.get("/incomes", requireAuth, async (req, res) => {
  await syncRecurringForUser(req.userId!);
  const userId = req.userId!;
  const { month } = req.query as { month?: string };
  const conditions = [
    eq(incomes.userId, userId),
    or(isNotNull(incomes.parentId), eq(incomes.recurrenceType, "one-time")),
  ];
  if (month) conditions.push(like(incomes.date, `${month}%`));

  const [templates, rows] = await Promise.all([
    loadIncomeTemplates(userId),
    db
      .select(incomeSelect)
      .from(incomes)
      .leftJoin(categories, and(eq(incomes.categoryId, categories.id), eq(categories.userId, userId)))
      .where(and(...conditions))
      .orderBy(incomes.date),
  ]);

  const templateMap = buildTemplateMap(templates);
  return res.json(rows.map((r) => formatIncome(r, templateMap)));
});

router.post("/incomes", requireAuth, async (req, res) => {
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

  const owned = await getOwnedCategory(userId, categoryId, "income");
  if ("error" in owned) return res.status(owned.status).json({ message: owned.error });

  const type = recurrenceType ?? "one-time";
  const count = type === "one-time" ? 1 : (occurrences ?? 1);
  const nextDate = type === "one-time" ? null : nextOccurrenceDate(date, type, count, 0);

  const now = new Date();
  const [row] = await db
    .insert(incomes)
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
  const templates = await loadIncomeTemplates(userId);
  const templateMap = buildTemplateMap(templates);
  return res.status(201).json(
    formatIncome(
      {
        ...row,
        categoryName: owned.category.name,
        categoryIcon: owned.category.icon,
        categoryColor: owned.category.color,
      },
      templateMap,
    ),
  );
});

router.put("/incomes/:id", requireAuth, async (req, res) => {
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

  const owned = await getOwnedCategory(userId, categoryId, "income");
  if ("error" in owned) return res.status(owned.status).json({ message: owned.error });

  const [existing] = await db
    .select()
    .from(incomes)
    .where(and(eq(incomes.id, id), eq(incomes.userId, userId)));

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
    .update(incomes)
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
    .where(and(eq(incomes.id, id), eq(incomes.userId, userId)))
    .returning();

  if (!row) return res.status(404).json({ message: "Not found" });
  await syncRecurringForUser(userId);
  const templates = await loadIncomeTemplates(userId);
  const templateMap = buildTemplateMap(templates);
  return res.json(
    formatIncome(
      {
        ...row,
        categoryName: owned.category.name,
        categoryIcon: owned.category.icon,
        categoryColor: owned.category.color,
      },
      templateMap,
    ),
  );
});

router.delete("/incomes/:id", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  await db.delete(incomes).where(and(eq(incomes.parentId, id), eq(incomes.userId, req.userId!)));
  const [row] = await db
    .delete(incomes)
    .where(and(eq(incomes.id, id), eq(incomes.userId, req.userId!)))
    .returning({ id: incomes.id });
  if (!row) return res.status(404).json({ message: "Not found" });
  return res.json({ message: "Deleted" });
});

export default router;
