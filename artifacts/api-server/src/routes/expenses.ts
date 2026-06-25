import { Router } from "express";
import { db, expenses, categories } from "@workspace/db";
import { eq, and, like } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth.js";
import { getOwnedCategory } from "../lib/categories.js";

const router = Router();

function formatExpense(r: {
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

router.get("/expenses", requireAuth, async (req, res) => {
  const { month } = req.query as { month?: string };
  const conditions = [eq(expenses.userId, req.userId!)];
  if (month) conditions.push(like(expenses.date, `${month}%`));
  const rows = await db
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
    .leftJoin(categories, and(eq(expenses.categoryId, categories.id), eq(categories.userId, req.userId!)))
    .where(and(...conditions))
    .orderBy(expenses.date);

  return res.json(rows.map(formatExpense));
});

router.post("/expenses", requireAuth, async (req, res) => {
  const { categoryId, amount, date, notes, recurrenceType, occurrences } = req.body as {
    categoryId?: number; amount?: number; date?: string; notes?: string;
    recurrenceType?: string; occurrences?: number;
  };
  if (!categoryId) return res.status(400).json({ message: "Category is required." });
  if (!amount || amount <= 0) return res.status(400).json({ message: "Amount must be greater than 0." });
  if (!date) return res.status(400).json({ message: "Date is required." });

  const owned = await getOwnedCategory(req.userId!, categoryId, "expense");
  if ("error" in owned) return res.status(owned.status).json({ message: owned.error });

  const now = new Date();
  const [row] = await db
    .insert(expenses)
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

  return res.status(201).json(formatExpense({ ...row, categoryName: owned.category.name }));
});

router.put("/expenses/:id", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const { categoryId, amount, date, notes, recurrenceType, occurrences } = req.body as {
    categoryId?: number; amount?: number; date?: string; notes?: string;
    recurrenceType?: string; occurrences?: number;
  };
  if (!categoryId) return res.status(400).json({ message: "Category is required." });
  if (!amount || amount <= 0) return res.status(400).json({ message: "Amount must be greater than 0." });
  if (!date) return res.status(400).json({ message: "Date is required." });

  const owned = await getOwnedCategory(req.userId!, categoryId, "expense");
  if ("error" in owned) return res.status(owned.status).json({ message: owned.error });

  const now = new Date();
  const [row] = await db
    .update(expenses)
    .set({
      categoryId,
      amount: String(amount),
      date,
      notes: notes ?? null,
      recurrenceType: recurrenceType ?? "one-time",
      occurrences: occurrences ?? 1,
      updatedAt: now,
    })
    .where(and(eq(expenses.id, id), eq(expenses.userId, req.userId!)))
    .returning();

  if (!row) return res.status(404).json({ message: "Not found" });
  return res.json(formatExpense({ ...row, categoryName: owned.category.name }));
});

router.delete("/expenses/:id", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  await db.delete(expenses).where(and(eq(expenses.id, id), eq(expenses.userId, req.userId!)));
  return res.json({ message: "Deleted" });
});

export default router;
