import type { SandboxRuntime } from "@lewdev/core";
import type { ScrollBoxRenderable } from "@opentui/core";
import { useEffect, useRef } from "react";

import { FormButton, SegmentedRow } from "../components";
import {
  choiceIdForMS,
  choicesWithCurrent,
  DELETE_IDLE_CHOICES,
  type LifecycleFocus,
  type LifecycleFormValues,
  restartOnFailureAllowed,
  restartUnavailableReason,
  STOP_IDLE_CHOICES,
} from "../lifecycle-form";
import { colors } from "../theme";

interface LifecycleScreenProps {
  label: string;
  values: LifecycleFormValues;
  focus: LifecycleFocus;
  runtime?: SandboxRuntime | "";
  error: string | null;
}

const ON_OFF = [
  { id: "off", label: "Off" },
  { id: "on", label: "On" },
];

const FOCUS_IDS: Record<LifecycleFocus, string> = {
  "stop-idle": "lifecycle-stop-idle",
  "delete-idle": "lifecycle-delete-idle",
  restart: "lifecycle-restart",
  serverless: "lifecycle-serverless",
  submit: "lifecycle-submit",
};

export function LifecycleScreen({ label, values, focus, runtime, error }: LifecycleScreenProps) {
  const scrollRef = useRef<ScrollBoxRenderable | null>(null);
  const stopChoices = choicesWithCurrent(STOP_IDLE_CHOICES, values.stopIdleMS);
  const deleteChoices = choicesWithCurrent(DELETE_IDLE_CHOICES, values.deleteIdleMS);
  const restartAllowed = restartOnFailureAllowed(runtime);

  useEffect(() => {
    scrollRef.current?.scrollChildIntoView(FOCUS_IDS[focus], { align: "nearest" });
  }, [focus]);

  return (
    <scrollbox ref={scrollRef} flexGrow={1} flexShrink={1} width="100%" scrollY>
      <box width="100%" alignItems="center" paddingTop={1} paddingBottom={1}>
        <box
          width={82}
          maxWidth="100%"
          border
          borderStyle="rounded"
          borderColor={colors.border}
          backgroundColor={colors.panel}
          title="Lifecycle"
          titleColor={colors.accent}
          flexDirection="column"
          paddingLeft={2}
          paddingRight={2}
          paddingTop={1}
          paddingBottom={1}
          gap={1}
        >
          <text fg={colors.muted} wrapMode="word">
            Automatic timers for <span fg={colors.text}>{label}</span>. The server checks about once
            a minute.
          </text>

          <box id={FOCUS_IDS["stop-idle"]}>
            <SegmentedRow
              labelWidth={20}
              label="Stop when idle"
              options={stopChoices}
              selected={choiceIdForMS(stopChoices, values.stopIdleMS)}
              active={focus === "stop-idle"}
            />
          </box>

          <box id={FOCUS_IDS["delete-idle"]}>
            <SegmentedRow
              labelWidth={20}
              label="Delete when idle"
              options={deleteChoices}
              selected={choiceIdForMS(deleteChoices, values.deleteIdleMS)}
              active={focus === "delete-idle"}
            />
          </box>

          {restartAllowed ? (
            <box id={FOCUS_IDS.restart}>
              <SegmentedRow
                labelWidth={20}
                label="Restart on failure"
                options={ON_OFF}
                selected={values.restartOnFailure ? "on" : "off"}
                active={focus === "restart"}
              />
            </box>
          ) : (
            <box flexDirection="column" flexShrink={0}>
              <box flexDirection="row" flexShrink={0} gap={1}>
                <box width={20} flexShrink={0}>
                  <text fg={colors.muted}>Restart on failure</text>
                </box>
                <text fg={colors.muted}>Off</text>
              </box>
              <text fg={colors.muted} wrapMode="word">
                {restartUnavailableReason(runtime)}
              </text>
            </box>
          )}

          <box id={FOCUS_IDS.serverless} flexDirection="column" flexShrink={0}>
            <SegmentedRow
              labelWidth={20}
              label="Wake on HTTP"
              options={ON_OFF}
              selected={values.serverless ? "on" : "off"}
              active={focus === "serverless"}
            />
            {values.stopIdleMS === undefined ? (
              <text fg={colors.muted} wrapMode="word">
                Wake on HTTP request needs Stop when idle, because the server must stop it before a
                request can wake it.
              </text>
            ) : null}
          </box>

          {error ? (
            <text fg={colors.error} wrapMode="word">
              {error}
            </text>
          ) : null}

          <box id={FOCUS_IDS.submit}>
            <FormButton label="Save lifecycle" active={focus === "submit"} />
          </box>
        </box>
      </box>
    </scrollbox>
  );
}
