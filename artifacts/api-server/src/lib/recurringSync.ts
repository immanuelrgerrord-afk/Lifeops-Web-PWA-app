import { db, incomes, expenses } from "@workspace/db";
import { and, eq, isNull } from "drizzle-orm";
import { occurrenceDate, dueOccurrenceCount, nextOccurrenceDate } from "./recurrence.js";
import { todayISO } from "./dates.js";

type IncomeRow = typeof incomes.$inferSelect;
type ExpenseRow = typeof expenses.$inferSelect;

async function materializeIncomeTemplate(template: IncomeRow): Promise<void> {
  if (template.recurrenceType === "one-time" || template.parentId != null) return;

  const today = todayISO();
  const due = dueOccurrenceCount(template.date, template.recurrenceType, template.occurrences, today);
  let generated = template.generatedOccurrences;
  const now = new Date();

  while (generated < due && generated < template.occurrences) {
    const occDate = occurrenceDate(template.date, template.recurrenceType, generated);
    if (occDate > today) break;

    const existing = await db
      .select({ id: incomes.id })
      .from(incomes)
      .where(
        and(
          eq(incomes.userId, template.userId),
          eq(incomes.parentId, template.id),
          eq(incomes.date, occDate),
        ),
      )
      .limit(1);

    if (existing.length === 0) {
      await db.insert(incomes).values({
        userId: template.userId,
        categoryId: template.categoryId,
        amount: template.amount,
        date: occDate,
        notes: template.notes,
        recurrenceType: "one-time",
        occurrences: 1,
        generatedOccurrences: 0,
        nextOccurrenceDate: null,
        parentId: template.id,
        updatedAt: now,
      });
    }
    generated++;
  }

  const nextDate = nextOccurrenceDate(
    template.date,
    template.recurrenceType,
    template.occurrences,
    generated,
  );

  await db
    .update(incomes)
    .set({
      generatedOccurrences: generated,
      nextOccurrenceDate: nextDate,
      updatedAt: now,
    })
    .where(eq(incomes.id, template.id));
}

async function materializeExpenseTemplate(template: ExpenseRow): Promise<void> {
  if (template.recurrenceType === "one-time" || template.parentId != null) return;

  const today = todayISO();
  const due = dueOccurrenceCount(template.date, template.recurrenceType, template.occurrences, today);
  let generated = template.generatedOccurrences;
  const now = new Date();

  while (generated < due && generated < template.occurrences) {
    const occDate = occurrenceDate(template.date, template.recurrenceType, generated);
    if (occDate > today) break;

    const existing = await db
      .select({ id: expenses.id })
      .from(expenses)
      .where(
        and(
          eq(expenses.userId, template.userId),
          eq(expenses.parentId, template.id),
          eq(expenses.date, occDate),
        ),
      )
      .limit(1);

    if (existing.length === 0) {
      await db.insert(expenses).values({
        userId: template.userId,
        categoryId: template.categoryId,
        amount: template.amount,
        date: occDate,
        notes: template.notes,
        recurrenceType: "one-time",
        occurrences: 1,
        generatedOccurrences: 0,
        nextOccurrenceDate: null,
        parentId: template.id,
        updatedAt: now,
      });
    }
    generated++;
  }

  const nextDate = nextOccurrenceDate(
    template.date,
    template.recurrenceType,
    template.occurrences,
    generated,
  );

  await db
    .update(expenses)
    .set({
      generatedOccurrences: generated,
      nextOccurrenceDate: nextDate,
      updatedAt: now,
    })
    .where(eq(expenses.id, template.id));
}

export async function syncRecurringForUser(userId: number): Promise<void> {
  const incomeTemplates = await db
    .select()
    .from(incomes)
    .where(and(eq(incomes.userId, userId), isNull(incomes.parentId)));

  for (const t of incomeTemplates) {
    if (t.recurrenceType !== "one-time") await materializeIncomeTemplate(t);
  }

  const expenseTemplates = await db
    .select()
    .from(expenses)
    .where(and(eq(expenses.userId, userId), isNull(expenses.parentId)));

  for (const t of expenseTemplates) {
    if (t.recurrenceType !== "one-time") await materializeExpenseTemplate(t);
  }
}
