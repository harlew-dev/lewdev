export class SandboxResolutionError extends Error {
  override name = "SandboxResolutionError";
}

/**
 * Resolves a command-line sandbox reference by exact ID first, then by exact
 * name. Names are not required to be unique, so an ambiguous name is an error
 * instead of a guess.
 */
export function resolveSandbox<T extends { id: string; name?: string }>(
  sandboxes: readonly T[],
  query: string,
): T {
  const byId = sandboxes.find((sandbox) => sandbox.id === query);
  if (byId) {
    return byId;
  }

  const byName = sandboxes.filter(
    (sandbox) => sandbox.name !== undefined && sandbox.name.length > 0 && sandbox.name === query,
  );
  const only = byName[0];
  if (byName.length === 1 && only) {
    return only;
  }
  if (byName.length === 0) {
    throw new SandboxResolutionError(
      `No sandbox matches "${query}". Run \`lewdev ls\` to list sandboxes.`,
    );
  }
  const ids = byName.map((sandbox) => sandbox.id).join(", ");
  throw new SandboxResolutionError(
    `Several sandboxes are named "${query}": ${ids}. Use the sandbox ID instead.`,
  );
}
