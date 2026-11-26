import { describe, expect, test } from "bun:test";

import {
  choiceIdForMS,
  choicesWithCurrent,
  DELETE_IDLE_CHOICES,
  describeLifecycle,
  lifecycleFormFromDetails,
  lifecycleUpdateInput,
  moveLifecycleChoice,
  nextLifecycleFocus,
  restartOnFailureAllowed,
  restartUnavailableReason,
  STOP_IDLE_CHOICES,
  validateLifecycleForm,
} from "../src/lifecycle-form";

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

describe("lifecycle choices", () => {
  test("offers the stop and delete presets", () => {
    expect(STOP_IDLE_CHOICES.map((choice) => choice.label)).toEqual([
      "Off",
      "15m",
      "30m",
      "1h",
      "2h",
      "4h",
    ]);
    expect(DELETE_IDLE_CHOICES.map((choice) => choice.label)).toEqual([
      "Off",
      "1d",
      "3d",
      "7d",
      "30d",
    ]);
  });

  test("adds a current value that is not a preset instead of clearing it", () => {
    const choices = choicesWithCurrent(STOP_IDLE_CHOICES, 45 * MINUTE);
    expect(choices.at(-1)).toEqual({ id: `current-${45 * MINUTE}`, label: "45m", ms: 45 * MINUTE });
    expect(choicesWithCurrent(STOP_IDLE_CHOICES, 30 * MINUTE)).toBe(STOP_IDLE_CHOICES);
    expect(choiceIdForMS(choices, 45 * MINUTE)).toBe(`current-${45 * MINUTE}`);
    expect(choiceIdForMS(choices, undefined)).toBe("off");
  });

  test("moves and wraps through the choices", () => {
    expect(moveLifecycleChoice(STOP_IDLE_CHOICES, undefined, 1)).toBe(15 * MINUTE);
    expect(moveLifecycleChoice(STOP_IDLE_CHOICES, 4 * HOUR, 1)).toBeUndefined();
    expect(moveLifecycleChoice(STOP_IDLE_CHOICES, undefined, -1)).toBe(4 * HOUR);
  });
});

describe("lifecycle form", () => {
  test("seeds the form and preserves timers the page does not edit", () => {
    const values = lifecycleFormFromDetails({
      stopIfIdleForMS: 30 * MINUTE,
      destroyIfIdleForMS: 3 * DAY,
      stopAtAgeMS: 2 * HOUR,
      destroyAtAgeMS: 7 * DAY,
      destroyAfterExitForMS: 10 * MINUTE,
      serverless: true,
      restartOnFailure: true,
    });
    expect(values).toEqual({
      stopIdleMS: 30 * MINUTE,
      deleteIdleMS: 3 * DAY,
      serverless: true,
      restartOnFailure: true,
      preserved: {
        stopAtAgeMS: 2 * HOUR,
        destroyAtAgeMS: 7 * DAY,
        destroyAfterExitForMS: 10 * MINUTE,
      },
    });

    const update = lifecycleUpdateInput({ ...values, stopIdleMS: 15 * MINUTE });
    expect(update).toEqual({
      stopAtAgeMS: 2 * HOUR,
      destroyAtAgeMS: 7 * DAY,
      destroyAfterExitForMS: 10 * MINUTE,
      stopIfIdleForMS: 15 * MINUTE,
      destroyIfIdleForMS: 3 * DAY,
      serverless: true,
      restartOnFailure: true,
    });
  });

  test("turns a cleared timer off in the replacement payload", () => {
    const values = lifecycleFormFromDetails({
      stopIfIdleForMS: 30 * MINUTE,
      destroyIfIdleForMS: DAY,
      serverless: true,
    });
    const update = lifecycleUpdateInput({ ...values, stopIdleMS: undefined, serverless: false });
    expect(update).not.toHaveProperty("stopIfIdleForMS");
    expect(update).not.toHaveProperty("stopAtAgeMS");
    expect(update.destroyIfIdleForMS).toBe(DAY);
  });

  test("validates delete and wake ordering", () => {
    expect(
      validateLifecycleForm({
        stopIdleMS: HOUR,
        deleteIdleMS: 30 * MINUTE,
        serverless: false,
        restartOnFailure: false,
        preserved: {},
      }),
    ).toBe("Delete when idle must be at least as long as Stop when idle.");
    expect(
      validateLifecycleForm({
        serverless: true,
        restartOnFailure: false,
        preserved: {},
      }),
    ).toBe("Wake on HTTP request needs Stop when idle.");
    expect(
      validateLifecycleForm({
        stopIdleMS: 30 * MINUTE,
        deleteIdleMS: DAY,
        serverless: true,
        restartOnFailure: true,
        preserved: {},
      }),
    ).toBeNull();
  });

  test("skips restart on unsupported runtimes and wake without a stop timer", () => {
    const noStop = lifecycleFormFromDetails({});
    expect(nextLifecycleFocus(noStop, "docker", "delete-idle", 1)).toBe("restart");
    expect(nextLifecycleFocus(noStop, "docker", "restart", 1)).toBe("submit");
    expect(nextLifecycleFocus(noStop, "firecracker", "delete-idle", 1)).toBe("submit");

    const withStop = lifecycleFormFromDetails({ stopIfIdleForMS: 30 * MINUTE });
    expect(nextLifecycleFocus(withStop, "docker", "restart", 1)).toBe("serverless");
    expect(nextLifecycleFocus(withStop, "wasm", "delete-idle", 1)).toBe("serverless");

    expect(restartOnFailureAllowed("docker")).toBe(true);
    expect(restartOnFailureAllowed("gvisor")).toBe(true);
    expect(restartOnFailureAllowed("")).toBe(true);
    expect(restartOnFailureAllowed("firecracker")).toBe(false);
    expect(restartOnFailureAllowed("wasm")).toBe(false);
    expect(restartOnFailureAllowed("isolate")).toBe(false);
    expect(restartUnavailableReason("wasm")).toContain("wasm");
  });

  test("summarizes the timers in plain language", () => {
    expect(describeLifecycle({})).toBe("No automatic stop or delete.");
    expect(
      describeLifecycle({
        stopIfIdleForMS: 30 * MINUTE,
        destroyIfIdleForMS: DAY,
        serverless: true,
        restartOnFailure: true,
      }),
    ).toBe("Stops after 30m idle; deletes after 1d idle; wakes on HTTP; restarts on failure.");
  });
});
