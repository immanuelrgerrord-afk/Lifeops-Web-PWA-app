import { addMonthsISO, formatISODate, monthsElapsed, parseISODate } from "./dates.js";

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Standard reducing-balance EMI; supports 0% and decimal rates. */
export function calcEMI(principal: number, annualRate: number, tenureYears: number): number {
  const n = tenureYears * 12;
  if (n <= 0 || principal <= 0) return 0;
  if (annualRate === 0) return round2(principal / n);
  const r = annualRate / 100 / 12;
  const factor = Math.pow(1 + r, n);
  return round2((principal * r * factor) / (factor - 1));
}

/** Outstanding balance after k full EMI periods. */
export function calcOutstanding(
  principal: number,
  annualRate: number,
  emi: number,
  periodsElapsed: number,
): number {
  if (periodsElapsed <= 0) return round2(principal);
  if (principal <= 0) return 0;
  if (annualRate === 0) return round2(Math.max(0, principal - emi * periodsElapsed));
  const r = annualRate / 100 / 12;
  const factor = Math.pow(1 + r, periodsElapsed);
  const outstanding = principal * factor - (emi * (factor - 1)) / r;
  return round2(Math.max(0, outstanding));
}

export type LoanRow = {
  principalAmount: string;
  interestRate: string;
  tenureYears: number;
  emi: string;
  startDate: string;
};

export function formatLoanMetrics(row: LoanRow, asOf: Date = new Date()) {
  const principal = Number(row.principalAmount);
  const rate = Number(row.interestRate);
  const tenureYears = row.tenureYears;
  const emi = Number(row.emi);
  const totalMonths = tenureYears * 12;

  const elapsed = Math.min(monthsElapsed(row.startDate, asOf), totalMonths);
  const remaining = Math.max(0, totalMonths - elapsed);
  const outstanding = calcOutstanding(principal, rate, emi, elapsed);
  const principalPaid = round2(Math.max(0, principal - outstanding));
  const totalPaid = round2(emi * elapsed);
  const interestPaid = round2(Math.max(0, totalPaid - principalPaid));
  const totalInterest = round2(Math.max(0, emi * totalMonths - principal));
  const endDate = addMonthsISO(row.startDate, totalMonths);
  const nextEmiDate =
    remaining > 0 && compareStartToAsOf(row.startDate, asOf) <= 0
      ? addMonthsISO(row.startDate, elapsed)
      : remaining > 0
        ? row.startDate
        : null;
  const completionPercentage =
    totalMonths > 0 ? round2(Math.min(100, (elapsed / totalMonths) * 100)) : 100;

  return {
    outstandingBalance: outstanding,
    principalPaid,
    interestPaid,
    totalInterest,
    monthsCompleted: elapsed,
    monthsRemaining: remaining,
    totalMonths,
    endDate,
    nextEmiDate,
    completionPercentage,
    isCompleted: remaining === 0 || outstanding === 0,
  };
}

function compareStartToAsOf(startDate: string, asOf: Date): number {
  const start = parseISODate(startDate);
  const end = new Date(asOf.getFullYear(), asOf.getMonth(), asOf.getDate());
  if (start > end) return 1;
  if (start < end) return -1;
  return 0;
}

/** True if any scheduled EMI payment falls in YYYY-MM. */
export function isEmiDueInMonth(
  startDate: string,
  tenureYears: number,
  month: string,
): boolean {
  const totalMonths = tenureYears * 12;
  for (let i = 0; i < totalMonths; i++) {
    const payDate = addMonthsISO(startDate, i);
    if (payDate.startsWith(month)) return true;
  }
  return false;
}

/** EMI amount due in a specific month (0 if loan inactive that month). */
export function emiAmountForMonth(
  loan: LoanRow,
  month: string,
  asOf: Date = new Date(),
): number {
  if (!isEmiDueInMonth(loan.startDate, loan.tenureYears, month)) return 0;

  const [y, mo] = month.split("-").map(Number);
  const monthEnd = new Date(y, mo, 0);
  if (parseISODate(loan.startDate) > monthEnd) return 0;

  const asOfMonth = formatISODate(asOf).slice(0, 7);
  if (month > asOfMonth) return 0;

  const totalMonths = loan.tenureYears * 12;
  const completedBeforeMonth =
    monthsElapsed(loan.startDate, new Date(y, mo - 1, 0)) >= totalMonths;
  if (completedBeforeMonth) return 0;

  return Number(loan.emi);
}

function monthEndISO(month: string): string {
  const [y, mo] = month.split("-").map(Number);
  return formatISODate(new Date(y, mo, 0));
}

export function validateTenure(loanType: string, tenureYears: number): string | null {
  const lt = loanType.toLowerCase();
  if (lt.includes("personal")) {
    if (tenureYears < 1 || tenureYears > 5) return "Personal Loan tenure must be 1–5 years.";
  } else if (lt.includes("car")) {
    if (tenureYears < 1 || tenureYears > 7) return "Car Loan tenure must be 1–7 years.";
  } else if (lt.includes("home")) {
    if (tenureYears < 1 || tenureYears > 30) return "Home Loan tenure must be 1–30 years.";
  } else if (tenureYears < 1 || tenureYears > 30) {
    return "Tenure must be between 1–30 years.";
  }
  return null;
}
