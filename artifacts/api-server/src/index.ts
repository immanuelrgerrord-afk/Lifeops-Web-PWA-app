import app from "./app";
import { verifyDatabaseConnection } from "@workspace/db";
import { validateEnv } from "./lib/env.js";
import { logDatabaseError } from "./lib/databaseErrorHandler.js";
import { logger } from "./lib/logger";

validateEnv();

const port = Number(process.env.PORT);

verifyDatabaseConnection()
  .then(() => {
    app.listen(port, "0.0.0.0", (err) => {
      if (err) {
        logger.error({ err }, "Error listening on port");
        process.exit(1);
      }

      logger.info({ port }, "Server listening");
    });
  })
  .catch((error) => {
    logDatabaseError(error, { phase: "startup" });
    process.exit(1);
  });
