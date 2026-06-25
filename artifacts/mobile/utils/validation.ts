import { parseAmount, parseInterestRate } from "./numeric";
import { isValidDisplayDate } from "./date";

export function validateRequired(value: string, label: string): string | null {
  if (!value.trim()) return `${label} is required.`;
  return null;
}

export function validateAmount(value: string, label = "Amount"): string | null {
  const n = parseAmount(value);
  if (n === null) return `Enter a valid ${label.toLowerCase()}.`;
  if (n <= 0) return `${label} must be greater than zero.`;
  return null;
}

export function validateInterestRate(value: string): string | null {
  const cleaned = value.replace(/%/g, "").trim();
  if (!cleaned) return "Interest rate is required.";
  const n = parseInterestRate(value);
  if (n === null) return "Enter a valid interest rate.";
  if (n > 100) return "Interest rate cannot exceed 100%.";
  return null;
}

export function validateTenureYears(value: string, min: number, max: number): string | null {
  const t = parseInt(value, 10);
  if (!t || t < min) return `Tenure must be at least ${min} year${min > 1 ? "s" : ""}.`;
  if (t > max) return `Tenure cannot exceed ${max} years for this loan type.`;
  return null;
}

export function validateOccurrences(value: string): string | null {
  const n = parseInt(value, 10);
  if (!Number.isInteger(n) || n < 1) return "Occurrences must be at least 1.";
  if (n > 9999) return "Occurrences cannot exceed 9,999.";
  return null;
}

export function validateDisplayDate(value: string): string | null {
  if (!value.trim()) return "Date is required.";
  if (!isValidDisplayDate(value)) return "Use DD-MM-YYYY format.";
  return null;
}

export function validateGoalAmounts(targetStr: string, currentStr: string): string | null {
  const targetErr = validateAmount(targetStr, "Target amount");
  if (targetErr) return targetErr;
  const current = parseAmount(currentStr);
  if (current === null || current < 0) return "Current amount cannot be negative.";
  const target = parseAmount(targetStr)!;
  if (current > target) return "Current amount cannot exceed target amount.";
  return null;
}
