import { Router } from "express";
import { db, categories, incomes, expenses } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth.js";

const router = Router();

router.get("/categories", requireAuth, async (req, res) => {
  const { type } = req.query as { type?: string };
  const conditions = [eq(categories.userId, req.userId!)];
  if (type) conditions.push(eq(categories.type, type));
  const rows = await db
    .select()
    .from(categories)
    .where(and(...conditions))
    .orderBy(categories.name);
  return res.json(
    rows.map((r) => ({
      id: r.id,
      userId: r.userId,
      name: r.name,
      type: r.type,
      isDefault: r.isDefault,
      icon: r.icon ?? null,
      color: r.color ?? null,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    })),
  );
});

router.post("/categories", requireAuth, async (req, res) => {
  const { name, type, icon, color } = req.body as {
    name?: string; type?: string; icon?: string; color?: string;
  };
  if (!name?.trim() || !type) return res.status(400).json({ message: "name and type are required" });

  const trimmed = name.trim();
  const [existing] = await db
    .select({ id: categories.id })
    .from(categories)
    .where(
      and(
        eq(categories.userId, req.userId!),
        eq(categories.type, type),
        sql`lower(${categories.name}) = lower(${trimmed})`,
      ),
    )
    .limit(1);

  if (existing) {
    return res.status(409).json({ message: `A ${type} category named "${trimmed}" already exists.` });
  }

  const now = new Date();
  const [row] = await db
    .insert(categories)
    .values({
      userId: req.userId!,
      name: trimmed,
      type,
      isDefault: false,
      icon: icon ?? null,
      color: color ?? null,
      updatedAt: now,
    })
    .returning();

  return res.status(201).json({
    id: row.id,
    userId: row.userId,
    name: row.name,
    type: row.type,
    isDefault: row.isDefault,
    icon: row.icon ?? null,
    color: row.color ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  });
});

router.put("/categories/:id", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const { name, icon, color } = req.body as { name?: string; icon?: string; color?: string };
  if (!name?.trim()) return res.status(400).json({ message: "name is required" });

  const [current] = await db
    .select()
    .from(categories)
    .where(and(eq(categories.id, id), eq(categories.userId, req.userId!)))
    .limit(1);

  if (!current) return res.status(404).json({ message: "Category not found" });

  const trimmed = name.trim();
  const [duplicate] = await db
    .select({ id: categories.id })
    .from(categories)
    .where(
      and(
        eq(categories.userId, req.userId!),
        eq(categories.type, current.type),
        sql`lower(${categories.name}) = lower(${trimmed})`,
        sql`${categories.id} != ${id}`,
      ),
    )
    .limit(1);

  if (duplicate) {
    return res.status(409).json({ message: `A ${current.type} category named "${trimmed}" already exists.` });
  }

  const now = new Date();
  const [row] = await db
    .update(categories)
    .set({ name: trimmed, icon: icon ?? null, color: color ?? null, updatedAt: now })
    .where(and(eq(categories.id, id), eq(categories.userId, req.userId!)))
    .returning();

  if (!row) return res.status(404).json({ message: "Category not found" });
  return res.json({
    id: row.id,
    userId: row.userId,
    name: row.name,
    type: row.type,
    isDefault: row.isDefault,
    icon: row.icon ?? null,
    color: row.color ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  });
});

router.post("/categories/:id/reassign", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const { targetCategoryId } = req.body as { targetCategoryId?: number };
  if (!targetCategoryId) return res.status(400).json({ message: "targetCategoryId is required" });

  const [source] = await db
    .select()
    .from(categories)
    .where(and(eq(categories.id, id), eq(categories.userId, req.userId!)))
    .limit(1);

  if (!source) return res.status(404).json({ message: "Category not found" });

  const [target] = await db
    .select()
    .from(categories)
    .where(and(eq(categories.id, targetCategoryId), eq(categories.userId, req.userId!)))
    .limit(1);

  if (!target) return res.status(404).json({ message: "Target category not found" });
  if (target.type !== source.type) {
    return res.status(400).json({ message: "Target category must be the same type." });
  }

  const now = new Date();
  await db
    .update(incomes)
    .set({ categoryId: targetCategoryId, updatedAt: now })
    .where(and(eq(incomes.categoryId, id), eq(incomes.userId, req.userId!)));

  await db
    .update(expenses)
    .set({ categoryId: targetCategoryId, updatedAt: now })
    .where(and(eq(expenses.categoryId, id), eq(expenses.userId, req.userId!)));

  await db.delete(categories).where(and(eq(categories.id, id), eq(categories.userId, req.userId!)));

  return res.json({ message: "Category reassigned and deleted." });
});

router.delete("/categories/:id", requireAuth, async (req, res) => {
  const id = Number(req.params.id);

  const [source] = await db
    .select()
    .from(categories)
    .where(and(eq(categories.id, id), eq(categories.userId, req.userId!)))
    .limit(1);

  if (!source) return res.status(404).json({ message: "Category not found" });

  const [incomeCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(incomes)
    .where(and(eq(incomes.categoryId, id), eq(incomes.userId, req.userId!)));

  const [expenseCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(expenses)
    .where(and(eq(expenses.categoryId, id), eq(expenses.userId, req.userId!)));

  const total = (incomeCount?.count ?? 0) + (expenseCount?.count ?? 0);
  if (total > 0) {
    return res.status(409).json({
      message: `This category has ${total} transaction(s). Reassign them before deleting.`,
      code: "CATEGORY_IN_USE",
      transactionCount: total,
    });
  }

  await db.delete(categories).where(and(eq(categories.id, id), eq(categories.userId, req.userId!)));
  return res.json({ message: "Deleted" });
});

export default router;
