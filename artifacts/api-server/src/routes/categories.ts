import { Router } from "express";
import { db, categories } from "@workspace/db";
import { eq, and } from "drizzle-orm";
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
    }))
  );
});

router.post("/categories", requireAuth, async (req, res) => {
  const { name, type } = req.body as { name?: string; type?: string };
  if (!name || !type) return res.status(400).json({ message: "name and type are required" });
  const now = new Date();
  const [row] = await db
    .insert(categories)
    .values({ userId: req.userId!, name, type, isDefault: false, updatedAt: now })
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
  if (!name) return res.status(400).json({ message: "name is required" });
  const now = new Date();
  const [row] = await db
    .update(categories)
    .set({ name, icon: icon ?? null, color: color ?? null, updatedAt: now })
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

router.delete("/categories/:id", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  await db.delete(categories).where(and(eq(categories.id, id), eq(categories.userId, req.userId!)));
  return res.json({ message: "Deleted" });
});

export default router;
