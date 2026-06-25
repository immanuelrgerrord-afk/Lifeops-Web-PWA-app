import app from "./app";
import { validateEnv } from "./lib/env.js";
import { logger } from "./lib/logger";

validateEnv();

const port = Number(process.env.PORT);

app.listen(port, "0.0.0.0", (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});
