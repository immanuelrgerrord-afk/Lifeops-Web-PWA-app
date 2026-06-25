import { db, categories } from "@workspace/db";
import { and, eq } from "drizzle-orm";

type CategoryRow = { id: number; name: string; type: string; icon: string | null; color: string | null };

export async function getOwnedCategory(
  userId: number,
  categoryId: number,
  expectedType: "income" | "expense",
): Promise<{ category: CategoryRow } | { error: string; status: number }> {
  const [category] = await db
    .select({
      id: categories.id,
      name: categories.name,
      type: categories.type,
      icon: categories.icon,
      color: categories.color,
    })
    .from(categories)
    .where(and(eq(categories.id, categoryId), eq(categories.userId, userId)))
    .limit(1);

  if (!category) {
    return { error: "Category not found.", status: 404 };
  }

  if (category.type !== expectedType) {
    return { error: `Category must be an ${expectedType} category.`, status: 400 };
  }

  return { category };
}
