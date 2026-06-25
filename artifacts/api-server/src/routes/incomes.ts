import { Router } from "express";
import { db, incomes, categories } from "@workspace/db";
import { eq, and, like } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth.js";
import { getOwnedCategory } from "../lib/categories.js";

const router = Router();

function formatIncome(r: {
  id: number; userId: number; categoryId: number; categoryName: string | null;
  amount: string; date: string; notes: string | null;
  recurrenceType: string; occurrences: number;
  createdAt: Date; updatedAt: Date;
}) {
  return {
    id: r.id,
    userId: r.userId,
    categoryId: r.categoryId,
    categoryName: r.categoryName ?? "",
    amount: Number(r.amount),
    date: r.date,
    notes: r.notes ?? undefined,
    recurrenceType: r.recurrenceType,
    occurrences: r.occurrences,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

router.get("/incomes", requireAuth, async (req, res) => {
  const { month } = req.query as { month?: string };
  const conditions = [eq(incomes.userId, req.userId!)];
  if (month) conditions.push(like(incomes.date, `${month}%`));
  const rows = await db
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
    .leftJoin(categories, and(eq(incomes.categoryId, categories.id), eq(categories.userId, req.userId!)))
    .where(and(...conditions))
    .orderBy(incomes.date);

  return res.json(rows.map(formatIncome));
});

router.post("/incomes", requireAuth, async (req, res) => {
  const { categoryId, amount, date, notes, recurrenceType, occurrences } = req.body as {
    categoryId?: number; amount?: number; date?: string; notes?: string;
    recurrenceType?: string; occurrences?: number;
  };
  if (!categoryId) return res.status(400).json({ message: "Category is required." });
  if (!amount || amount <= 0) return res.status(400).json({ message: "Amount must be greater than 0." });
  if (!date) return res.status(400).json({ message: "Date is required." });

  const owned = await getOwnedCategory(req.userId!, categoryId, "income");
  if ("error" in owned) return res.status(owned.status).json({ message: owned.error });

  const now = new Date();
  const [row] = await db
    .insert(incomes)
    .values({
      userId: req.userId!,
      categoryId,
      amount: String(amount),
      date,
      notes: notes ?? null,
      recurrenceType: recurrenceType ?? "one-time",
      occurrences: occurrences ?? 1,
      updatedAt: now,
    })
    .returning();

  return res.status(201).json(formatIncome({ ...row, categoryName: owned.category.name }));
});

router.put("/incomes/:id", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const { categoryId, amount, date, notes, recurrenceType, occurrences } = req.body as {
    categoryId?: number; amount?: number; date?: string; notes?: string;
    recurrenceType?: string; occurrences?: number;
  };
  if (!categoryId) return res.status(400).json({ message: "Category is required." });
  if (!amount || amount <= 0) return res.status(400).json({ message: "Amount must be greater than 0." });
  if (!date) return res.status(400).json({ message: "Date is required." });

  const owned = await getOwnedCategory(req.userId!, categoryId, "income");
  if ("error" in owned) return res.status(owned.status).json({ message: owned.error });

  const now = new Date();
  const [row] = await db
    .update(incomes)
    .set({
      categoryId,
      amount: String(amount),
      date,
      notes: notes ?? null,
      recurrenceType: recurrenceType ?? "one-time",
      occurrences: occurrences ?? 1,
      updatedAt: now,
    })
    .where(and(eq(incomes.id, id), eq(incomes.userId, req.userId!)))
    .returning();

  if (!row) return res.status(404).json({ message: "Not found" });
  return res.json(formatIncome({ ...row, categoryName: owned.category.name }));
});

router.delete("/incomes/:id", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  await db.delete(incomes).where(and(eq(incomes.id, id), eq(incomes.userId, req.userId!)));
  return res.json({ message: "Deleted" });
});

export default router;
