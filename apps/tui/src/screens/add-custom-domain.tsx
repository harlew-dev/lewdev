import type { DnsRecordInfo, IngressTargetInfo } from "@lewdev/core";
import type { ScrollBoxRenderable } from "@opentui/core";
import { useEffect, useRef } from "react";

import type { CustomDomainField, CustomDomainFormValues } from "../domain-form";
import { Field, FormButton, Panel } from "../components";
import { colors } from "../theme";

interface AddCustomDomainScreenProps {
  values: CustomDomainFormValues;
  focus: CustomDomainField;
  added: boolean;
  records: DnsRecordInfo[];
  target: IngressTargetInfo | null;
  recordsLoading: boolean;
  recordsError: string | null;
  error: string | null;
}

function RecordRow({ record }: { record: DnsRecordInfo }) {
  return (
    <box flexDirection="column" flexShrink={0} paddingBottom={1}>
      <box flexDirection="row" gap={1}>
        <text selectable>
          <span fg={colors.muted}>{record.type}</span>
          <span fg={colors.text}> {record.name}</span>
          <span fg={colors.muted}> for {record.hostname}</span>
        </text>
      </box>
      <text fg={colors.accent} selectable wrapMode="word">
        {record.value}
      </text>
      {record.notes ? (
        <text fg={colors.muted} wrapMode="word">
          {record.notes}
        </text>
      ) : null}
    </box>
  );
}

export function AddCustomDomainScreen({
  values,
  focus,
  added,
  records,
  target,
  recordsLoading,
  recordsError,
  error,
}: AddCustomDomainScreenProps) {
  const scrollRef = useRef<ScrollBoxRenderable | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollChildIntoView(`add-domain-${focus}`, { align: "nearest" });
  }, [focus]);

  return (
    <scrollbox ref={scrollRef} flexGrow={1} flexShrink={1} width="100%" scrollY>
      <Panel title="Add custom domain" width={80}>
        {added ? (
          <>
            <text fg={colors.success} wrapMode="word">
              Domain added. Create the DNS records below at your DNS provider, then wait for the
              certificate status to turn Ready.
            </text>
            {recordsLoading ? <text fg={colors.muted}>Loading DNS records…</text> : null}
            {recordsError ? (
              <text fg={colors.error} wrapMode="word">
                {recordsError}
              </text>
            ) : null}
            {!recordsLoading && !recordsError && records.length === 0 ? (
              <text fg={colors.warning} wrapMode="word">
                The server returned no DNS records. The cluster may not have published an ingress
                address yet; try again in a moment.
              </text>
            ) : null}
            {records.length > 0 ? (
              <box flexDirection="column" flexShrink={0}>
                <text fg={colors.accent}>DNS records to create</text>
                <text fg={colors.muted} wrapMode="word">
                  Add each record exactly as shown. Select the value text to copy it.
                </text>
                {target ? (
                  <text fg={colors.muted} wrapMode="word">
                    Ingress target:{" "}
                    {target.hostname ??
                      (target.ips.length > 0 ? target.ips.join(", ") : "not published yet")}
                  </text>
                ) : null}
                {records.map((record) => (
                  <RecordRow
                    key={`${record.hostname}:${record.type}:${record.name}:${record.value}`}
                    record={record}
                  />
                ))}
              </box>
            ) : null}
          </>
        ) : (
          <>
            <text fg={colors.text} wrapMode="word">
              Bind a hostname to this sandbox. DNS and a certificate are checked after the binding
              is created.
            </text>
            <box id="add-domain-hostname" flexDirection="column" flexShrink={0}>
              <Field
                label="Hostname"
                value={values.hostname}
                active={focus === "hostname"}
                placeholder="api.example.com"
              />
            </box>
            <box id="add-domain-port" flexDirection="column" flexShrink={0}>
              <Field
                label="Port (optional)"
                value={values.port}
                active={focus === "port"}
                placeholder="default"
              />
              <text fg={colors.muted} wrapMode="word">
                Leave empty to use the sandbox&apos;s default (toolbox) port.
              </text>
            </box>
            {error ? (
              <text fg={colors.error} wrapMode="word">
                {error}
              </text>
            ) : null}
            <box id="add-domain-submit">
              <FormButton label="Add domain" active={focus === "submit"} />
            </box>
          </>
        )}
      </Panel>
    </scrollbox>
  );
}
