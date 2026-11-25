import { describeError } from "@lewdev/core";
import { EmbeddedTerminalRenderable } from "@opentui/core";
import { extend } from "@opentui/react";
import { useCallback, useEffect, useRef } from "react";

import { colors } from "../theme";

declare module "@opentui/react" {
  interface OpenTUIComponents {
    "embedded-terminal": typeof EmbeddedTerminalRenderable;
  }
}

extend({ "embedded-terminal": EmbeddedTerminalRenderable });

export interface SshSessionHandle {
  kill(): void;
}

export interface SshExitResult {
  status: number | null;
  error: string | null;
}

interface SshTerminalScreenProps {
  argv: string[];
  statusMessage: string | null;
  onExit: (result: SshExitResult) => void;
  onSessionChange: (session: SshSessionHandle | null) => void;
}

function buildEnvironment(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined) {
      env[key] = value;
    }
  }
  env.TERM = "xterm-256color";
  return env;
}

const SSH_ENV = buildEnvironment();

/**
 * Runs ssh in a pseudo-terminal and paints it with the OpenTUI embedded
 * terminal. The focused renderable receives every key and paste, so the app's
 * global keyboard handler must stay out of the way while this page is open.
 *
 * The PTY is created inline by Bun.spawn so the child gets a controlling tty
 * (ssh needs it for host-key prompts and SIGWINCH). Writing and resizing go
 * through child.terminal.
 */
export function SshTerminalScreen({
  argv,
  statusMessage,
  onExit,
  onSessionChange,
}: SshTerminalScreenProps) {
  const emulatorRef = useRef<EmbeddedTerminalRenderable | null>(null);
  const ptyRef = useRef<Bun.Terminal | null>(null);

  const handleData = useCallback((data: Uint8Array) => {
    try {
      ptyRef.current?.write(data);
    } catch {
      // The PTY closed between the key and the write.
    }
  }, []);

  const handleResize = useCallback((cols: number, rows: number) => {
    try {
      ptyRef.current?.resize(cols, rows);
    } catch {
      // The PTY closed before the layout settled.
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
      onExit({ status: null, error: "The embedded terminal could not be created." });
      return;
    }

    const size = () => ({
      cols: Math.max(1, Math.floor(emulator.width) || 80),
      rows: Math.max(1, Math.floor(emulator.height) || 24),
    });
    const initial = size();

    let child: Bun.Subprocess | null = null;
    let closed = false;
    let resizeTimer: ReturnType<typeof setTimeout> | null = null;

    const kill = () => {
      closed = true;
      try {
        child?.kill();
      } catch {
        // The process already exited.
      }
    };

    try {
      child = Bun.spawn(argv, {
        env: SSH_ENV,
        terminal: {
          cols: initial.cols,
          rows: initial.rows,
          data(_terminal, data) {
            if (closed) {
              return;
            }
            try {
              emulator.write(data);
            } catch {
              // The renderable was removed while output was in flight.
            }
          },
        },
      });
      ptyRef.current = child.terminal ?? null;
      onSessionChange({ kill });

      // Forward the real size once the first layout pass has settled.
      resizeTimer = setTimeout(() => {
        const next = size();
        try {
          child?.terminal?.resize(next.cols, next.rows);
        } catch {
          // The PTY closed before the first layout pass.
        }
      }, 0);

      void child.exited
        .then((status) => {
          ptyRef.current = null;
          if (!closed) {
            onExit({ status, error: null });
          }
        })
        .catch((error: unknown) => {
          ptyRef.current = null;
          if (!closed) {
            onExit({ status: null, error: describeError(error) });
          }
        });
    } catch (error) {
      closed = true;
      onSessionChange(null);
      ptyRef.current = null;
      onExit({ status: null, error: describeError(error) });
    }

    return () => {
      closed = true;
      if (resizeTimer !== null) {
        clearTimeout(resizeTimer);
      }
      onSessionChange(null);
      ptyRef.current = null;
      try {
        child?.kill();
      } catch {
        // The process already exited.
      }
      try {
        child?.terminal?.close();
      } catch {
        // The PTY is already closed.
      }
    };
  }, [argv, onExit, onSessionChange]);

  return (
    <box flexDirection="column" flexGrow={1} minHeight={3}>
      <box flexGrow={1} width="100%">
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
      ) : null}
    </box>
  );
}
