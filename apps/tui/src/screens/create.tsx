import type { ScrollBoxRenderable } from "@opentui/core";
import { useEffect, useRef } from "react";

import { Field } from "../components";
import {
  type CreateFocus,
  type CreateFormValues,
  createSizeSummary,
  dockerfileFieldValue,
  imageFieldValue,
  IMAGE_OPTIONS,
  imageOptionIndex,
  SIZE_CHOICES,
  sizePreset,
} from "../create-form";
import { colors } from "../theme";

interface CreateScreenProps {
  values: CreateFormValues;
  focus: CreateFocus;
  imageMenuOpen: boolean;
  imageMenuIndex: number;
  error: string | null;
}

const FOCUS_IDS: Record<CreateFocus, string> = {
  image: "create-image",
  "image-ref": "create-image-ref",
  "image-dockerfile": "create-image-dockerfile",
  size: "create-size",
  "size-cpu": "create-size-cpu",
  "size-memory": "create-size-memory",
  "size-disk": "create-size-disk",
  name: "create-name",
};

const MENU_ROWS = 4;

function focusId(focus: CreateFocus): string {
  return FOCUS_IDS[focus];
}

export function CreateScreen({
  values,
  focus,
  imageMenuOpen,
  imageMenuIndex,
  error,
}: CreateScreenProps) {
  const scrollRef = useRef<ScrollBoxRenderable | null>(null);
  const currentImageIndex = imageOptionIndex(values);
  const menuStart = Math.max(
    0,
    Math.min(imageMenuIndex - Math.floor(MENU_ROWS / 2), IMAGE_OPTIONS.length - MENU_ROWS),
  );
  const menuOptions = IMAGE_OPTIONS.slice(menuStart, menuStart + MENU_ROWS);
  const scrollTarget = imageMenuOpen ? `create-image-option-${imageMenuIndex}` : focusId(focus);

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
              <box flexDirection="column" flexShrink={0}>
                {menuOptions.map((option, index) => {
                  const absoluteIndex = menuStart + index;
                  const isCursor = absoluteIndex === imageMenuIndex;
                  const isCurrent = absoluteIndex === currentImageIndex;
                  return (
                    <box
                      key={option.id}
                      id={`create-image-option-${absoluteIndex}`}
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
                <box id="create-image-dockerfile">
                  <Field
                    label="Dockerfile"
                    value={dockerfileFieldValue(values)}
                    active={focus === "image-dockerfile"}
                    placeholder="path/to/Dockerfile"
                  />
                </box>
                {dockerfileHint ? (
                  <text fg={colors.muted} wrapMode="word">
                    {dockerfileHint}
                  </text>
                ) : null}
              </>
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
                    flexDirection="column"
                    paddingLeft={1}
                    paddingRight={1}
                  >
                    <text fg={tone}>{choice.label}</text>
                    <text fg={tone}>{preset ? `${preset.cpu} vCPU` : "cpu / mem"}</text>
                    <text fg={tone}>{preset ? `${preset.memoryMB / 1024} GB` : "disk"}</text>
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
        </box>
      </box>
    </scrollbox>
  );
}
