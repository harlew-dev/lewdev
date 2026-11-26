import { resolve } from "node:path";

type Libc = "glibc" | "musl";

interface ProcessReport {
  getReport?: () => { header?: { glibcVersionRuntime?: string } };
}

/**
 * OpenTUI selects its Linux native package at runtime from OPENTUI_LIBC. Bun
 * resolves every dynamic import for the target platform at build time, so a
 * glibc build would also require the musl package unless the value is inlined.
 * Default to the host libc and let OPENTUI_LIBC choose explicitly.
 */
function linuxLibc(): Libc {
  const selected = process.env.OPENTUI_LIBC?.trim();
  if (selected === "glibc" || selected === "musl") {
    return selected;
  }
  if (selected) {
    throw new Error(`OPENTUI_LIBC must be "glibc" or "musl", got ${JSON.stringify(selected)}`);
  }

  const report = (process as unknown as { report?: ProcessReport }).report;
  return report?.getReport?.().header?.glibcVersionRuntime ? "glibc" : "musl";
}

const entry = resolve(import.meta.dir, "../src/index.tsx");
const outfile = resolve(import.meta.dir, "../../../dist/lewdev");
const args = [process.execPath, "build", "--compile", entry, "--outfile", outfile];

if (process.platform === "linux") {
  args.push("--define", `process.env.OPENTUI_LIBC=${JSON.stringify(linuxLibc())}`);
}

args.push(...process.argv.slice(2));

const result = Bun.spawnSync(args, { stdio: ["inherit", "inherit", "inherit"] });
process.exit(result.exitCode ?? 1);
