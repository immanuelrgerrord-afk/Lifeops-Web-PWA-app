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

function validateGoalPayload(
  targetAmount?: number,
  currentAmount?: number,
): string | null {
  if (targetAmount === undefined || targetAmount <= 0) {
    return "Target amount must be greater than zero.";
  }
  const current = currentAmount ?? 0;
  if (current < 0) return "Current amount cannot be negative.";
  if (current > targetAmount) return "Current amount cannot exceed target amount.";
  return null;
}

router.get("/goals", requireAuth, async (req, res) => {
  const rows = await db.select().from(goals).where(eq(goals.userId, req.userId!)).orderBy(goals.targetDate);
  return res.json(rows.map(formatGoal));
});

router.post("/goals", requireAuth, async (req, res) => {
  const { name, targetAmount, currentAmount, targetDate } = req.body as {
    name?: string; targetAmount?: number; currentAmount?: number; targetDate?: string;
  };
  if (!name?.trim()) return res.status(400).json({ message: "Goal name is required." });
  if (!targetDate) return res.status(400).json({ message: "Target date is required." });

  const validationErr = validateGoalPayload(targetAmount, currentAmount);
  if (validationErr) return res.status(400).json({ message: validationErr });

  const now = new Date();
  const [row] = await db
    .insert(goals)
    .values({
      userId: req.userId!,
      name: name.trim(),
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

  const [existing] = await db
    .select()
    .from(goals)
    .where(and(eq(goals.id, id), eq(goals.userId, req.userId!)));

  if (!existing) return res.status(404).json({ message: "Not found" });

  const nextTarget = targetAmount !== undefined ? targetAmount : Number(existing.targetAmount);
  const nextCurrent = currentAmount !== undefined ? currentAmount : Number(existing.currentAmount);
  const validationErr = validateGoalPayload(nextTarget, nextCurrent);
  if (validationErr) return res.status(400).json({ message: validationErr });

  const now = new Date();
  const [row] = await db
    .update(goals)
    .set({
      name: name?.trim() ?? existing.name,
      targetAmount: String(nextTarget),
      currentAmount: String(nextCurrent),
      targetDate: targetDate ?? existing.targetDate,
      updatedAt: now,
    })
    .where(and(eq(goals.id, id), eq(goals.userId, req.userId!)))
    .returning();

  if (!row) return res.status(404).json({ message: "Not found" });
  return res.json(formatGoal(row));
});

router.delete("/goals/:id", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const [row] = await db
    .delete(goals)
    .where(and(eq(goals.id, id), eq(goals.userId, req.userId!)))
    .returning({ id: goals.id });
  if (!row) return res.status(404).json({ message: "Not found" });
  return res.json({ message: "Deleted" });
});

export default router;
