import type { ScrollBoxRenderable } from "@opentui/core";
import { useEffect, useRef } from "react";

import { DockerfileContents, Field, FormButton, SegmentedRow } from "../components";
import { DOCKERFILE_MODE_CHOICES } from "../create-form";
import {
  type NewSnapshotFocus,
  type NewSnapshotFormValues,
  snapshotSourceLabel,
} from "../snapshot-form";
import { colors } from "../theme";

interface NewSnapshotScreenProps {
  values: NewSnapshotFormValues;
  focus: NewSnapshotFocus;
  error: string | null;
}

const FOCUS_IDS: Record<NewSnapshotFocus, string> = {
  name: "new-snapshot-name",
  source: "new-snapshot-source",
  "image-ref": "new-snapshot-image",
  "dockerfile-mode": "new-snapshot-dockerfile-mode",
  dockerfile: "new-snapshot-dockerfile",
  cpu: "new-snapshot-cpu",
  memory: "new-snapshot-memory",
  disk: "new-snapshot-disk",
  submit: "new-snapshot-submit",
};

export function NewSnapshotScreen({ values, focus, error }: NewSnapshotScreenProps) {
  const scrollRef = useRef<ScrollBoxRenderable | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollChildIntoView(FOCUS_IDS[focus], { align: "nearest" });
  }, [focus]);

  return (
    <scrollbox ref={scrollRef} flexGrow={1} flexShrink={1} width="100%" scrollY>
      <box width="100%" alignItems="center" paddingTop={1} paddingBottom={1}>
        <box
          width={76}
          maxWidth="100%"
          border
          borderStyle="rounded"
          borderColor={colors.border}
          backgroundColor={colors.panel}
          title="New snapshot"
          titleColor={colors.accent}
          flexDirection="column"
          paddingLeft={2}
          paddingRight={2}
          paddingTop={1}
          paddingBottom={1}
          gap={1}
        >
          <box id="new-snapshot-name">
            <Field
              label="Name"
              value={values.name}
              active={focus === "name"}
              placeholder="required, unique"
            />
          </box>

          <box id="new-snapshot-source" flexDirection="column" gap={0}>
            <Field
              label="Source"
              value={snapshotSourceLabel(values.source)}
              active={focus === "source"}
              cursor={false}
              trailing="←/→"
            />
            <text fg={colors.muted}>Register an existing image or build a Dockerfile.</text>
          </box>

          {values.source === "image" ? (
            <box id="new-snapshot-image">
              <Field
                label="Image reference"
                value={values.image}
                active={focus === "image-ref"}
                placeholder="registry/image:tag"
              />
            </box>
          ) : (
            <>
              <box id="new-snapshot-dockerfile-mode">
                <SegmentedRow
                  label="Dockerfile"
                  options={DOCKERFILE_MODE_CHOICES}
                  selected={values.dockerfileMode}
                  active={focus === "dockerfile-mode"}
                />
              </box>
              <box id="new-snapshot-dockerfile">
                {values.dockerfileMode === "file" ? (
                  <Field
                    label="Path"
                    value={values.dockerfilePath}
                    active={focus === "dockerfile"}
                    placeholder="path/to/Dockerfile"
                  />
                ) : (
                  <DockerfileContents
                    contents={values.dockerfileContents}
                    active={focus === "dockerfile"}
                  />
                )}
              </box>
              <text fg={colors.muted} wrapMode="word">
                Built on the server. COPY/ADD of local files needs build-context support on the
                server.
              </text>
            </>
          )}

          <box id="new-snapshot-cpu">
            <Field
              label="CPU"
              value={values.cpu}
              active={focus === "cpu"}
              placeholder="optional, server default"
            />
          </box>
          <box id="new-snapshot-memory">
            <Field
              label="Memory (GB)"
              value={values.memoryGB}
              active={focus === "memory"}
              placeholder="optional, server default"
            />
          </box>
          <box id="new-snapshot-disk">
            <Field
              label="Disk (GB)"
              value={values.diskGB}
              active={focus === "disk"}
              placeholder="optional, server default"
            />
          </box>

          {error ? (
            <text fg={colors.error} wrapMode="word">
              {error}
            </text>
          ) : null}

          <box id="new-snapshot-submit">
            <FormButton label="Register snapshot" active={focus === "submit"} />
          </box>
        </box>
      </box>
    </scrollbox>
  );
}
