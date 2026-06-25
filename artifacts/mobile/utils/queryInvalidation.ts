import type { QueryClient } from "@tanstack/react-query";

/** Invalidate all month/param variants of financial list queries. */
export function invalidateFinancialData(qc: QueryClient) {
  qc.invalidateQueries({ queryKey: ["/api/dashboard"] });
  qc.invalidateQueries({ queryKey: ["/api/incomes"] });
  qc.invalidateQueries({ queryKey: ["/api/expenses"] });
  qc.invalidateQueries({ queryKey: ["/api/loans"] });
  qc.invalidateQueries({ queryKey: ["/api/goals"] });
  qc.invalidateQueries({ queryKey: ["/api/categories"] });
}
