const REQUIRED = ["DATABASE_URL", "PORT", "JWT_SECRET"] as const;

export function validateEnv(): void {
  const missing = REQUIRED.filter((key) => !process.env[key]?.trim());
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }

  const port = Number(process.env.PORT);
  if (Number.isNaN(port) || port <= 0) {
    throw new Error(`Invalid PORT value: "${process.env.PORT}"`);
  }
}
