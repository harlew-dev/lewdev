import { describe, expect, test } from "bun:test";

import {
  backFromTerminal,
  breadcrumbTrail,
  currentPage,
  pageSandbox,
  type Page,
  popPage,
  pushPage,
  pushSandboxScoped,
  ROOT_PAGE,
  type SandboxPageTarget,
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
    expect(pageSandbox({ kind: "connect" })).toBeNull();
    expect(pageSandbox({ kind: "new-sandbox" })).toBeNull();
    expect(pageSandbox({ kind: "sandbox", ...myBox })).toEqual(myBox);
    expect(pageSandbox({ kind: "ssh-terminal", ...myBox })).toEqual(myBox);
    expect(pageSandbox({ kind: "forget-host", ...myBox })).toEqual(myBox);
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
    ).toEqual(["Sandboxes", "my-box", "Settings"]);
    expect(
      breadcrumbTrail(stackOf({ kind: "sandbox", ...myBox }, { kind: "delete-sandbox", ...myBox })),
    ).toEqual(["Sandboxes", "my-box", "Delete sandbox"]);
    expect(
      breadcrumbTrail(stackOf({ kind: "sandbox", ...myBox }, { kind: "ssh-terminal", ...myBox })),
    ).toEqual(["Sandboxes", "my-box", "SSH terminal"]);
    expect(
      breadcrumbTrail(
        stackOf(
          { kind: "sandbox", ...myBox },
          { kind: "ssh-details", ...myBox },
          { kind: "forget-host", ...myBox },
        ),
      ),
    ).toEqual(["Sandboxes", "my-box", "Settings", "Forget host key"]);
  });
});

describe("leaving the SSH terminal", () => {
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
