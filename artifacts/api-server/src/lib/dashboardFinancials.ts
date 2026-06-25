import type { loans } from "@workspace/db";
import { emiAmountForMonth, formatLoanMetrics, round2 } from "./loanCalculations.js";
import { findMatchingLoan } from "./emiMatching.js";

type LoanRow = typeof loans.$inferSelect;

type MonthExpenseRow = {
  amount: string;
  categoryName: string | null;
  notes: string | null;
};

export function calculateMonthlySavings(
  totalIncome: number,
  monthExpenses: MonthExpenseRow[],
  loanRows: LoanRow[],
  month: string,
  asOf: Date = new Date(),
) {
  let regularExpenses = 0;
  let unmatchedEmiExpenses = 0;
  const matchedLoanIds = new Set<number>();

  for (const row of monthExpenses) {
    const amount = Number(row.amount);
    const isEmi = row.categoryName === "EMI";

    if (!isEmi) {
      regularExpenses += amount;
      continue;
    }

    const matched = findMatchingLoan(loanRows, amount, row.notes);
    if (matched) {
      matchedLoanIds.add(matched.id);
      continue;
    }

    unmatchedEmiExpenses += amount;
  }

  const emiDueFromLoans = loanRows.reduce(
    (sum, loan) => sum + emiAmountForMonth(loan, month, asOf),
    0,
  );

  const savings = totalIncome - regularExpenses - emiDueFromLoans - unmatchedEmiExpenses;

  return {
    totalIncome: round2(totalIncome),
    totalExpenses: round2(regularExpenses),
    emiDueThisMonth: round2(emiDueFromLoans),
    unmatchedEmiExpenses: round2(unmatchedEmiExpenses),
    savings: round2(savings),
    matchedLoanIds,
  };
}

export function buildLoanDashboardSummary(loanRows: LoanRow[], month: string, asOf: Date = new Date()) {
  let totalOutstanding = 0;
  let totalRemainingInterest = 0;
  let emiDueThisMonth = 0;
  let activeLoans = 0;
  let completionSum = 0;

  const items = loanRows.map((loan) => {
    const metrics = formatLoanMetrics(loan, asOf);
    const emiDue = emiAmountForMonth(loan, month, asOf);
    const remainingInterest = round2(Math.max(0, metrics.totalInterest - metrics.interestPaid));

    if (!metrics.isCompleted) {
      activeLoans += 1;
      totalOutstanding += metrics.outstandingBalance;
      totalRemainingInterest += remainingInterest;
      completionSum += metrics.completionPercentage;
    }

    emiDueThisMonth += emiDue;

    return {
      id: loan.id,
      name: loan.name,
      emi: Number(loan.emi),
      emiDueThisMonth: emiDue,
      outstandingBalance: metrics.outstandingBalance,
      remainingInterest,
      completionPercentage: metrics.completionPercentage,
      isActive: !metrics.isCompleted,
    };
  });

  return {
    activeLoans,
    totalOutstanding: round2(totalOutstanding),
    totalRemainingInterest: round2(totalRemainingInterest),
    emiDueThisMonth: round2(emiDueThisMonth),
    avgLoanCompletion:
      activeLoans > 0 ? round2(completionSum / activeLoans) : 0,
    loans: items,
  };
}

const COMMITMENT_CATEGORY_HINTS = [
  "sip",
  "ppf",
  "insurance",
  "subscription",
  "wifi",
  "rent",
  "emi",
];

function monthlyEquivalent(amount: number, recurrenceType: string): number {
  if (recurrenceType === "monthly") return amount;
  if (recurrenceType === "quarterly") return round2(amount / 3);
  if (recurrenceType === "half-yearly") return round2(amount / 6);
  if (recurrenceType === "yearly") return round2(amount / 12);
  return 0;
}

export type RecurringCommitmentTemplate = {
  id: number;
  categoryName: string | null;
  categoryIcon: string | null;
  categoryColor: string | null;
  amount: string;
  recurrenceType: string;
  notes: string | null;
};

export function buildMonthlyFixedCommitments(
  loanRows: LoanRow[],
  recurringExpenseTemplates: RecurringCommitmentTemplate[],
  month: string,
  asOf: Date = new Date(),
) {
  const items: Array<{
    id: string;
    name: string;
    categoryName: string;
    categoryIcon?: string;
    categoryColor?: string;
    monthlyAmount: number;
    source: "loan" | "expense";
  }> = [];

  for (const loan of loanRows) {
    const due = emiAmountForMonth(loan, month, asOf);
    if (due <= 0) continue;
    items.push({
      id: `loan-${loan.id}`,
      name: loan.name,
      categoryName: "Loan EMI",
      monthlyAmount: due,
      source: "loan",
    });
  }

  for (const template of recurringExpenseTemplates) {
    if (template.recurrenceType === "one-time") continue;
    const cat = template.categoryName ?? "";
    if (cat === "EMI") continue;

    const displayName =
      cat === "Other" && template.notes?.trim() ? template.notes.trim() : cat;
    const amount = Number(template.amount);
    const monthlyAmount = monthlyEquivalent(amount, template.recurrenceType);
    if (monthlyAmount <= 0) continue;

    const isCommitment =
      COMMITMENT_CATEGORY_HINTS.some((hint) => cat.toLowerCase().includes(hint)) ||
      template.recurrenceType === "monthly";

    if (!isCommitment) continue;

    items.push({
      id: `expense-${template.id}`,
      name: displayName,
      categoryName: cat,
      categoryIcon: template.categoryIcon ?? undefined,
      categoryColor: template.categoryColor ?? undefined,
      monthlyAmount,
      source: "expense",
    });
  }

  items.sort((a, b) => b.monthlyAmount - a.monthlyAmount);

  const totalMonthlyCommitment = round2(
    items.reduce((sum, item) => sum + item.monthlyAmount, 0),
  );

  return { items, totalMonthlyCommitment };
}
