import { describe, it, expect } from "vitest";
import { detectNameType } from "./nameResolution";

describe("detectNameType", () => {
  it("detects ENS names", () => {
    expect(detectNameType("alice.eth")).toBe("ens");
    expect(detectNameType("my-name.eth")).toBe("ens");
    expect(detectNameType("ALICE.eth")).toBe("ens");
  });

  it("detects Base Names", () => {
    expect(detectNameType("alice.base")).toBe("basename");
    expect(detectNameType("my-name.base")).toBe("basename");
  });

  it("detects raw addresses", () => {
    expect(
      detectNameType("0x1234567890abcdef1234567890abcdef12345678")
    ).toBe("address");
  });

  it("returns unknown for unrecognized input", () => {
    expect(detectNameType("alice")).toBe("unknown");
    expect(detectNameType("alice.com")).toBe("unknown");
    expect(detectNameType("")).toBe("unknown");
    expect(detectNameType("0x123")).toBe("unknown");
  });
});
