import { Router } from "express";
import { db, loans } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth.js";
import {
  calcEMI,
  formatLoanMetrics,
  validateTenure,
} from "../lib/loanCalculations.js";

const router = Router();

function formatLoanResponse(r: typeof loans.$inferSelect) {
  const principal = Number(r.principalAmount);
  const rate = Number(r.interestRate);
  const tenureYears = r.tenureYears;
  const emi = Number(r.emi);
  const metrics = formatLoanMetrics(r);

  return {
    id: r.id,
    userId: r.userId,
    name: r.name,
    loanType: r.loanType,
    principalAmount: principal,
    interestRate: rate,
    tenureYears,
    emi,
    startDate: r.startDate,
    endDate: metrics.endDate,
    outstandingBalance: metrics.outstandingBalance,
    principalPaid: metrics.principalPaid,
    interestPaid: metrics.interestPaid,
    totalInterest: metrics.totalInterest,
    monthsCompleted: metrics.monthsCompleted,
    monthsRemaining: metrics.monthsRemaining,
    totalMonths: metrics.totalMonths,
    nextEmiDate: metrics.nextEmiDate,
    completionPercentage: metrics.completionPercentage,
    isCompleted: metrics.isCompleted,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

router.get("/loans", requireAuth, async (req, res) => {
  const rows = await db.select().from(loans).where(eq(loans.userId, req.userId!)).orderBy(loans.createdAt);
  return res.json(rows.map(formatLoanResponse));
});

router.post("/loans", requireAuth, async (req, res) => {
  const { name, loanType, principalAmount, interestRate, tenureYears, startDate, emi: providedEmi } = req.body as {
    name?: string; loanType?: string; principalAmount?: number; interestRate?: number;
    tenureYears?: number; startDate?: string; emi?: number;
  };

  if (!name?.trim()) return res.status(400).json({ message: "Loan name is required." });
  if (!loanType) return res.status(400).json({ message: "Loan type is required." });
  if (!principalAmount || principalAmount <= 0) return res.status(400).json({ message: "Loan amount must be greater than 0." });
  if (interestRate === undefined || interestRate < 0) return res.status(400).json({ message: "Interest rate must be 0 or greater." });
  if (!tenureYears || tenureYears < 1) return res.status(400).json({ message: "Tenure must be at least 1 year." });
  if (!startDate) return res.status(400).json({ message: "Start date is required." });

  const tenureError = validateTenure(loanType, tenureYears);
  if (tenureError) return res.status(400).json({ message: tenureError });

  const emi = providedEmi && providedEmi > 0 ? providedEmi : calcEMI(principalAmount, interestRate, tenureYears);

  const now = new Date();
  const [row] = await db
    .insert(loans)
    .values({
      userId: req.userId!,
      name: name.trim(),
      loanType,
      principalAmount: String(principalAmount),
      interestRate: String(interestRate),
      tenureYears,
      emi: String(emi),
      startDate,
      updatedAt: now,
    })
    .returning();

  return res.status(201).json(formatLoanResponse(row));
});

router.put("/loans/:id", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const { name, loanType, principalAmount, interestRate, tenureYears, startDate, emi: providedEmi } = req.body as {
    name?: string; loanType?: string; principalAmount?: number; interestRate?: number;
    tenureYears?: number; startDate?: string; emi?: number;
  };

  if (!name?.trim()) return res.status(400).json({ message: "Loan name is required." });
  if (!principalAmount || principalAmount <= 0) return res.status(400).json({ message: "Loan amount must be greater than 0." });
  if (interestRate === undefined || interestRate < 0) return res.status(400).json({ message: "Interest rate must be 0 or greater." });
  if (!tenureYears || tenureYears < 1) return res.status(400).json({ message: "Tenure must be at least 1 year." });

  if (loanType && tenureYears) {
    const tenureError = validateTenure(loanType, tenureYears);
    if (tenureError) return res.status(400).json({ message: tenureError });
  }

  const emi = providedEmi && providedEmi > 0 ? providedEmi
    : (principalAmount && interestRate !== undefined && tenureYears)
      ? calcEMI(principalAmount, interestRate, tenureYears)
      : undefined;

  const now = new Date();
  const [row] = await db
    .update(loans)
    .set({
      name: name?.trim(),
      loanType,
      principalAmount: principalAmount !== undefined ? String(principalAmount) : undefined,
      interestRate: interestRate !== undefined ? String(interestRate) : undefined,
      tenureYears,
      emi: emi !== undefined ? String(emi) : undefined,
      startDate,
      updatedAt: now,
    })
    .where(and(eq(loans.id, id), eq(loans.userId, req.userId!)))
    .returning();

  if (!row) return res.status(404).json({ message: "Loan not found." });
  return res.json(formatLoanResponse(row));
});

router.delete("/loans/:id", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const [row] = await db
    .delete(loans)
    .where(and(eq(loans.id, id), eq(loans.userId, req.userId!)))
    .returning({ id: loans.id });
  if (!row) return res.status(404).json({ message: "Not found" });
  return res.json({ message: "Deleted" });
});

export default router;
