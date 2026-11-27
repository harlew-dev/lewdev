import { describe, expect, test } from "bun:test";

import {
  customDomainInput,
  customDomainStatusLabel,
  customDomainTargetLabel,
} from "../src/domain-form";

describe("custom domain form", () => {
  test("trims the hostname and treats an empty port as the default", () => {
    expect(customDomainInput({ hostname: " api.example.com ", port: "" })).toEqual({
      hostname: "api.example.com",
    });
    expect(customDomainInput({ hostname: "api.example.com", port: " 8080 " })).toEqual({
      hostname: "api.example.com",
      port: 8080,
    });
  });

  test("rejects an empty hostname and invalid ports", () => {
    expect(() => customDomainInput({ hostname: "  ", port: "" })).toThrow(
      "Enter a hostname, such as api.example.com.",
    );
    for (const port of ["0", "65536", "80a", "1.5"]) {
      expect(() => customDomainInput({ hostname: "api.example.com", port })).toThrow(
        "Port must be a whole number from 1 to 65535, or empty for the default.",
      );
    }
  });

  test("describes each status in plain words", () => {
    expect(customDomainStatusLabel("pending_dns")).toBe("Waiting for DNS");
    expect(customDomainStatusLabel("issuing")).toBe("Issuing certificate");
    expect(customDomainStatusLabel("ready")).toBe("Ready");
    expect(customDomainStatusLabel("failed")).toBe("Failed");
  });

  test("names the route, falling back to the toolbox port", () => {
    expect(customDomainTargetLabel(undefined)).toBe("Toolbox port (default)");
    expect(customDomainTargetLabel(0)).toBe("Toolbox port (default)");
    expect(customDomainTargetLabel(8080)).toBe("Port 8080");
  });
});
