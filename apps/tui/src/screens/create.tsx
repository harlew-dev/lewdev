import type { ScrollBoxRenderable } from "@opentui/core";
import { useTerminalDimensions } from "@opentui/react";
import { useEffect, useRef } from "react";

import { DockerfileContents, Field, FormButton, SegmentedRow } from "../components";
import {
  type CreateFocus,
  type CreateFormValues,
  createSizeSummary,
  DOCKERFILE_MODE_CHOICES,
  type ImageOption,
  IMAGE_MENU_OPTIONS,
  imageFieldValue,
  imageOptionIndex,
  SIZE_CHOICES,
  sizePreset,
  snapshotOptionIndex,
  STOP_IDLE_CHOICES,
} from "../create-form";
import { truncate } from "../format";
import { colors } from "../theme";

interface CreateScreenProps {
  values: CreateFormValues;
  focus: CreateFocus;
  imageMenuOpen: boolean;
  imageMenuIndex: number;
  snapshotMenuOpen: boolean;
  snapshotMenuIndex: number;
  snapshotMenuOptions: ImageOption[];
  error: string | null;
}

const FOCUS_IDS: Record<CreateFocus, string> = {
  image: "create-image",
  "image-ref": "create-image-ref",
  "image-dockerfile-mode": "create-image-dockerfile-mode",
  "image-dockerfile": "create-image-dockerfile",
  "image-snapshot": "create-image-snapshot",
  size: "create-size",
  "size-cpu": "create-size-cpu",
  "size-memory": "create-size-memory",
  "size-disk": "create-size-disk",
  "stop-idle": "create-stop-idle",
  name: "create-name",
  submit: "create-submit",
};

const MENU_ROWS = 4;
/** Page padding, card chrome and the menu cursor column around option text. */
const MENU_CHROME = 12;

function focusId(focus: CreateFocus): string {
  return FOCUS_IDS[focus];
}

function OptionMenu({
  idPrefix,
  options,
  start,
  index,
  currentIndex,
  textWidth,
}: {
  idPrefix: string;
  options: ImageOption[];
  start: number;
  index: number;
  currentIndex: number;
  textWidth: number;
}) {
  return (
    <box flexDirection="column" flexShrink={0}>
      {options.slice(start, start + MENU_ROWS).map((option, offset) => {
        const absoluteIndex = start + offset;
        const isCursor = absoluteIndex === index;
        const isCurrent = absoluteIndex === currentIndex;
        const label = truncate(option.label, Math.min(32, textWidth));
        const remaining = textWidth - label.length - 1;
        const detail = option.detail && remaining >= 8 ? truncate(option.detail, remaining) : null;
        return (
          <box
            key={option.id}
            id={`${idPrefix}-${absoluteIndex}`}
            flexDirection="row"
            height={1}
            paddingLeft={1}
            paddingRight={1}
            backgroundColor={isCursor ? colors.selection : colors.panelAlt}
          >
            <box width={2}>
              <text fg={isCursor ? colors.accent : colors.muted}>{isCursor ? "›" : " "}</text>
            </box>
            <text fg={option.disabled ? colors.muted : isCurrent ? colors.accent : colors.text}>
              {label}
            </text>
            {detail ? <text fg={colors.muted}> {detail}</text> : null}
          </box>
        );
      })}
    </box>
  );
}

export function CreateScreen({
  values,
  focus,
  imageMenuOpen,
  imageMenuIndex,
  snapshotMenuOpen,
  snapshotMenuIndex,
  snapshotMenuOptions,
  error,
}: CreateScreenProps) {
  const scrollRef = useRef<ScrollBoxRenderable | null>(null);
  const { width } = useTerminalDimensions();
  const menuTextWidth = Math.max(16, width - MENU_CHROME);
  const currentImageIndex = imageOptionIndex(values);
  const menuStart = Math.max(
    0,
    Math.min(imageMenuIndex - Math.floor(MENU_ROWS / 2), IMAGE_MENU_OPTIONS.length - MENU_ROWS),
  );
  const currentSnapshotIndex = snapshotOptionIndex(values.snapshotName, snapshotMenuOptions);
  const snapshotMenuStart = Math.max(
    0,
    Math.min(snapshotMenuIndex - Math.floor(MENU_ROWS / 2), snapshotMenuOptions.length - MENU_ROWS),
  );
  const scrollTarget = imageMenuOpen
    ? `create-image-option-${imageMenuIndex}`
    : snapshotMenuOpen
      ? `create-snapshot-option-${snapshotMenuIndex}`
      : focusId(focus);

  useEffect(() => {
    scrollRef.current?.scrollChildIntoView(scrollTarget, { align: "nearest" });
  }, [scrollTarget]);

  const imageValue = imageFieldValue(values);
  const dockerfileHint =
    values.imageSource === "dockerfile" &&
    "Built on the server. COPY/ADD of local files needs build-context support on the server.";

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
          title="New sandbox"
          titleColor={colors.accent}
          flexDirection="column"
          paddingLeft={2}
          paddingRight={2}
          paddingTop={1}
          paddingBottom={1}
          gap={1}
        >
          <box id="create-image" flexDirection="column" gap={1}>
            <Field
              label="Image"
              value={imageValue}
              active={focus === "image"}
              cursor={false}
              trailing={imageMenuOpen ? "▴" : "▾"}
            />

            {imageMenuOpen ? (
              <OptionMenu
                idPrefix="create-image-option"
                options={IMAGE_MENU_OPTIONS}
                start={menuStart}
                index={imageMenuIndex}
                currentIndex={currentImageIndex}
                textWidth={menuTextWidth}
              />
            ) : null}

            {values.imageSource === "custom" ? (
              <box id="create-image-ref">
                <Field
                  label="Reference"
                  value={values.customImage}
                  active={focus === "image-ref"}
                  placeholder="any image reference"
                />
              </box>
            ) : null}

            {values.imageSource === "dockerfile" ? (
              <>
                <box id="create-image-dockerfile-mode">
                  <SegmentedRow
                    label="Dockerfile"
                    options={DOCKERFILE_MODE_CHOICES}
                    selected={values.dockerfileMode}
                    active={focus === "image-dockerfile-mode"}
                  />
                </box>
                <box id="create-image-dockerfile">
                  {values.dockerfileMode === "file" ? (
                    <Field
                      label="Path"
                      value={values.dockerfilePath}
                      active={focus === "image-dockerfile"}
                      placeholder="path/to/Dockerfile"
                    />
                  ) : (
                    <DockerfileContents
                      contents={values.dockerfileContents}
                      active={focus === "image-dockerfile"}
                    />
                  )}
                </box>
                {dockerfileHint ? (
                  <text fg={colors.muted} wrapMode="word">
                    {dockerfileHint}
                  </text>
                ) : null}
              </>
            ) : null}

            {values.imageSource === "snapshot" ? (
              <box id="create-image-snapshot" flexDirection="column" gap={1}>
                <Field
                  label="Snapshot"
                  value={values.snapshotName}
                  active={focus === "image-snapshot"}
                  cursor={false}
                  trailing={snapshotMenuOpen ? "▴" : "▾"}
                  placeholder="choose a snapshot"
                />
                {snapshotMenuOpen ? (
                  <OptionMenu
                    idPrefix="create-snapshot-option"
                    options={snapshotMenuOptions}
                    start={snapshotMenuStart}
                    index={snapshotMenuIndex}
                    currentIndex={currentSnapshotIndex}
                    textWidth={menuTextWidth}
                  />
                ) : null}
              </box>
            ) : null}
          </box>

          <box id="create-size" flexDirection="column" gap={0}>
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
                {createSizeSummary(values)}
              </text>
            </box>
          </box>

          {values.size === "custom" ? (
            <>
              <box id="create-size-cpu">
                <Field
                  label="CPU"
                  value={values.customCpu}
                  active={focus === "size-cpu"}
                  placeholder="server default"
                />
              </box>
              <box id="create-size-memory">
                <Field
                  label="Memory (GB)"
                  value={values.customMemoryGB}
                  active={focus === "size-memory"}
                  placeholder="server default"
                />
              </box>
              <box id="create-size-disk">
                <Field
                  label="Disk (GB)"
                  value={values.customDiskGB}
                  active={focus === "size-disk"}
                  placeholder="server default"
                />
              </box>
            </>
          ) : null}

          <box id="create-stop-idle">
            <SegmentedRow
              label="Stop when idle"
              options={STOP_IDLE_CHOICES}
              selected={values.stopIdle}
              active={focus === "stop-idle"}
            />
          </box>

          <box id="create-name">
            <Field
              label="Name"
              value={values.name}
              active={focus === "name"}
              placeholder="optional, unique"
            />
          </box>

          {error ? (
            <text fg={colors.error} wrapMode="word">
              {error}
            </text>
          ) : null}

          <box id="create-submit">
            <FormButton label="Create sandbox" active={focus === "submit"} />
          </box>
        </box>
      </box>
    </scrollbox>
  );
}
