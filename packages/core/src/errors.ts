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
    if (error.status === 429 && error.code === "team_quota_exceeded") {
      return "The team quota is full. Delete a sandbox or ask an admin to raise the quota.";
    }
    if (error.status === 429 && error.code === "rate_limited") {
      return "Too many requests. Wait a moment and try again.";
    }
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

/** True when the sandbox runtime does not expose the file toolbox. */
export function isFileAccessUnsupportedError(error: unknown): boolean {
  return error instanceof MicroVMApiError && error.status === 501;
}

/**
 * The file APIs answer 501 on runtimes without a toolbox, such as WASM and
 * isolate sandboxes. Everything else keeps the normal error text.
 */
export function describeFileError(error: unknown): string {
  if (isFileAccessUnsupportedError(error)) {
    return "This sandbox's runtime doesn't support file access.";
  }
  return describeError(error);
}
