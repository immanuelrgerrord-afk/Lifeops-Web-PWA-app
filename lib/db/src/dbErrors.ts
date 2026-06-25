type PgErrorFields = {
  code?: string;
  detail?: string;
  hint?: string;
  schema?: string;
  table?: string;
  column?: string;
  severity?: string;
  routine?: string;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object") {
    return value as Record<string, unknown>;
  }
  return null;
}

function pickPgFields(value: unknown): PgErrorFields {
  const record = asRecord(value);
  if (!record) return {};

  return {
    code: typeof record.code === "string" ? record.code : undefined,
    detail: typeof record.detail === "string" ? record.detail : undefined,
    hint: typeof record.hint === "string" ? record.hint : undefined,
    schema: typeof record.schema === "string" ? record.schema : undefined,
    table: typeof record.table === "string" ? record.table : undefined,
    column: typeof record.column === "string" ? record.column : undefined,
    severity: typeof record.severity === "string" ? record.severity : undefined,
    routine: typeof record.routine === "string" ? record.routine : undefined,
  };
}

export function serializeDatabaseError(error: unknown): Record<string, unknown> {
  const err = error instanceof Error ? error : new Error(String(error));
  const cause = (err as Error & { cause?: unknown }).cause;
  const driverError =
    (err as Error & { driverError?: unknown }).driverError ??
  asRecord(cause)?.driverError ??
    cause;

  const pg = {
    ...pickPgFields(err),
    ...pickPgFields(cause),
    ...pickPgFields(driverError),
  };

  return {
    message: err.message,
    stack: err.stack,
    cause:
      cause instanceof Error
        ? { message: cause.message, stack: cause.stack }
        : cause,
    driverError,
    pgCode: pg.code,
    pgDetail: pg.detail,
    pgHint: pg.hint,
    pgSchema: pg.schema,
    pgTable: pg.table,
    pgColumn: pg.column,
    pgSeverity: pg.severity,
    pgRoutine: pg.routine,
  };
}
