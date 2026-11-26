export interface SandboxPageTarget {
  id: string;
  label: string;
}

export type Page =
  | { kind: "sandboxes" }
  | { kind: "snapshots" }
  | { kind: "connect" }
  | { kind: "new-sandbox" }
  | { kind: "new-snapshot" }
  | { kind: "snapshot"; name: string }
  | { kind: "delete-snapshot"; name: string }
  | ({ kind: "create-snapshot" } & SandboxPageTarget)
  | ({ kind: "sandbox" } & SandboxPageTarget)
  | ({ kind: "ssh-details" } & SandboxPageTarget)
  | ({ kind: "ports" } & SandboxPageTarget)
  | ({ kind: "open-port" } & SandboxPageTarget)
  | ({ kind: "delete-sandbox" } & SandboxPageTarget)
  | ({ kind: "forget-host" } & SandboxPageTarget)
  | ({ kind: "ssh-terminal" } & SandboxPageTarget);

export const ROOT_PAGE: Page = { kind: "sandboxes" };
export const SNAPSHOTS_PAGE: Page = { kind: "snapshots" };

const CRUMB_LABELS: Record<Page["kind"], string | null> = {
  sandboxes: "Sandboxes",
  snapshots: "Snapshots",
  connect: "Connect",
  "new-sandbox": "New sandbox",
  "new-snapshot": "New snapshot",
  snapshot: null,
  "delete-snapshot": "Delete snapshot",
  "create-snapshot": "Create snapshot",
  sandbox: null,
  "ssh-details": "Settings",
  ports: "Ports",
  "open-port": "Open port",
  "delete-sandbox": "Delete sandbox",
  "forget-host": "Forget host key",
  "ssh-terminal": "SSH terminal",
};

export function currentPage(stack: Page[]): Page {
  return stack[stack.length - 1] ?? ROOT_PAGE;
}

export function pushPage(stack: Page[], page: Page): Page[] {
  return [...stack, page];
}

/** Removes the top page. Popping the root is a no-op. */
export function popPage(stack: Page[]): Page[] {
  return stack.length <= 1 ? stack : stack.slice(0, -1);
}

/**
 * Pushes a sandbox-scoped page. From the list this inserts the sandbox page
 * underneath so breadcrumbs name the sandbox and esc lands on it.
 */
export function pushSandboxScoped(stack: Page[], next: Page): Page[] {
  const target = pageSandbox(next);
  if (currentPage(stack).kind === "sandboxes" && target) {
    return pushPage(pushPage(stack, { kind: "sandbox", ...target }), next);
  }
  return pushPage(stack, next);
}

/** Every sandbox-scoped page carries the sandbox target; the others do not. */
export function pageSandbox(page: Page): SandboxPageTarget | null {
  switch (page.kind) {
    case "sandboxes":
    case "snapshots":
    case "connect":
    case "new-sandbox":
    case "new-snapshot":
    case "snapshot":
    case "delete-snapshot":
      return null;
    default:
      return { id: page.id, label: page.label };
  }
}

export function breadcrumbTrail(stack: Page[]): string[] {
  return stack.map((page) => {
    if (page.kind === "sandbox") {
      return page.label;
    }
    if (page.kind === "snapshot") {
      return page.name;
    }
    return CRUMB_LABELS[page.kind] ?? page.kind;
  });
}

/**
 * Leaves the SSH terminal and lands on the sandbox page for that sandbox. If
 * the stack has no sandbox page, one is pushed so the user always ends up
 * where the session belongs.
 */
export function backFromTerminal(stack: Page[], target: SandboxPageTarget): Page[] {
  const popped = popPage(stack);
  const top = popped[popped.length - 1];
  if (top?.kind === "sandbox" && top.id === target.id) {
    return popped;
  }
  const index = popped.findIndex((page) => page.kind === "sandbox" && page.id === target.id);
  if (index >= 0) {
    return popped.slice(0, index + 1);
  }
  return pushPage(popped, { kind: "sandbox", ...target });
}
