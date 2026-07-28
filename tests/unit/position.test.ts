import { describe, expect, it } from "vitest";
import { calculatePosition } from "../../src/ui/position";

describe("overlay position", () => {
  it("uses free space to the right", () =>
    expect(
      calculatePosition(
        { left: 100, top: 40, width: 20, height: 20 },
        { width: 200, height: 100 },
        { width: 800, height: 600 }
      )
    ).toEqual({ left: 130, top: 40 }));
  it("flips left near viewport edge", () =>
    expect(
      calculatePosition(
        { left: 750, top: 580, width: 20, height: 20 },
        { width: 200, height: 100 },
        { width: 800, height: 600 }
      )
    ).toEqual({ left: 540, top: 490 }));
});
