import type { loans } from "@workspace/db";

type LoanRow = typeof loans.$inferSelect;

export function findMatchingLoan(
  loanRows: LoanRow[],
  amount: number,
  notes?: string | null,
): LoanRow | null {
  if (notes?.trim()) {
    const byName = loanRows.find((l) =>
      notes.toLowerCase().includes(l.name.toLowerCase()),
    );
    if (byName) return byName;
  }
  return loanRows.find((l) => Math.abs(Number(l.emi) - amount) < 0.01) ?? null;
}
