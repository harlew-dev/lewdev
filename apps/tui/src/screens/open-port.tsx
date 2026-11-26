import type { PortVisibility } from "@lewdev/core";
import type { ScrollBoxRenderable } from "@opentui/core";
import { useEffect, useRef } from "react";

import { Field, FormButton, Panel } from "../components";
import {
  PORT_PROTOCOL_OPTIONS,
  PORT_VISIBILITY_OPTIONS,
  type PortProtocol,
  protocolLabel,
  protocolOption,
  visibilityLabel,
  visibilityOption,
} from "../port-options";
import { colors } from "../theme";

export interface PortFormValues {
  field: "protocol" | "port" | "visibility" | "submit";
  port: string;
  protocol: PortProtocol;
  visibility: PortVisibility;
}

interface OpenPortScreenProps {
  form: PortFormValues;
  protocolMenuOpen: boolean;
  protocolMenuIndex: number;
  visibilityMenuOpen: boolean;
  visibilityMenuIndex: number;
  error: string | null;
}

export function OpenPortScreen({
  form,
  protocolMenuOpen,
  protocolMenuIndex,
  visibilityMenuOpen,
  visibilityMenuIndex,
  error,
}: OpenPortScreenProps) {
  const activeProtocol = protocolMenuOpen
    ? (PORT_PROTOCOL_OPTIONS[protocolMenuIndex] ?? PORT_PROTOCOL_OPTIONS[0])
    : protocolOption(form.protocol);
  const activeVisibility = visibilityMenuOpen
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
          <box id="open-port-protocol" flexDirection="column" gap={1}>
            <Field
              label="Protocol"
              value={protocolLabel(form.protocol)}
              active={form.field === "protocol"}
              cursor={false}
              trailing={protocolMenuOpen ? "▴" : "▾"}
            />
            {protocolMenuOpen ? (
              <box flexDirection="column" flexShrink={0}>
                {PORT_PROTOCOL_OPTIONS.map((option, index) => {
                  const isCursor = index === protocolMenuIndex;
                  const isCurrent = option.value === form.protocol;
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
              {activeProtocol?.description ?? ""}
            </text>
            {form.protocol === "tcp" ? (
              <text fg={colors.warning} wrapMode="word">
                TCP ports are always public: anyone with the address can connect.
              </text>
            ) : null}
          </box>
          <box id="open-port-port">
            <Field
              label="Port"
              value={form.port}
              active={form.field === "port"}
              placeholder="8080"
            />
          </box>
          {form.protocol === "http" ? (
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
                {activeVisibility?.description ?? ""}
              </text>
            </box>
          ) : null}
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
