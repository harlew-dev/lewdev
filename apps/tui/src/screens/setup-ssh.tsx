import {
  DIRECT_SSH_STEPS,
  type DirectSshMode,
  type DirectSshSetupResult,
  type DirectSshStepId,
  type DirectSshStepStatus,
} from "@lewdev/core";

import type { PageAction } from "../actions";
import { ActionList, Panel } from "../components";
import { colors } from "../theme";

export interface SetupStepState {
  status: DirectSshStepStatus | "pending";
  message?: string;
}

export type SetupSteps = Record<DirectSshStepId, SetupStepState>;

interface SetupSshScreenProps {
  steps: SetupSteps;
  mode: DirectSshMode;
  running: boolean;
  error: string | null;
  result: DirectSshSetupResult | null;
  actions: PageAction[];
  selectedIndex: number;
}

function stepColor(status: SetupStepState["status"]): string {
  switch (status) {
    case "done":
      return colors.success;
    case "running":
      return colors.accent;
    case "error":
      return colors.error;
    case "skipped":
      return colors.muted;
    default:
      return colors.muted;
  }
}

function stepMark(status: SetupStepState["status"]): string {
  switch (status) {
    case "done":
      return "✓";
    case "running":
      return "…";
    case "error":
      return "✕";
    case "skipped":
      return "–";
    default:
      return "·";
  }
}

export function SetupSshScreen({
  steps,
  mode,
  running,
  error,
  result,
  actions,
  selectedIndex,
}: SetupSshScreenProps) {
  return (
    <scrollbox flexGrow={1} flexShrink={1} width="100%" scrollY>
      <Panel title="Set up SSH" width={82}>
        <text fg={colors.text} wrapMode="word">
          {result
            ? `Direct SSH is ready in ${result.mode} mode. Run Repair SSH from Advanced in SSH settings whenever SSH stops working.`
            : "Choose private SSH (recommended: no exposed port, through the AerolVM API) or public SSH (TCP port 22 on the internet, key-only). It is safe to re-run; every step repairs only what is missing."}
        </text>
        <box flexDirection="column" flexShrink={0} gap={0}>
          {DIRECT_SSH_STEPS.filter((step) => !("publicOnly" in step) || mode === "public").map(
            (step, index) => {
              const state = steps[step.id];
              return (
                <box key={step.id} flexDirection="column" flexShrink={0}>
                  <box flexDirection="row" flexShrink={0}>
                    <box width={3}>
                      <text fg={stepColor(state.status)}>{stepMark(state.status)}</text>
                    </box>
                    <text fg={state.status === "pending" ? colors.muted : colors.text}>
                      {index + 1}. {step.title}
                    </text>
                  </box>
                  {state.message ? (
                    <box paddingLeft={3}>
                      <text
                        fg={state.status === "error" ? colors.error : colors.muted}
                        wrapMode="word"
                      >
                        {state.message}
                      </text>
                    </box>
                  ) : null}
                </box>
              );
            },
          )}
        </box>
        {running ? (
          <text fg={colors.accent} wrapMode="word">
            Running the next step…
          </text>
        ) : null}
        {error ? (
          <text fg={colors.error} wrapMode="word">
            {error}
          </text>
        ) : null}
        {result ? (
          <box flexDirection="column" flexShrink={0}>
            <text fg={colors.text} wrapMode="word">
              <span fg={colors.accent}>{result.alias}</span> →{" "}
              {result.mode === "private"
                ? "private via the AerolVM API"
                : `${result.host}:${result.port}`}
            </text>
            <text fg={colors.muted} wrapMode="word">
              Key: {result.keyPath}
            </text>
            <text fg={colors.muted} wrapMode="word">
              Config: {result.sshConfigPath}
            </text>
            {result.includePresent ? null : (
              <text fg={colors.warning} wrapMode="word">
                ~/.ssh/config has no lewdev Include, so VS Code Remote-SSH and the short ssh alias
                will not work. Use "Copy SSH command" on the sandbox page for an explicit command,
                or choose "Open in VS Code" again to add the Include.
              </text>
            )}
          </box>
        ) : null}
        <ActionList groups={[{ actions }]} selectedIndex={selectedIndex} />
      </Panel>
    </scrollbox>
  );
}
