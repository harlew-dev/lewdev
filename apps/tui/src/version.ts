import packageJson from "../package.json" with { type: "json" };

/** The running lewdev version, from apps/tui/package.json. Release tags must match it. */
export const VERSION: string = packageJson.version;
