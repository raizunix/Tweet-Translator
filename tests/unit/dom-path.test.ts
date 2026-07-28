import { describe, expect, it } from "vitest";
import { createDomPath, resolveDomPath } from "../../src/shared/dom-path";

describe("DOM paths", () => {
  it("resolves the same element in an identical clone", () => {
    const root = document.createElement("div");
    root.innerHTML = "<section><span>first</span><span>target</span></section>";
    const target = root.querySelectorAll("span")[1];
    const path = createDomPath(root, target);
    const clone = root.cloneNode(true) as HTMLElement;
    expect(path).toEqual([0, 1]);
    expect(resolveDomPath(clone, path!)).toBe(clone.querySelectorAll("span")[1]);
  });

  it("rejects elements outside the root", () => {
    expect(createDomPath(document.createElement("div"), document.createElement("span"))).toBeNull();
  });
});
