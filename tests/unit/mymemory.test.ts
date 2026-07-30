import { describe, expect, it } from "vitest";
import { splitUtf8 } from "../../src/translation/providers/mymemory";

describe("MyMemory segmentation", () => {
  it("keeps every segment at or below 500 UTF-8 bytes", () => {
    const chunks = splitUtf8("я".repeat(600), 500);
    expect(chunks.join("")).toBe("я".repeat(600));
    expect(chunks.every((chunk) => new TextEncoder().encode(chunk).length <= 500)).toBe(true);
  });

  it("does not split protection tokens", () => {
    expect(splitUtf8(`${"a".repeat(8)}⟦TT12⟧`, 10)).toEqual(["aaaaaaaa", "⟦TT12⟧"]);
  });
});
