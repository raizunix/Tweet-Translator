import { describe, expect, it } from "vitest";
import { protectText } from "../../src/translation/text-protection";

describe("text protection", () => {
  it("protects links, identifiers, tickers, addresses, numbers, emoji and terms", () => {
    const source =
      "Solana $SOL +12.5% 🚀 @alice #DeFi https://t.co/test 0x1234567890abcdef1234567890abcdef12345678";
    const protectedText = protectText(source, ["Solana"]);
    expect(protectedText.text).not.toContain("$SOL");
    expect(protectedText.restore(protectedText.text)).toBe(source);
  });

  it("restores reordered tokens by identity", () => {
    const protectedText = protectText("Buy $SOL from @alice", []);
    const tokens = protectedText.text.match(/⟦TT\d+⟧/g)!;
    expect(protectedText.restore(`Купить ${tokens[1]} у ${tokens[0]}`)).toBe(
      "Купить @alice у $SOL"
    );
  });

  it("preserves the source line and paragraph breaks when a provider removes whitespace", () => {
    const source = "First paragraph\n\nSecond paragraph\nThird line";
    const protectedText = protectText(source, []);
    const tokens = protectedText.text.match(/⟦TT\d+⟧/g)!;

    expect(tokens).toHaveLength(2);
    expect(
      protectedText.restore(`Первый абзац ${tokens[0]} Второй абзац ${tokens[1]} Третья строка`)
    ).toBe("Первый абзац\n\nВторой абзац\nТретья строка");
  });

  it("returns the source if a provider loses a protected token", () => {
    const source = "Buy $SOL now";
    expect(protectText(source).restore("Купить сейчас")).toBe(source);
  });
});
