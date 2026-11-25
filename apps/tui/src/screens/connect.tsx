import { Field, Panel } from "../components";
import { colors } from "../theme";

export interface ConnectFormState {
  url: string;
  token: string;
}

interface ConnectScreenProps {
  form: ConnectFormState;
  activeField: "url" | "token";
  busy: boolean;
  error: string | null;
  configPath: string;
}

export function ConnectScreen({ form, activeField, busy, error, configPath }: ConnectScreenProps) {
  return (
    <Panel title="Connect to AerolVM" width={74}>
      <text fg={colors.text}>Point lewdev at your AerolVM server and paste an API token.</text>
      <box flexDirection="column" gap={1} paddingTop={1}>
        <Field
          label="API URL"
          value={form.url}
          active={activeField === "url"}
          placeholder="http://127.0.0.1:8080"
        />
        <Field
          label="API token"
          value={form.token}
          active={activeField === "token"}
          masked
          placeholder="avm_…"
        />
      </box>
      <text fg={colors.muted} wrapMode="word">
        The token is hidden while you type. Ctrl+V pastes from the system clipboard. lewdev checks
        the server health before saving.
      </text>
      {busy ? <text fg={colors.accent}>Verifying connection…</text> : null}
      {error ? (
        <text fg={colors.error} wrapMode="word">
          {error}
        </text>
      ) : null}
      <text fg={colors.muted} wrapMode="word">
        Config file: {configPath} (0600)
      </text>
    </Panel>
  );
}
