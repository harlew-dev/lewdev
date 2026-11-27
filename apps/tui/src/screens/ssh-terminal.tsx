import { describeError, type LewdevApi, type TerminalSessionAttachHandle } from "@lewdev/core";
import { EmbeddedTerminalRenderable } from "@opentui/core";
import { extend } from "@opentui/react";
import { useCallback, useEffect, useRef, useState } from "react";

import { findReattachSession, LEWDEV_SESSION_NAME, nextShellSessionName } from "../sessions";
import { colors } from "../theme";

declare module "@opentui/react" {
  interface OpenTUIComponents {
    "embedded-terminal": typeof EmbeddedTerminalRenderable;
  }
}

extend({ "embedded-terminal": EmbeddedTerminalRenderable });

export interface TerminalSessionHandle {
  detach(): void;
}

export interface TerminalExitResult {
  code: number | null;
  signal?: string;
  error: string | null;
}

interface SessionTerminalScreenProps {
  api: LewdevApi;
  sandboxId: string;
  /** Attach to this exact session instead of resolving one. */
  sessionId?: string;
  /** Always create a fresh shell session instead of reattaching. */
  newSession?: boolean;
  label: string;
  statusMessage: string | null;
  onExit: (result: TerminalExitResult) => void;
  onSessionChange: (session: TerminalSessionHandle | null) => void;
}

function closeHandle(handle: TerminalSessionAttachHandle): void {
  try {
    handle.close();
  } catch {
    // The stream already dropped or the session exited.
  }
}

/**
 * Attaches to an AerolVM terminal session and paints it with the OpenTUI
 * embedded terminal. The focused renderable receives every key and paste, so
 * the app's global keyboard handler must stay out of the way while this page is
 * open. Detaching closes the attach stream; the session keeps running.
 */
export function SessionTerminalScreen({
  api,
  sandboxId,
  sessionId,
  newSession,
  label,
  statusMessage,
  onExit,
  onSessionChange,
}: SessionTerminalScreenProps) {
  const emulatorRef = useRef<EmbeddedTerminalRenderable | null>(null);
  const attachRef = useRef<TerminalSessionAttachHandle | null>(null);
  const [connecting, setConnecting] = useState(true);

  const handleData = useCallback((data: Uint8Array) => {
    try {
      attachRef.current?.write(data);
    } catch {
      // The attach stream closed between the key and the write.
    }
  }, []);

  const handleResize = useCallback((cols: number, rows: number) => {
    try {
      attachRef.current?.resize(cols, rows);
    } catch {
      // The attach stream closed before the layout settled.
    }
  }, []);

  useEffect(() => {
    const emulator = emulatorRef.current;
    emulator?.focus();
    return () => {
      emulator?.blur();
    };
  }, []);

  useEffect(() => {
    const emulator = emulatorRef.current;
    if (!emulator) {
      onExit({ code: null, error: "The embedded terminal could not be created." });
      return;
    }

    const size = () => ({
      cols: Math.max(1, Math.floor(emulator.width) || 80),
      rows: Math.max(1, Math.floor(emulator.height) || 24),
    });

    let closed = false;
    let detaching = false;
    let reported = false;
    let handle: TerminalSessionAttachHandle | null = null;

    const write = (chunk: Uint8Array) => {
      if (closed) {
        return;
      }
      try {
        emulator.write(chunk);
      } catch {
        // The renderable was removed while output was in flight.
      }
    };

    const finish = (result: TerminalExitResult) => {
      if (closed || detaching || reported) {
        return;
      }
      reported = true;
      onSessionChange(null);
      onExit(result);
    };

    const run = async () => {
      try {
        let targetId = sessionId;
        if (targetId === undefined) {
          const sessions = await api.listSessions(sandboxId);
          if (closed) {
            return;
          }
          if (newSession === true) {
            const created = await api.createSession(sandboxId, {
              name: nextShellSessionName(sessions),
              pty: true,
              workDir: "/root",
              ...size(),
            });
            targetId = created.id;
          } else {
            const existing = findReattachSession(sessions);
            if (existing) {
              targetId = existing.id;
            } else {
              const created = await api.createSession(sandboxId, {
                name: LEWDEV_SESSION_NAME,
                pty: true,
                workDir: "/root",
                ...size(),
              });
              targetId = created.id;
            }
          }
        }
        if (closed) {
          return;
        }

        const initial = size();
        const attached = api.attachSession(sandboxId, targetId, {
          cols: initial.cols,
          rows: initial.rows,
          onStdout: write,
          onStderr: write,
        });
        handle = attached;
        attachRef.current = attached;
        setConnecting(false);
        if (closed) {
          closeHandle(attached);
          return;
        }
        onSessionChange({
          detach: () => {
            detaching = true;
            closeHandle(attached);
          },
        });
        void attached.done
          .then((info) => {
            finish({
              code: info.code,
              ...(info.signal === undefined ? {} : { signal: info.signal }),
              error: null,
            });
          })
          .catch((error: unknown) => {
            finish({ code: null, error: describeError(error) });
          });
      } catch (error) {
        finish({ code: null, error: describeError(error) });
      }
    };

    void run();

    return () => {
      closed = true;
      attachRef.current = null;
      onSessionChange(null);
      if (handle !== null) {
        closeHandle(handle);
      }
    };
  }, [api, sandboxId, sessionId, newSession, onExit, onSessionChange]);

  return (
    <box flexDirection="column" flexGrow={1} minHeight={3}>
      <box
        border
        borderStyle="rounded"
        borderColor={colors.border}
        title={`Terminal · ${label}`}
        titleColor={colors.accent}
        flexDirection="column"
        flexGrow={1}
        flexShrink={1}
        minHeight={3}
      >
        <embedded-terminal
          ref={emulatorRef}
          width="100%"
          height="100%"
          selectable
          onData={handleData}
          onTerminalResize={handleResize}
        />
      </box>
      {statusMessage ? (
        <box flexShrink={0} paddingTop={1}>
          <text fg={colors.warning} wrapMode="word">
            {statusMessage}
          </text>
        </box>
      ) : connecting ? (
        <box flexShrink={0} paddingTop={1}>
          <text fg={colors.muted}>Connecting to session…</text>
        </box>
      ) : null}
    </box>
  );
}
