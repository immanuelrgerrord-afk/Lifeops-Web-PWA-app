/** Strip commas, currency symbols, spaces — parse to number or null if empty/invalid. */
export function parseAmount(input: string): number | null {
  const cleaned = input.replace(/[₹,\s]/g, "").trim();
  if (!cleaned) return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return null;
  return n;
}

/** Format number for display with Indian grouping; preserves decimals up to 2. */
export function formatAmountDisplay(value: number): string {
  return value.toLocaleString("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

/** Allow natural typing: digits, one dot, max 2 decimal places; optional commas while typing. */
export function sanitizeAmountInput(raw: string): string {
  let s = raw.replace(/[₹\s]/g, "");
  s = s.replace(/,/g, "");
  if (s === "") return "";
  const parts = s.split(".");
  if (parts.length > 2) {
    s = `${parts[0]}.${parts.slice(1).join("")}`;
  }
  const [intPart, decPart] = s.split(".");
  const intClean = intPart.replace(/[^\d]/g, "");
  if (decPart === undefined) return intClean;
  const decClean = decPart.replace(/[^\d]/g, "").slice(0, 2);
  return decClean.length ? `${intClean}.${decClean}` : intClean.endsWith(".") ? `${intClean}.` : intClean;
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Parse interest rate; max 100; round to 2 decimals. */
export function parseInterestRate(input: string): number | null {
  const cleaned = input.replace(/%/g, "").trim();
  if (!cleaned) return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return null;
  return round2(Math.min(100, Math.max(0, n)));
}

export function sanitizeRateInput(raw: string): string {
  let s = raw.replace(/%/g, "").trim();
  if (s === "") return "";
  const parts = s.split(".");
  if (parts.length > 2) {
    s = `${parts[0]}.${parts.slice(1).join("")}`;
  }
  const [intPart, decPart] = s.split(".");
  const intClean = intPart.replace(/[^\d]/g, "");
  if (decPart === undefined) return intClean;
  const decClean = decPart.replace(/[^\d]/g, "").slice(0, 2);
  return decClean.length ? `${intClean}.${decClean}` : intClean.endsWith(".") ? `${intClean}.` : intClean;
}

export function formatINR(n: number, maxFraction = 2): string {
  return `₹${n.toLocaleString("en-IN", { maximumFractionDigits: maxFraction, minimumFractionDigits: 0 })}`;
}
