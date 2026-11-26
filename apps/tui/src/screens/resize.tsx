import type { ScrollBoxRenderable } from "@opentui/core";
import { useEffect, useRef } from "react";

import { Field, FormButton } from "../components";
import { SIZE_CHOICES, sizePreset } from "../create-form";
import { type ResizeFocus, type ResizeFormValues, resizeSummary } from "../resize-form";
import { colors } from "../theme";

interface ResizeScreenProps {
  label: string;
  values: ResizeFormValues;
  focus: ResizeFocus;
  error: string | null;
}

const FOCUS_IDS: Record<ResizeFocus, string> = {
  size: "resize-size",
  "size-cpu": "resize-size-cpu",
  "size-memory": "resize-size-memory",
  "size-disk": "resize-size-disk",
  submit: "resize-submit",
};

export function ResizeScreen({ label, values, focus, error }: ResizeScreenProps) {
  const scrollRef = useRef<ScrollBoxRenderable | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollChildIntoView(FOCUS_IDS[focus], { align: "nearest" });
  }, [focus]);

  return (
    <scrollbox ref={scrollRef} flexGrow={1} flexShrink={1} width="100%" scrollY>
      <box width="100%" alignItems="center" paddingTop={1} paddingBottom={1}>
        <box
          width={86}
          maxWidth="100%"
          border
          borderStyle="rounded"
          borderColor={colors.border}
          backgroundColor={colors.panel}
          title="Resize sandbox"
          titleColor={colors.accent}
          flexDirection="column"
          paddingLeft={2}
          paddingRight={2}
          paddingTop={1}
          paddingBottom={1}
          gap={1}
        >
          <text fg={colors.muted} wrapMode="word">
            New size for <span fg={colors.text}>{label}</span>. The server applies what it can; if
            it refuses, the error appears here and nothing changes.
          </text>

          <box id={FOCUS_IDS.size} flexDirection="column" gap={0}>
            <box flexDirection="row" height={1}>
              <box width={14} flexShrink={0}>
                <text fg={focus === "size" ? colors.accent : colors.muted}>Size</text>
              </box>
              <text fg={colors.muted}>←/→ changes the preset</text>
            </box>
            <box flexDirection="row" gap={1} paddingTop={1}>
              {SIZE_CHOICES.map((choice) => {
                const preset = sizePreset(choice.id);
                const selected = values.size === choice.id;
                const tone = selected ? colors.accent : colors.muted;
                return (
                  <box
                    key={choice.id}
                    width={13}
                    flexShrink={0}
                    border
                    borderStyle="rounded"
                    borderColor={selected ? colors.accent : colors.border}
                    title={choice.label}
                    titleColor={tone}
                    flexDirection="column"
                  >
                    <text fg={tone}>{preset ? `${preset.cpu} vCPU` : "cpu / mem"}</text>
                    <text fg={tone}>{preset ? `${preset.memoryMB / 1024} GB` : "disk"}</text>
                    {preset ? <text fg={tone}>{preset.diskGB} GB disk</text> : null}
                  </box>
                );
              })}
            </box>
            <box paddingTop={1}>
              <text fg={colors.muted} wrapMode="word">
                {resizeSummary(values)}
              </text>
            </box>
          </box>

          {values.size === "custom" ? (
            <>
              <box id={FOCUS_IDS["size-cpu"]}>
                <Field
                  label="CPU"
                  value={values.customCpu}
                  active={focus === "size-cpu"}
                  placeholder="leave blank to keep it"
                />
              </box>
              <box id={FOCUS_IDS["size-memory"]}>
                <Field
                  label="Memory (GB)"
                  value={values.customMemoryGB}
                  active={focus === "size-memory"}
                  placeholder="leave blank to keep it"
                />
              </box>
              <box id={FOCUS_IDS["size-disk"]}>
                <Field
                  label="Disk (GB)"
                  value={values.customDiskGB}
                  active={focus === "size-disk"}
                  placeholder="leave blank to keep it"
                />
              </box>
            </>
          ) : null}

          {error ? (
            <text fg={colors.error} wrapMode="word">
              {error}
            </text>
          ) : null}

          <box id={FOCUS_IDS.submit}>
            <FormButton label="Resize" active={focus === "submit"} />
          </box>
        </box>
      </box>
    </scrollbox>
  );
}
