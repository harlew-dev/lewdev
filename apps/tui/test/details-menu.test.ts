import { describe, expect, test } from "bun:test";

import { buildDetailsMenu, detailsSelectionIndex, nextDetailsSelection } from "../src/details-menu";

describe("buildDetailsMenu", () => {
  test("uses the decided action order", () => {
    const menu = buildDetailsMenu({
      status: "started",
      keyAvailable: true,
      sshCommandAvailable: true,
    });
    expect(menu.map((item) => item.id)).toEqual([
      "ssh",
      "ssh-details",
      "ports",
      "toggle",
      "restart",
      "delete",
      "back",
    ]);
    expect(menu.map((item) => item.label)).toEqual([
      "Connect via SSH",
      "View SSH details",
      "Manage ports",
      "Stop",
      "Restart",
      "Delete sandbox",
      "Back",
    ]);
    expect(menu.find((item) => item.id === "delete")?.tone).toBe("error");
    expect(menu.every((item) => item.enabled)).toBe(true);
  });

  test("offers Start and disables SSH and ports while stopped", () => {
    const menu = buildDetailsMenu({
      status: "stopped",
      keyAvailable: true,
      sshCommandAvailable: true,
    });

    expect(menu.find((item) => item.id === "toggle")?.label).toBe("Start");
    expect(menu.find((item) => item.id === "toggle")?.shortcut).toBe("s");
    expect(menu.find((item) => item.id === "ssh")?.enabled).toBe(false);
    expect(menu.find((item) => item.id === "ssh")?.unavailableReason).toBe(
      "The sandbox must be running to connect via SSH.",
    );
    expect(menu.find((item) => item.id === "ports")?.enabled).toBe(false);
    expect(menu.find((item) => item.id === "ports")?.unavailableReason).toBe(
      "Start the sandbox before managing ports.",
    );
    expect(menu.find((item) => item.id === "ssh-details")?.enabled).toBe(true);
  });

  test("disables SSH with the no-key reason", () => {
    const menu = buildDetailsMenu({
      status: "started",
      keyAvailable: false,
      sshCommandAvailable: true,
    });
    const ssh = menu.find((item) => item.id === "ssh");

    expect(ssh?.enabled).toBe(false);
    expect(ssh?.unavailableReason).toBe(
      "No private key is stored for this sandbox. Keys are only available for sandboxes lewdev created.",
    );
    expect(menu.find((item) => item.id === "ssh-details")?.enabled).toBe(true);
  });

  test("disables SSH when no command can be derived", () => {
    const menu = buildDetailsMenu({
      status: "started",
      keyAvailable: true,
      sshCommandAvailable: false,
    });
    expect(menu.find((item) => item.id === "ssh")?.unavailableReason).toBe(
      "The SSH host could not be derived from the configured API URL.",
    );
  });

  test("disables lifecycle actions while the sandbox is transitioning", () => {
    const menu = buildDetailsMenu({
      status: "creating",
      keyAvailable: true,
      sshCommandAvailable: true,
    });

    for (const id of ["toggle", "restart"] as const) {
      const item = menu.find((entry) => entry.id === id);
      expect(item?.enabled).toBe(false);
      expect(item?.unavailableReason).toBe("The sandbox is still starting. Wait for it to finish.");
    }
  });
});

test("disables restart while the sandbox is stopped", () => {
  const menu = buildDetailsMenu({
    status: "stopped",
    keyAvailable: true,
    sshCommandAvailable: true,
  });
  const restart = menu.find((entry) => entry.id === "restart");
  expect(restart?.enabled).toBe(false);
  expect(restart?.unavailableReason).toBe("The sandbox is not running. Use Start instead.");
});

describe("menu selection", () => {
  const menu = buildDetailsMenu({
    status: "started",
    keyAvailable: true,
    sshCommandAvailable: true,
  });

  test("keeps the same action selected after the menu is rebuilt", () => {
    expect(detailsSelectionIndex(menu, "ports")).toBe(2);
    expect(detailsSelectionIndex(menu, "toggle")).toBe(3);
    expect(detailsSelectionIndex(menu, "missing" as never)).toBe(0);
  });

  test("moves and wraps through action ids", () => {
    expect(nextDetailsSelection(menu, 0, 1)).toBe("ssh-details");
    expect(nextDetailsSelection(menu, 0, -1)).toBe("back");
    expect(nextDetailsSelection([], 0, 1)).toBeNull();
  });
});
