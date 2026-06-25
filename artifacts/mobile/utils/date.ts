// Internal storage format: YYYY-MM-DD
// Display format: DD-MM-YYYY

export function toDisplayDate(yyyymmdd: string): string {
  if (!yyyymmdd || yyyymmdd.length < 10) return yyyymmdd ?? "";
  const [y, m, d] = yyyymmdd.split("-");
  return `${d}-${m}-${y}`;
}

export function toStorageDate(input: string): string {
  if (!input) return "";
  const parts = input.split("-");
  if (parts.length !== 3) return input;
  // Already YYYY-MM-DD
  if (parts[0].length === 4) return input;
  // Convert DD-MM-YYYY → YYYY-MM-DD
  const [d, m, y] = parts;
  return `${y}-${m}-${d}`;
}

export function todayDisplay(): string {
  return toDisplayDate(new Date().toISOString().split("T")[0]);
}

export function todayStorage(): string {
  return new Date().toISOString().split("T")[0];
}

export function formatDisplayDate(yyyymmdd: string): string {
  return toDisplayDate(yyyymmdd);
}

// Format as "24 Jun 2026"
export function formatReadableDate(yyyymmdd: string): string {
  if (!yyyymmdd) return "";
  try {
    const d = new Date(yyyymmdd + "T00:00:00");
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return yyyymmdd;
  }
}

// Validate DD-MM-YYYY input
export function isValidDisplayDate(input: string): boolean {
  const parts = input.split("-");
  if (parts.length !== 3) return false;
  const [d, m, y] = parts.map(Number);
  if (!d || !m || !y) return false;
  if (y < 1900 || y > 2100) return false;
  if (m < 1 || m > 12) return false;
  if (d < 1 || d > 31) return false;
  return true;
}

export function storageToDisplay(yyyymmdd: string): string {
  return toDisplayDate(yyyymmdd);
}
