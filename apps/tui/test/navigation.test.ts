import { describe, expect, test } from "bun:test";

import {
  ACCOUNT_PAGE,
  backFromTerminal,
  breadcrumbTrail,
  currentPage,
  nextHomePage,
  pageSandbox,
  type Page,
  popPage,
  pushPage,
  pushSandboxScoped,
  ROOT_PAGE,
  type SandboxPageTarget,
  SNAPSHOTS_PAGE,
} from "../src/navigation";

const myBox: SandboxPageTarget = { id: "sb-1", label: "my-box" };

function stackOf(...pages: Page[]): Page[] {
  return pages.reduce<Page[]>((stack, page) => pushPage(stack, page), [ROOT_PAGE]);
}

describe("page stack", () => {
  test("pushes and pops without mutating the previous stack", () => {
    const root = [ROOT_PAGE];
    const withConnect = pushPage(root, { kind: "connect" });

    expect(root).toHaveLength(1);
    expect(withConnect.map((page) => page.kind)).toEqual(["sandboxes", "connect"]);
    expect(popPage(withConnect).map((page) => page.kind)).toEqual(["sandboxes"]);
  });

  test("popping the root is a no-op", () => {
    expect(popPage([ROOT_PAGE])).toEqual([ROOT_PAGE]);
    expect(popPage([])).toEqual([]);
    expect(currentPage([])).toEqual(ROOT_PAGE);
  });

  test("reports the sandbox target only for sandbox-scoped pages", () => {
    expect(pageSandbox(ROOT_PAGE)).toBeNull();
    expect(pageSandbox(SNAPSHOTS_PAGE)).toBeNull();
    expect(pageSandbox({ kind: "connect" })).toBeNull();
    expect(pageSandbox(ACCOUNT_PAGE)).toBeNull();
    expect(pageSandbox({ kind: "new-sandbox" })).toBeNull();
    expect(pageSandbox({ kind: "new-snapshot" })).toBeNull();
    expect(pageSandbox({ kind: "snapshot", name: "base" })).toBeNull();
    expect(pageSandbox({ kind: "delete-snapshot", name: "base" })).toBeNull();
    expect(pageSandbox({ kind: "sandbox", ...myBox })).toEqual(myBox);
    expect(pageSandbox({ kind: "create-snapshot", ...myBox })).toEqual(myBox);
    expect(pageSandbox({ kind: "confirm-create-snapshot", ...myBox })).toEqual(myBox);
    expect(pageSandbox({ kind: "ssh-terminal", ...myBox })).toEqual(myBox);
    expect(pageSandbox({ kind: "sessions", ...myBox })).toEqual(myBox);
    expect(
      pageSandbox({ kind: "session-log", ...myBox, sessionId: "ses-1", sessionName: "shell" }),
    ).toEqual(myBox);
    expect(
      pageSandbox({ kind: "kill-session", ...myBox, sessionId: "ses-1", sessionName: "shell" }),
    ).toEqual(myBox);
    expect(pageSandbox({ kind: "trust-hosts", ...myBox })).toEqual(myBox);
    expect(pageSandbox({ kind: "forget-host", ...myBox })).toEqual(myBox);
    expect(pageSandbox({ kind: "files", ...myBox })).toEqual(myBox);
    expect(pageSandbox({ kind: "custom-domains", ...myBox })).toEqual(myBox);
    expect(pageSandbox({ kind: "add-custom-domain", ...myBox })).toEqual(myBox);
    expect(
      pageSandbox({ kind: "remove-custom-domain", hostname: "api.example.com", ...myBox }),
    ).toEqual(myBox);
    expect(pageSandbox({ kind: "network-usage", ...myBox })).toEqual(myBox);
    expect(pageSandbox({ kind: "network-limits", ...myBox })).toEqual(myBox);
    expect(pageSandbox({ kind: "audit-log", ...myBox })).toEqual(myBox);
  });

  test("inserts the sandbox page below a sub-page opened from the list", () => {
    const stack = pushSandboxScoped([ROOT_PAGE], { kind: "ports", ...myBox });
    expect(stack.map((page) => page.kind)).toEqual(["sandboxes", "sandbox", "ports"]);
    expect(breadcrumbTrail(stack)).toEqual(["Sandboxes", "my-box", "Ports"]);
  });

  test("does not duplicate the sandbox page when one is already open", () => {
    const existing = stackOf({ kind: "sandbox", ...myBox });
    const stack = pushSandboxScoped(existing, { kind: "ssh-details", ...myBox });
    expect(stack.map((page) => page.kind)).toEqual(["sandboxes", "sandbox", "ssh-details"]);
  });
});

describe("breadcrumbs", () => {
  test("starts with lewdev's root and uses the sandbox label", () => {
    const stack = stackOf(
      { kind: "sandbox", ...myBox },
      { kind: "ports", ...myBox },
      { kind: "open-port", ...myBox },
    );

    expect(breadcrumbTrail(stack)).toEqual(["Sandboxes", "my-box", "Ports", "Open port"]);
  });

  test("names every page kind", () => {
    expect(breadcrumbTrail(stackOf({ kind: "connect" }))).toEqual(["Sandboxes", "Connect"]);
    expect(breadcrumbTrail(stackOf({ kind: "new-sandbox" }))).toEqual(["Sandboxes", "New sandbox"]);
    expect(
      breadcrumbTrail(stackOf({ kind: "sandbox", ...myBox }, { kind: "ssh-details", ...myBox })),
    ).toEqual(["Sandboxes", "my-box", "SSH settings"]);
    expect(
      breadcrumbTrail(stackOf({ kind: "sandbox", ...myBox }, { kind: "delete-sandbox", ...myBox })),
    ).toEqual(["Sandboxes", "my-box", "Delete sandbox"]);
    expect(
      breadcrumbTrail(stackOf({ kind: "sandbox", ...myBox }, { kind: "ssh-terminal", ...myBox })),
    ).toEqual(["Sandboxes", "my-box", "Terminal"]);
    expect(
      breadcrumbTrail(stackOf({ kind: "sandbox", ...myBox }, { kind: "sessions", ...myBox })),
    ).toEqual(["Sandboxes", "my-box", "Sessions"]);
    expect(
      breadcrumbTrail(
        stackOf(
          { kind: "sandbox", ...myBox },
          { kind: "ssh-details", ...myBox },
          { kind: "forget-host", ...myBox },
        ),
      ),
    ).toEqual(["Sandboxes", "my-box", "SSH settings", "Forget host key"]);
    expect(
      breadcrumbTrail(
        stackOf(
          { kind: "sandbox", ...myBox },
          { kind: "ssh-details", ...myBox },
          { kind: "trust-hosts", ...myBox },
        ),
      ),
    ).toEqual(["Sandboxes", "my-box", "SSH settings", "Trust host keys"]);
    expect(
      breadcrumbTrail(
        stackOf(
          { kind: "sandbox", ...myBox },
          { kind: "custom-domains", ...myBox },
          { kind: "add-custom-domain", ...myBox },
        ),
      ),
    ).toEqual(["Sandboxes", "my-box", "Custom domains", "Add domain"]);
    expect(
      breadcrumbTrail(
        stackOf(
          { kind: "sandbox", ...myBox },
          { kind: "network-usage", ...myBox },
          { kind: "network-limits", ...myBox },
        ),
      ),
    ).toEqual(["Sandboxes", "my-box", "Network usage", "Network limits"]);
    expect(
      breadcrumbTrail(stackOf({ kind: "sandbox", ...myBox }, { kind: "audit-log", ...myBox })),
    ).toEqual(["Sandboxes", "my-box", "Audit log"]);
  });

  test("names the Account tab", () => {
    expect(breadcrumbTrail([ACCOUNT_PAGE])).toEqual(["Account"]);
  });

  test("cycles the three home tabs in both directions", () => {
    expect(nextHomePage("sandboxes")).toEqual(SNAPSHOTS_PAGE);
    expect(nextHomePage("snapshots")).toEqual(ACCOUNT_PAGE);
    expect(nextHomePage("account")).toEqual(ROOT_PAGE);
    expect(nextHomePage("sandboxes", -1)).toEqual(ACCOUNT_PAGE);
    expect(nextHomePage("snapshots", -1)).toEqual(ROOT_PAGE);
  });

  test("names the snapshot tab and pages", () => {
    expect(breadcrumbTrail([SNAPSHOTS_PAGE])).toEqual(["Snapshots"]);
    expect(breadcrumbTrail([SNAPSHOTS_PAGE, { kind: "new-snapshot" }])).toEqual([
      "Snapshots",
      "New snapshot",
    ]);
    expect(breadcrumbTrail([SNAPSHOTS_PAGE, { kind: "snapshot", name: "base" }])).toEqual([
      "Snapshots",
      "base",
    ]);
    expect(breadcrumbTrail([SNAPSHOTS_PAGE, { kind: "delete-snapshot", name: "base" }])).toEqual([
      "Snapshots",
      "Delete snapshot",
    ]);
    expect(
      breadcrumbTrail([
        ROOT_PAGE,
        { kind: "sandbox", ...myBox },
        { kind: "create-snapshot", ...myBox },
      ]),
    ).toEqual(["Sandboxes", "my-box", "Create snapshot"]);
    expect(
      breadcrumbTrail([
        ROOT_PAGE,
        { kind: "sandbox", ...myBox },
        { kind: "create-snapshot", ...myBox },
        { kind: "confirm-create-snapshot", ...myBox },
      ]),
    ).toEqual(["Sandboxes", "my-box", "Create snapshot", "Confirm snapshot"]);
  });
});

describe("leaving the terminal", () => {
  test("lands on the existing sandbox page", () => {
    const stack = stackOf({ kind: "sandbox", ...myBox }, { kind: "ssh-terminal", ...myBox });
    expect(backFromTerminal(stack, myBox).map((page) => page.kind)).toEqual([
      "sandboxes",
      "sandbox",
    ]);
  });

  test("pushes a sandbox page when SSH was started from the list", () => {
    const stack = stackOf({ kind: "ssh-terminal", ...myBox });
    expect(backFromTerminal(stack, myBox)).toEqual([ROOT_PAGE, { kind: "sandbox", ...myBox }]);
  });

  test("truncates an intermediate page such as SSH details", () => {
    const stack = stackOf(
      { kind: "sandbox", ...myBox },
      { kind: "ssh-details", ...myBox },
      { kind: "ssh-terminal", ...myBox },
    );
    expect(backFromTerminal(stack, myBox).map((page) => page.kind)).toEqual([
      "sandboxes",
      "sandbox",
    ]);
  });

  test("does not reuse a sandbox page for a different sandbox", () => {
    const other: SandboxPageTarget = { id: "sb-2", label: "other-box" };
    const stack = stackOf({ kind: "sandbox", ...myBox }, { kind: "ssh-terminal", ...other });
    expect(backFromTerminal(stack, other).map((page) => page.kind)).toEqual([
      "sandboxes",
      "sandbox",
      "sandbox",
    ]);
  });
});
