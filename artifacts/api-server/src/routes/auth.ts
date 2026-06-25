import { Router } from "express";
import { db, users, categories, userTokens } from "@workspace/db";
import { eq } from "drizzle-orm";
import crypto from "crypto";
import bcrypt from "bcrypt";
import { requireAuth } from "../middlewares/auth.js";

const router = Router();
const SALT_ROUNDS = 12;

const DEFAULT_INCOME_CATEGORIES = ["Salary", "Freelance", "Business", "Investment", "Other"];
const DEFAULT_EXPENSE_CATEGORIES = [
  "Food", "Fuel", "Shopping", "Bills", "Medical",
  "Entertainment", "Travel", "EMI", "Other",
];

function formatUser(user: typeof users.$inferSelect, token?: string) {
  return {
    id: user.id,
    fullName: user.fullName,
    mobile: user.mobile,
    token,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

async function issueToken(userId: number): Promise<string> {
  const token = crypto.randomBytes(32).toString("hex");
  // Delete old tokens for this user (single active session)
  await db.delete(userTokens).where(eq(userTokens.userId, userId));
  await db.insert(userTokens).values({ userId, token });
  return token;
}

async function seedDefaultCategories(userId: number, now: Date) {
  const incomeCats = DEFAULT_INCOME_CATEGORIES.map((name) => ({
    userId,
    name,
    type: "income",
    isDefault: true,
    updatedAt: now,
  }));
  const expenseCats = DEFAULT_EXPENSE_CATEGORIES.map((name) => ({
    userId,
    name,
    type: "expense",
    isDefault: true,
    updatedAt: now,
  }));
  await db.insert(categories).values([...incomeCats, ...expenseCats]);
}

// POST /api/auth/register
router.post("/auth/register", async (req, res) => {
  const { fullName, mobile, password, confirmPassword } = req.body as {
    fullName?: string;
    mobile?: string;
    password?: string;
    confirmPassword?: string;
  };

  if (!fullName?.trim()) return res.status(400).json({ message: "Full name is required." });
  if (!mobile?.trim() || mobile.trim().length < 7) return res.status(400).json({ message: "A valid mobile number is required." });
  if (!password || password.length < 6) return res.status(400).json({ message: "Password must be at least 6 characters." });
  if (password !== confirmPassword) return res.status(400).json({ message: "Passwords do not match." });

  const normalizedMobile = mobile.trim();

  // Check uniqueness
  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.mobile, normalizedMobile)).limit(1);
  if (existing) return res.status(409).json({ message: "This mobile number is already registered. Please log in." });

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const now = new Date();

  const [user] = await db
    .insert(users)
    .values({ fullName: fullName.trim(), mobile: normalizedMobile, passwordHash, updatedAt: now })
    .returning();

  await seedDefaultCategories(user.id, now);
  const token = await issueToken(user.id);

  return res.status(201).json(formatUser(user, token));
});

// POST /api/auth/login
router.post("/auth/login", async (req, res) => {
  const { mobile, password } = req.body as { mobile?: string; password?: string };

  if (!mobile?.trim()) return res.status(400).json({ message: "Mobile number is required." });
  if (!password) return res.status(400).json({ message: "Password is required." });

  const [user] = await db.select().from(users).where(eq(users.mobile, mobile.trim())).limit(1);

  if (!user) return res.status(401).json({ message: "Invalid mobile number or password." });

  if (!user.passwordHash) {
    // Legacy account without password — require them to set a password
    return res.status(401).json({ message: "This account was created without a password. Please contact support." });
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return res.status(401).json({ message: "Invalid mobile number or password." });

  const token = await issueToken(user.id);
  return res.json(formatUser(user, token));
});

// POST /api/auth/logout
router.post("/auth/logout", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.substring(7);
    await db.delete(userTokens).where(eq(userTokens.token, token));
  }
  return res.json({ message: "Logged out successfully" });
});

// GET /api/auth/me
router.get("/auth/me", requireAuth, async (req, res) => {
  const [user] = await db.select().from(users).where(eq(users.id, req.userId!)).limit(1);
  if (!user) return res.status(401).json({ message: "Not authenticated" });
  return res.json(formatUser(user));
});

// POST /api/auth/change-password
router.post("/auth/change-password", requireAuth, async (req, res) => {
  const { currentPassword, newPassword, confirmPassword } = req.body as {
    currentPassword?: string;
    newPassword?: string;
    confirmPassword?: string;
  };

  if (!currentPassword) return res.status(400).json({ message: "Current password is required." });
  if (!newPassword || newPassword.length < 6) return res.status(400).json({ message: "New password must be at least 6 characters." });
  if (newPassword !== confirmPassword) return res.status(400).json({ message: "Passwords do not match." });

  const [user] = await db.select().from(users).where(eq(users.id, req.userId!)).limit(1);
  if (!user) return res.status(401).json({ message: "Not authenticated." });

  if (user.passwordHash) {
    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) return res.status(400).json({ message: "Current password is incorrect." });
  }

  const newHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  await db.update(users).set({ passwordHash: newHash, updatedAt: new Date() }).where(eq(users.id, req.userId!));

  return res.json({ message: "Password changed successfully." });
});

// POST /api/auth/forgot-password (placeholder)
router.post("/auth/forgot-password", async (req, res) => {
  const { mobile } = req.body as { mobile?: string };
  if (!mobile?.trim()) return res.status(400).json({ message: "Mobile number is required." });
  // Placeholder — in production, send OTP/reset link via SMS
  return res.json({ message: "If this number is registered, a reset link has been sent." });
});

export default router;
