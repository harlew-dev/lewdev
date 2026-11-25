import type { PortVisibility } from "@lewdev/core";
import type { ScrollBoxRenderable } from "@opentui/core";
import { useEffect, useRef } from "react";

import { Field, FormButton, Panel } from "../components";
import { PORT_VISIBILITY_OPTIONS, visibilityLabel, visibilityOption } from "../port-options";
import { colors } from "../theme";

export interface PortFormValues {
  field: "port" | "visibility" | "submit";
  port: string;
  visibility: PortVisibility;
}

interface OpenPortScreenProps {
  form: PortFormValues;
  visibilityMenuOpen: boolean;
  visibilityMenuIndex: number;
  error: string | null;
}

export function OpenPortScreen({
  form,
  visibilityMenuOpen,
  visibilityMenuIndex,
  error,
}: OpenPortScreenProps) {
  const activeOption = visibilityMenuOpen
    ? (PORT_VISIBILITY_OPTIONS[visibilityMenuIndex] ?? PORT_VISIBILITY_OPTIONS[0])
    : visibilityOption(form.visibility);
  const scrollRef = useRef<ScrollBoxRenderable | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollChildIntoView(`open-port-${form.field}`, { align: "nearest" });
  }, [form.field]);

  return (
    <scrollbox ref={scrollRef} flexGrow={1} flexShrink={1} width="100%" scrollY>
      <Panel title="Open port" width={72}>
        <text fg={colors.text}>Expose a port on the sandbox through the AerolVM gateway.</text>
        <box flexDirection="column" gap={1}>
          <box id="open-port-port">
            <Field
              label="Port"
              value={form.port}
              active={form.field === "port"}
              placeholder="8080"
            />
          </box>
          <box id="open-port-visibility" flexDirection="column" gap={1}>
            <Field
              label="Visibility"
              value={visibilityLabel(form.visibility)}
              active={form.field === "visibility"}
              cursor={false}
              trailing={visibilityMenuOpen ? "▴" : "▾"}
            />
            {visibilityMenuOpen ? (
              <box flexDirection="column" flexShrink={0}>
                {PORT_VISIBILITY_OPTIONS.map((option, index) => {
                  const isCursor = index === visibilityMenuIndex;
                  const isCurrent = option.value === form.visibility;
                  return (
                    <box
                      key={option.value}
                      flexDirection="row"
                      height={1}
                      paddingLeft={1}
                      paddingRight={1}
                      backgroundColor={isCursor ? colors.selection : colors.panelAlt}
                    >
                      <box width={2}>
                        <text fg={isCursor ? colors.accent : colors.muted}>
                          {isCursor ? "›" : " "}
                        </text>
                      </box>
                      <text fg={isCurrent ? colors.accent : colors.text}>{option.label}</text>
                    </box>
                  );
                })}
              </box>
            ) : null}
            <text fg={colors.muted} wrapMode="word">
              {activeOption?.description ?? ""}
            </text>
          </box>
        </box>
        {error ? (
          <text fg={colors.error} wrapMode="word">
            {error}
          </text>
        ) : null}

        <box id="open-port-submit">
          <FormButton label="Open port" active={form.field === "submit"} />
        </box>
      </Panel>
    </scrollbox>
  );
}
