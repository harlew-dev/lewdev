import { Field, FormButton, Panel } from "../components";
import { colors } from "../theme";

export type CreateSnapshotFocus = "name" | "allow-pause" | "submit";

interface CreateSnapshotScreenProps {
  label: string;
  name: string;
  allowPause: boolean;
  focus: CreateSnapshotFocus;
  error: string | null;
}

export function CreateSnapshotScreen({
  label,
  name,
  allowPause,
  focus,
  error,
}: CreateSnapshotScreenProps) {
  return (
    <Panel title="Create snapshot" width={76}>
      <text fg={colors.muted} wrapMode="word">
        Snapshot <span fg={colors.text}>{label}</span>
      </text>
      <Field label="Name" value={name} active={focus === "name"} placeholder="required, unique" />
      <Field
        label="Allow pause"
        value={allowPause ? "on" : "off"}
        active={focus === "allow-pause"}
        cursor={false}
        trailing="space"
      />
      <text fg={colors.muted} wrapMode="word">
        A running sandbox pauses briefly while its disk is copied. Memory, running processes,
        exposed ports and create-time env are not saved.
      </text>
      <text fg={colors.muted} wrapMode="word">
        With pause off, a running sandbox is refused instead of briefly paused.
      </text>

      {error ? (
        <text fg={colors.error} wrapMode="word">
          {error}
        </text>
      ) : null}

      <FormButton label="Create snapshot" active={focus === "submit"} />
    </Panel>
  );
}
