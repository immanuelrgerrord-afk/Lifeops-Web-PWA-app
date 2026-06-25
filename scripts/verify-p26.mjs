/**
 * P2.6 dashboard savings verification — run: node scripts/verify-p26.mjs
 */

function round2(n) {
  return Math.round(n * 100) / 100;
}

function findMatchingLoan(loans, amount, notes) {
  if (notes?.trim()) {
    const byName = loans.find((l) => notes.toLowerCase().includes(l.name.toLowerCase()));
    if (byName) return byName;
  }
  return loans.find((l) => Math.abs(Number(l.emi) - amount) < 0.01) ?? null;
}

function calculateMonthlySavings(totalIncome, monthExpenses, loanRows) {
  let regularExpenses = 0;
  let unmatchedEmiExpenses = 0;

  for (const row of monthExpenses) {
    const amount = Number(row.amount);
    if (row.categoryName !== "EMI") {
      regularExpenses += amount;
      continue;
    }
    if (findMatchingLoan(loanRows, amount, row.notes)) continue;
    unmatchedEmiExpenses += amount;
  }

  const emiDueFromLoans = loanRows.reduce((sum, loan) => sum + Number(loan.emi), 0);
  const savings = totalIncome - regularExpenses - emiDueFromLoans - unmatchedEmiExpenses;

  return {
    totalExpenses: round2(regularExpenses),
    emiDueThisMonth: round2(emiDueFromLoans),
    savings: round2(savings),
  };
}

function assertClose(label, actual, expected) {
  if (Math.abs(actual - expected) > 0.01) {
    console.error(`✗ ${label}: expected ${expected}, got ${actual}`);
    process.exit(1);
  }
  console.log(`✓ ${label}: ${actual}`);
}

const loan = {
  id: 1,
  name: "HDFC Home Loan",
  emi: "23072",
};

const breakdown = calculateMonthlySavings(
  100_000,
  [
    { amount: "15000", categoryName: "Food", notes: null },
    { amount: "5000", categoryName: "Fuel", notes: null },
    { amount: "23072", categoryName: "EMI", notes: "HDFC Home Loan" },
  ],
  [loan],
);

assertClose("Regular expenses", breakdown.totalExpenses, 20_000);
assertClose("EMI due (no double count)", breakdown.emiDueThisMonth, 23_072);
assertClose("Net savings", breakdown.savings, 56_928);

const unmatched = calculateMonthlySavings(
  100_000,
  [{ amount: "23072", categoryName: "EMI", notes: "Unknown loan" }],
  [],
);
assertClose("Unmatched EMI reduces savings", unmatched.savings, 76_928);

console.log("\nAll P2.6 financial checks passed.");
