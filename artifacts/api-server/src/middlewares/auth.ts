import type { Request, Response, NextFunction } from "express";
import { db, userTokens, users } from "@workspace/db";
import { eq } from "drizzle-orm";

declare global {
  namespace Express {
    interface Request {
      userId?: number;
      user?: { id: number; fullName: string; mobile: string };
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ message: "Not authenticated" });
    return;
  }
  const token = authHeader.substring(7);
  const [tokenRow] = await db
    .select({ userId: userTokens.userId })
    .from(userTokens)
    .where(eq(userTokens.token, token))
    .limit(1);

  if (!tokenRow) {
    res.status(401).json({ message: "Invalid or expired token" });
    return;
  }
  req.userId = tokenRow.userId;
  next();
}
