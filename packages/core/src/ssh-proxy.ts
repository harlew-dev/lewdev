import type { LewdevApi } from "./client.js";

export interface SshProxyIo {
  stdin: AsyncIterable<Uint8Array>;
  stdout: { write(chunk: Uint8Array): unknown };
  stderr: { write(chunk: Uint8Array | string): unknown };
}

const SSH_PROXY_COMMAND = "exec /usr/sbin/sshd -i";

function toBytes(value: Uint8Array | string): Uint8Array {
  return typeof value === "string" ? new TextEncoder().encode(value) : value;
}

/**
 * Bridges local stdin/stdout to `sshd -i` inside the sandbox. The SDK drops
 * writes until the stream is open, so bytes are buffered until sshd's first
 * output, then flushed in order.
 */
export async function runSshProxy(
  api: LewdevApi,
  sandboxId: string,
  io: SshProxyIo,
): Promise<number> {
  const pending: Uint8Array[] = [];
  let open = false;
  let stdinEnded = false;
  let closed = false;

  const closeInput = (stream: { close(): void }): void => {
    if (!closed) {
      closed = true;
      stream.close();
    }
  };

  const stream = await api.execStream(sandboxId, {
    command: SSH_PROXY_COMMAND,
    onStdout: (chunk) => {
      if (!open) {
        open = true;
        for (const buffered of pending.splice(0)) {
          stream.write(buffered);
        }
        if (stdinEnded) {
          closeInput(stream);
        }
      }
      io.stdout.write(chunk);
    },
    onStderr: (chunk) => {
      io.stderr.write(chunk);
    },
    onError: (message) => {
      io.stderr.write(`${message}\n`);
    },
  });

  const input = (async (): Promise<void> => {
    for await (const chunk of io.stdin) {
      const bytes = toBytes(chunk);
      if (open) {
        stream.write(bytes);
      } else {
        pending.push(bytes);
      }
    }
    stdinEnded = true;
    if (open) {
      closeInput(stream);
    }
  })();
  void input.catch(() => {});

  try {
    const exit = await stream.done;
    return exit.code >= 0 ? exit.code : 1;
  } catch (error) {
    io.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    return 1;
  }
}
