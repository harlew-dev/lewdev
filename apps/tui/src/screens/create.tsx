import { Field, Panel } from "../components";
import { colors } from "../theme";

export interface CreateFormValues {
  image: string;
  name: string;
  cpu: string;
  memoryMB: string;
  diskGB: string;
}

export type CreateFieldKey = keyof CreateFormValues;

export const CREATE_DEFAULT: CreateFormValues = {
  image: "ubuntu:24.04",
  name: "",
  cpu: "",
  memoryMB: "",
  diskGB: "",
};

export const CREATE_FIELDS: Array<{
  key: CreateFieldKey;
  label: string;
  placeholder: string;
}> = [
  { key: "image", label: "Image", placeholder: "ubuntu:24.04" },
  { key: "name", label: "Name", placeholder: "optional, unique" },
  { key: "cpu", label: "CPU", placeholder: "server default" },
  { key: "memoryMB", label: "Memory MB", placeholder: "server default" },
  { key: "diskGB", label: "Disk GB", placeholder: "server default" },
];

interface CreateScreenProps {
  values: CreateFormValues;
  activeIndex: number;
  error: string | null;
}

export function CreateScreen({ values, activeIndex, error }: CreateScreenProps) {
  return (
    <Panel title="New sandbox" width={76}>
      <box flexDirection="column" gap={1}>
        {CREATE_FIELDS.map((field, index) => (
          <Field
            key={field.key}
            label={field.label}
            value={values[field.key]}
            active={activeIndex === index}
            placeholder={field.placeholder}
          />
        ))}
      </box>
      <text fg={colors.muted} wrapMode="word">
        Only the image is required. CPU can be fractional (for example 0.5); sizes left blank use
        the server defaults.
      </text>
      {error ? (
        <text fg={colors.error} wrapMode="word">
          {error}
        </text>
      ) : null}
    </Panel>
  );
}
