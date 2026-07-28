import { describe, expect, it } from "vitest";
import { adapterFor } from "../../src/platforms/registry";

describe("platform registry", () => {
  it("selects Axiom by hostname", () =>
    expect(adapterFor(new URL("https://axiom.trade/meme"))?.id).toBe("axiom"));
  it("selects GMGN by hostname", () =>
    expect(adapterFor(new URL("https://gmgn.ai/sol/token/example"))?.id).toBe("gmgn"));
  it("selects Padre trade terminal by hostname", () =>
    expect(adapterFor(new URL("https://trade.padre.gg/trade/solana/example"))?.id).toBe("padre"));
  it("does not select unrelated Padre subdomains", () =>
    expect(adapterFor(new URL("https://example.padre.gg/"))).toBeUndefined());
});
