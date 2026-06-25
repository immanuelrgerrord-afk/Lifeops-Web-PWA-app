import type { ErrorRequestHandler } from "express";
import { serializeDatabaseError } from "@workspace/db";
import { logger } from "./logger.js";

export function logDatabaseError(error: unknown, context?: Record<string, unknown>): void {
  logger.error(
    {
      ...context,
      database: serializeDatabaseError(error),
    },
    "Database error",
  );
}

export const databaseErrorHandler: ErrorRequestHandler = (error, req, res, next) => {
  if (res.headersSent) {
    next(error);
    return;
  }

  logDatabaseError(error, {
    method: req.method,
    path: req.originalUrl?.split("?")[0],
  });

  res.status(500).json({ message: "Internal server error" });
};
