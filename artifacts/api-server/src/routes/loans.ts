import { Router } from "express";
import { db, loans } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth.js";

const router = Router();

// Standard reducing-balance EMI formula
function calcEMI(principal: number, annualRate: number, tenureYears: number): number {
  const n = tenureYears * 12;
  if (annualRate === 0) return Math.round((principal / n) * 100) / 100;
  const r = annualRate / 100 / 12;
  const emi = (principal * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
  return Math.round(emi * 100) / 100;
}

// Outstanding balance after k months have elapsed
function calcOutstanding(principal: number, annualRate: number, emi: number, monthsElapsed: number): number {
  if (monthsElapsed <= 0) return principal;
  if (annualRate === 0) return Math.max(0, principal - emi * monthsElapsed);
  const r = annualRate / 100 / 12;
  const outstanding = principal * Math.pow(1 + r, monthsElapsed) - emi * (Math.pow(1 + r, monthsElapsed) - 1) / r;
  return Math.max(0, Math.round(outstanding * 100) / 100);
}

function monthsBetween(startDate: string): number {
  const start = new Date(startDate + "T00:00:00");
  const today = new Date();
  return Math.max(0,
    (today.getFullYear() - start.getFullYear()) * 12 +
    (today.getMonth() - start.getMonth())
  );
}

function addMonthsToDate(dateStr: string, months: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setMonth(d.getMonth() + months);
  return d.toISOString().split("T")[0];
}

function formatLoanResponse(r: typeof loans.$inferSelect) {
  const principal = Number(r.principalAmount);
  const rate = Number(r.interestRate);
  const tenureYears = r.tenureYears;
  const emi = Number(r.emi);
  const totalMonths = tenureYears * 12;

  const elapsed = Math.min(monthsBetween(r.startDate), totalMonths);
  const remaining = Math.max(0, totalMonths - elapsed);

  const outstanding = calcOutstanding(principal, rate, emi, elapsed);
  const principalPaid = Math.max(0, Math.round((principal - outstanding) * 100) / 100);
  const totalPaid = Math.round(emi * elapsed * 100) / 100;
  const interestPaid = Math.max(0, Math.round((totalPaid - principalPaid) * 100) / 100);
  const totalInterest = Math.round((emi * totalMonths - principal) * 100) / 100;
  const remainingInterest = Math.max(0, Math.round((emi * remaining - outstanding) * 100) / 100);

  const endDate = addMonthsToDate(r.startDate, totalMonths);

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
    endDate,
    outstandingBalance: outstanding,
    principalPaid,
    interestPaid,
    totalInterest,
    monthsCompleted: elapsed,
    monthsRemaining: remaining,
    totalMonths,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

function validateTenure(loanType: string, tenureYears: number): string | null {
  const lt = loanType.toLowerCase();
  if (lt.includes("personal")) {
    if (tenureYears < 1 || tenureYears > 5) return "Personal Loan tenure must be 1–5 years.";
  } else if (lt.includes("car")) {
    if (tenureYears < 1 || tenureYears > 7) return "Car Loan tenure must be 1–7 years.";
  } else if (lt.includes("home")) {
    if (tenureYears < 1 || tenureYears > 30) return "Home Loan tenure must be 1–30 years.";
  } else {
    if (tenureYears < 1 || tenureYears > 30) return "Tenure must be between 1–30 years.";
  }
  return null;
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
  await db.delete(loans).where(and(eq(loans.id, id), eq(loans.userId, req.userId!)));
  return res.json({ message: "Deleted" });
});

export default router;
