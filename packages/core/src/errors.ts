import {
  MicroVMApiError,
  MicroVMAuthError,
  MicroVMCapacityError,
  MicroVMConflictError,
  MicroVMNotFoundError,
  MicroVMTimeoutError,
} from "@aerol-ai/aerolvm-sdk";

/** A person-facing, single-line error message. Never includes the API token. */
export function describeError(error: unknown): string {
  if (error instanceof MicroVMApiError) {
    const details = [`HTTP ${error.status}`];
    if (error.code) {
      details.push(error.code);
    }
    const kind =
      error instanceof MicroVMAuthError
        ? "Authentication failed"
        : error instanceof MicroVMNotFoundError
          ? "Not found"
          : error instanceof MicroVMConflictError
            ? "Conflict"
            : error instanceof MicroVMCapacityError
              ? "Server at capacity"
              : error instanceof MicroVMTimeoutError
                ? "Server timed out"
                : "Request failed";
    return `${kind} (${details.join(", ")}): ${error.message}`;
  }

  if (error instanceof Error) {
    const cause = error.cause;
    if (cause instanceof Error && cause.message && cause.message !== error.message) {
      return `${error.message}: ${cause.message}`;
    }
    return error.message;
  }

  return String(error);
}
