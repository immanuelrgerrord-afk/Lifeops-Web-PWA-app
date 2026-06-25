import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { databaseErrorHandler } from "./lib/databaseErrorHandler.js";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      err(error) {
        const err = error as Error & { driverError?: unknown; cause?: unknown };
        return {
          type: err.constructor?.name,
          message: err.message,
          stack: err.stack,
          cause: err.cause,
          ...(err.driverError ? { driverError: err.driverError } : {}),
        };
      },
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
const frontendOrigin = process.env.FRONTEND_ORIGIN?.trim();
app.use(
  cors(
    frontendOrigin
      ? { origin: frontendOrigin, credentials: true }
      : undefined,
  ),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

app.use(databaseErrorHandler);

export default app;
