import { Router } from "express";
import { db, goals } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth.js";

const router = Router();

function formatGoal(r: typeof goals.$inferSelect) {
  const target = Number(r.targetAmount);
  const current = Number(r.currentAmount);
  const progress = target > 0 ? Math.min(100, (current / target) * 100) : 0;
  return {
    id: r.id,
    userId: r.userId,
    name: r.name,
    targetAmount: target,
    currentAmount: current,
    targetDate: r.targetDate,
    progressPercentage: Math.round(progress * 10) / 10,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

router.get("/goals", requireAuth, async (req, res) => {
  const rows = await db.select().from(goals).where(eq(goals.userId, req.userId!)).orderBy(goals.targetDate);
  return res.json(rows.map(formatGoal));
});

router.post("/goals", requireAuth, async (req, res) => {
  const { name, targetAmount, currentAmount, targetDate } = req.body as {
    name?: string; targetAmount?: number; currentAmount?: number; targetDate?: string;
  };
  if (!name || !targetAmount || !targetDate) {
    return res.status(400).json({ message: "name, targetAmount, targetDate are required" });
  }
  const now = new Date();
  const [row] = await db
    .insert(goals)
    .values({
      userId: req.userId!,
      name,
      targetAmount: String(targetAmount),
      currentAmount: String(currentAmount ?? 0),
      targetDate,
      updatedAt: now,
    })
    .returning();
  return res.status(201).json(formatGoal(row));
});

router.put("/goals/:id", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const { name, targetAmount, currentAmount, targetDate } = req.body as {
    name?: string; targetAmount?: number; currentAmount?: number; targetDate?: string;
  };
  const now = new Date();
  const [row] = await db
    .update(goals)
    .set({
      name,
      targetAmount: targetAmount !== undefined ? String(targetAmount) : undefined,
      currentAmount: currentAmount !== undefined ? String(currentAmount) : undefined,
      targetDate,
      updatedAt: now,
    })
    .where(and(eq(goals.id, id), eq(goals.userId, req.userId!)))
    .returning();

  if (!row) return res.status(404).json({ message: "Not found" });
  return res.json(formatGoal(row));
});

router.delete("/goals/:id", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  await db.delete(goals).where(and(eq(goals.id, id), eq(goals.userId, req.userId!)));
  return res.json({ message: "Deleted" });
});

export default router;
