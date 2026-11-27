import type { NetworkUsageInfo } from "@lewdev/core";
import type { ScrollBoxRenderable } from "@opentui/core";
import { useEffect, useRef } from "react";

import {
  formatBytes,
  type LimitUnit,
  type NetworkLimitsFocus,
  type NetworkLimitsValues,
} from "../network-form";
import { Field, FormButton, Panel, SegmentedRow } from "../components";
import { colors } from "../theme";

const UNIT_OPTIONS: ReadonlyArray<{ id: LimitUnit; label: string }> = [
  { id: "none", label: "No limit" },
  { id: "MB", label: "MB" },
  { id: "GB", label: "GB" },
];

interface NetworkLimitsScreenProps {
  values: NetworkLimitsValues;
  focus: NetworkLimitsFocus;
  usage: NetworkUsageInfo | null;
  warning: string | null;
  error: string | null;
}

export function NetworkLimitsScreen({
  values,
  focus,
  usage,
  warning,
  error,
}: NetworkLimitsScreenProps) {
  const scrollRef = useRef<ScrollBoxRenderable | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollChildIntoView(`network-limits-${focus}`, { align: "nearest" });
  }, [focus]);

  return (
    <scrollbox ref={scrollRef} flexGrow={1} flexShrink={1} width="100%" scrollY>
      <Panel title="Set network limits" width={76}>
        <text fg={colors.text} wrapMode="word">
          Cap the bytes this sandbox receives and sends. Choose No limit to remove a cap.
        </text>
        {usage ? (
          <text fg={colors.muted} wrapMode="word">
            Current traffic: {formatBytes(usage.bytesIn)} in, {formatBytes(usage.bytesOut)} out.
          </text>
        ) : null}

        <box id="network-limits-in-value" flexDirection="column" flexShrink={0}>
          <Field
            label="Inbound limit"
            value={values.inbound.value}
            display={values.inbound.unit === "none" ? "No limit" : undefined}
            active={focus === "in-value"}
            placeholder="1024"
          />
        </box>
        <box id="network-limits-in-unit">
          <SegmentedRow
            label="Inbound unit"
            options={UNIT_OPTIONS}
            selected={values.inbound.unit}
            active={focus === "in-unit"}
            labelWidth={14}
          />
        </box>

        <box id="network-limits-out-value" flexDirection="column" flexShrink={0}>
          <Field
            label="Outbound limit"
            value={values.outbound.value}
            display={values.outbound.unit === "none" ? "No limit" : undefined}
            active={focus === "out-value"}
            placeholder="1024"
          />
        </box>
        <box id="network-limits-out-unit">
          <SegmentedRow
            label="Outbound unit"
            options={UNIT_OPTIONS}
            selected={values.outbound.unit}
            active={focus === "out-unit"}
            labelWidth={14}
          />
        </box>

        {warning ? (
          <text fg={colors.warning} wrapMode="word">
            {warning}
          </text>
        ) : null}
        {error ? (
          <text fg={colors.error} wrapMode="word">
            {error}
          </text>
        ) : null}

        <box id="network-limits-submit">
          <FormButton label="Save limits" active={focus === "submit"} />
        </box>
      </Panel>
    </scrollbox>
  );
}
