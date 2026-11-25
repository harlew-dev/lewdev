import type { PortVisibility } from "@lewdev/core";

import { Field, Panel } from "../components";
import { colors } from "../theme";

export interface PortFormValues {
  field: "port" | "visibility";
  port: string;
  visibility: PortVisibility;
}

interface OpenPortScreenProps {
  form: PortFormValues;
  error: string | null;
}

export function OpenPortScreen({ form, error }: OpenPortScreenProps) {
  return (
    <scrollbox flexGrow={1} flexShrink={1} width="100%" scrollY>
      <Panel title="Open port" width={72}>
        <text fg={colors.text}>Expose a port on the sandbox through the AerolVM gateway.</text>
        <box flexDirection="column" gap={1}>
          <Field label="Port" value={form.port} active={form.field === "port"} placeholder="8080" />
          <Field
            label="Visibility"
            value={form.visibility}
            active={form.field === "visibility"}
            display={`[ ${form.visibility} ]`}
          />
        </box>
        <text fg={colors.muted} wrapMode="word">
          public serves anyone with the URL; token requires a sandbox token.
        </text>
        {error ? (
          <text fg={colors.error} wrapMode="word">
            {error}
          </text>
        ) : null}
      </Panel>
    </scrollbox>
  );
}
