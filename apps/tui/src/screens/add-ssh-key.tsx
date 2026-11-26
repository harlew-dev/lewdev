import type { PageAction } from "../actions";
import { ActionList, Field, Panel } from "../components";
import { colors } from "../theme";

interface AddSshKeyScreenProps {
  value: string;
  error: string | null;
  actions: PageAction[];
  selectedIndex: number;
}

export function AddSshKeyScreen({ value, error, actions, selectedIndex }: AddSshKeyScreenProps) {
  return (
    <Panel title="Add SSH key" width={84}>
      <text fg={colors.text} wrapMode="word">
        Paste one OpenSSH public key line. It is appended to root&apos;s authorized_keys if it is
        not already there.
      </text>
      <Field
        label="Public key"
        value={value}
        active
        placeholder="ssh-ed25519 AAAA… you@example.com"
      />
      <text fg={colors.muted} wrapMode="word">
        Private keys are never accepted.
      </text>
      {error ? (
        <text fg={colors.error} wrapMode="word">
          {error}
        </text>
      ) : null}
      <ActionList groups={[{ actions }]} selectedIndex={selectedIndex} />
    </Panel>
  );
}
