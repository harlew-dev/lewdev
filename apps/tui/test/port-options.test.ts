import { describe, expect, test } from "bun:test";

import {
  PORT_PROTOCOL_OPTIONS,
  PORT_VISIBILITY_OPTIONS,
  portAddress,
  portTypeLabel,
  protocolLabel,
  protocolOption,
  visibilityLabel,
  visibilityOption,
  visibilityTableLabel,
} from "../src/port-options";

describe("port protocol", () => {
  test("offers HTTP(S) by default and TCP", () => {
    expect(PORT_PROTOCOL_OPTIONS.map((option) => [option.value, option.label])).toEqual([
      ["http", "HTTP(S)"],
      ["tcp", "TCP"],
    ]);
    expect(protocolOption("http").description).toBe(
      "Open an HTTP(S) URL through the AerolVM gateway.",
    );
    expect(protocolLabel("tcp")).toBe("TCP");
  });
});

describe("port visibility", () => {
  test("offers public and private with descriptions", () => {
    expect(PORT_VISIBILITY_OPTIONS.map((option) => [option.value, option.label])).toEqual([
      ["public", "Public"],
      ["token", "Private"],
    ]);
    expect(visibilityOption("public").description).toBe("Anyone with the URL can reach this port.");
    expect(visibilityOption("token").description).toBe("Needs a sandbox token for this port.");
  });

  test("uses Private in the form and private in the table", () => {
    expect(visibilityLabel("token")).toBe("Private");
    expect(visibilityTableLabel("token")).toBe("private");
    expect(visibilityLabel("public")).toBe("Public");
    expect(visibilityTableLabel(undefined)).toBe("public");
  });
});

describe("port display", () => {
  test("shows host:hostPort for TCP and the URL otherwise", () => {
    expect(
      portAddress({
        url: "tcp://eu.example.test:22042",
        host: "eu.example.test",
        hostPort: 22042,
      }),
    ).toBe("eu.example.test:22042");
    expect(portAddress({ url: "https://8080.example" })).toBe("https://8080.example");
  });

  test("shows TCP in the type column and public/private for HTTP", () => {
    expect(portTypeLabel({ protocol: "tcp" })).toBe("TCP");
    expect(portTypeLabel({ protocol: "http", visibility: "token" })).toBe("private");
    expect(portTypeLabel({ visibility: "public" })).toBe("public");
  });
});
