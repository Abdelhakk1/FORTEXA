export type ResultCode =
  | "validation_error"
  | "unauthenticated"
  | "forbidden"
  | "not_found"
  | "server_error"
  | "service_unavailable";

export interface FieldErrors {
  [field: string]: string[] | undefined;
}

export type ActionResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      code: ResultCode;
      message: string;
      fieldErrors?: FieldErrors;
    };

export class AppError extends Error {
  constructor(
    public readonly code: ResultCode,
    message: string,
    public readonly fieldErrors?: FieldErrors
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

export function err<T>(
  code: ResultCode,
  message: string,
  fieldErrors?: FieldErrors
): ActionResult<T> {
  return {
    ok: false,
    code,
    message,
    ...(fieldErrors ? { fieldErrors } : {}),
  };
}

export function toActionResult<T>(error: unknown): ActionResult<T> {
  if (error instanceof AppError) {
    return err(error.code, error.message, error.fieldErrors);
  }

  return err(
    "server_error",
    "An unexpected server error occurred. Please try again."
  );
}
