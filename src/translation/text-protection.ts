const CRYPTO_ABBREVIATIONS = [
  "HODL",
  "FUD",
  "FOMO",
  "DYOR",
  "NFA",
  "WAGMI",
  "NGMI",
  "LFG",
  "IYKYK",
  "GM",
  "GN",
  "ATH",
  "ATL",
  "DCA",
  "ROI",
  "APY",
  "APR",
  "TVL",
  "MCAP",
  "FDV",
  "DeFi",
  "DEX",
  "CEX",
  "AMM",
  "DAO",
  "dApp",
  "NFT",
  "PFP",
  "LP",
  "OTC",
  "PnL",
  "RPC",
  "EVM",
  "TPS",
  "MEV",
  "ICO",
  "IDO",
  "IEO",
  "KYC",
  "AML",
  "CA",
  "BTD",
  "BTFD",
  "CT",
  "KOL",
  "OG",
  "L1",
  "L2",
  "L3",
  "ZK",
  "TA",
  "FA",
  "RSI",
  "MACD",
  "Web3"
] as const;

const NETWORKS_AND_PRODUCTS = [
  "Bitcoin",
  "Ethereum",
  "Solana",
  "Raydium",
  "Jupiter",
  "Jito",
  "Marinade",
  "Orca",
  "Drift",
  "Pyth",
  "Tensor",
  "Phantom",
  "Solflare",
  "Metaplex",
  "Meteora",
  "MarginFi",
  "Solend",
  "Bonfida",
  "PumpSwap",
  "pump.fun",
  "Magic Eden",
  "Alpenglow"
] as const;

const CRYPTO_TERMS = [
  "degen",
  "degens",
  "ape",
  "aped",
  "whale",
  "whales",
  "rekt",
  "rugged",
  "rugger",
  "shill",
  "shilled",
  "shilling",
  "bullish",
  "bearish",
  "moonshot",
  "bagholder",
  "bagholders",
  "copium",
  "hopium",
  "gigabrain",
  "gigachad",
  "normie",
  "pleb",
  "maxi",
  "fren",
  "frens",
  "ser",
  "anon",
  "anons",
  "jeet",
  "jeets",
  "chad",
  "alpha",
  "wen",
  "perps",
  "slippage",
  "arbitrage",
  "staking",
  "restaking",
  "unstaking",
  "swap",
  "bridge",
  "vault",
  "lending",
  "collateral",
  "governance",
  "protocol",
  "tokenomics",
  "vesting",
  "airdrop",
  "airdrops",
  "whitelist",
  "presale",
  "mint",
  "altcoin",
  "altcoins",
  "shitcoin",
  "shitcoins",
  "memecoin",
  "memecoins",
  "stablecoin",
  "stablecoins",
  "satoshi",
  "sats",
  "gwei",
  "wei",
  "sniper",
  "frontrun",
  "backrun",
  "sandwich",
  "honeypot",
  "bundle",
  "blockchain",
  "mainnet",
  "testnet",
  "devnet",
  "validator",
  "oracle",
  "multisig",
  "rollup",
  "sidechain",
  "hashrate",
  "halving",
  "token",
  "wallet"
] as const;

const CRYPTO_MEME_SLANG = [
  "hodling",
  "gg",
  "degening",
  "aping",
  "rekted",
  "shiller",
  "mooning",
  "moonboy",
  "bagholding",
  "coping",
  "jeeted",
  "jeeting",
  "npc",
  "intern",
  "cope",
  "pump",
  "pumped",
  "pumping",
  "pumps",
  "dump",
  "dumped",
  "dumping",
  "dumps",
  "nuke",
  "nuked",
  "moon",
  "dip",
  "dips",
  "rally",
  "breakout",
  "breakdown",
  "fade",
  "faded",
  "fading",
  "accumulation",
  "capitulation",
  "liquidation",
  "liquidated",
  "leverage",
  "leveraged",
  "perpetuals",
  "futures",
  "scalp",
  "scalping",
  "arb",
  "bags",
  "entry",
  "exits",
  "gas",
  "staked",
  "swapped",
  "swaps",
  "bridged",
  "bridging",
  "vaults",
  "borrowing",
  "protocols",
  "airdropped",
  "whitelisted",
  "flippening",
  "flipped",
  "rugging",
  "minted",
  "minting",
  "mints",
  "snipe",
  "sniped",
  "sniping",
  "frontrunning",
  "frontrunner",
  "backrunning",
  "sandwiched",
  "honeypots",
  "bundled",
  "validators",
  "oracles",
  "rollups",
  "tokens",
  "wallets",
  "lambo",
  "4chan",
  "Reddit",
  "Discord",
  "Telegram"
] as const;

const CRYPTO_PHRASES = [
  "rug pull",
  "rug pulled",
  "buy the dip",
  "diamond hands",
  "paper hands",
  "weak hands",
  "strong hands",
  "smart money",
  "dumb money",
  "exit liquidity",
  "dead cat bounce",
  "blow off top",
  "stop loss",
  "take profit",
  "limit order",
  "market order",
  "order book",
  "swing trade",
  "day trade",
  "copy trade",
  "copy trading",
  "margin call",
  "short squeeze",
  "bear trap",
  "bull trap",
  "bull run",
  "bear market",
  "bull market",
  "price action",
  "green candle",
  "red candle",
  "flash crash",
  "panic sell",
  "panic buy",
  "yield farming",
  "liquidity pool",
  "liquidity provider",
  "impermanent loss",
  "flash loan",
  "smart contract",
  "token burn",
  "total supply",
  "max supply",
  "circulating supply",
  "market cap",
  "liquid staking",
  "floor price",
  "sweep the floor",
  "free mint",
  "dutch auction",
  "open edition",
  "priority fee",
  "compute units",
  "proof of history",
  "bonding curve",
  "SPL token",
  "sniper bot",
  "trading bot",
  "sandwich attack",
  "Jito bundle",
  "flash bot",
  "stealth launch",
  "fair launch",
  "dev wallet",
  "private sale",
  "send it",
  "wen pump",
  "let him cook",
  "full send",
  "ape in",
  "ape into",
  "aped in",
  "aped into",
  "wen moon",
  "wen lambo",
  "to the moon",
  "number go up",
  "up only",
  "not gonna make it",
  "gonna make it",
  "probably nothing",
  "this is the way",
  "few understand",
  "generational wealth",
  "printing money",
  "free money",
  "on-chain",
  "off-chain",
  "cross-chain",
  "seed phrase",
  "private key",
  "public key",
  "cold wallet",
  "hot wallet",
  "hardware wallet",
  "gas fee",
  "gas fees"
] as const;

export const DEFAULT_CRYPTO_TERMS = [
  ...CRYPTO_ABBREVIATIONS,
  ...NETWORKS_AND_PRODUCTS,
  ...CRYPTO_TERMS,
  ...CRYPTO_MEME_SLANG,
  ...CRYPTO_PHRASES
];

export interface ProtectedText {
  text: string;
  restore(translated: string): string;
}

type Match = { start: number; end: number; value: string };

const BUILTIN_PATTERNS = [
  /https?:\/\/[^\s<>"']+/giu,
  /\b(?:t\.co|bit\.ly|tinyurl\.com|youtu\.be)\/[^\s<>"']+/giu,
  /@[A-Za-z_][A-Za-z0-9_]{0,14}/gu,
  /#[\p{L}\p{N}_]+/gu,
  /\$[A-Za-z][A-Za-z0-9]{0,15}\b/gu,
  /\b0x[a-fA-F0-9]{40}\b/gu,
  /\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/gu,
  /\p{Extended_Pictographic}(?:\uFE0F|\p{Emoji_Modifier}|\u200D\p{Extended_Pictographic})*/gu,
  /(?<![\p{L}\p{N}])[-+]?\d[\d,.]*(?:%|[kKmMbBtT])?(?![\p{L}\p{N}])/gu
] as const;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function collectMatches(text: string, terms: readonly string[]): Match[] {
  const matches: Match[] = [];
  const patterns: RegExp[] = [...BUILTIN_PATTERNS];
  const normalizedTerms = [...new Set(terms.map((term) => term.trim()).filter(Boolean))].sort(
    (a, b) => b.length - a.length
  );
  if (normalizedTerms.length) {
    patterns.push(
      new RegExp(
        `(?<![\\p{L}\\p{N}_])(?:${normalizedTerms.map(escapeRegExp).join("|")})(?![\\p{L}\\p{N}_])`,
        "giu"
      )
    );
  }
  for (const pattern of patterns) {
    pattern.lastIndex = 0;
    for (const match of text.matchAll(pattern)) {
      if (match.index !== undefined)
        matches.push({ start: match.index, end: match.index + match[0].length, value: match[0] });
    }
  }
  return matches
    .sort((a, b) => a.start - b.start || b.end - a.end)
    .filter((match, index, all) => !all.slice(0, index).some((other) => other.end > match.start));
}

export function protectText(
  source: string,
  cryptoTerms: readonly string[] = DEFAULT_CRYPTO_TERMS
): ProtectedText {
  const matches = collectMatches(source, cryptoTerms);
  const values: string[] = [];
  let cursor = 0;
  let protectedValue = "";
  for (const match of matches) {
    protectedValue += source.slice(cursor, match.start);
    const index = values.push(match.value) - 1;
    protectedValue += `⟦TT${index}⟧`;
    cursor = match.end;
  }
  protectedValue += source.slice(cursor);

  return {
    text: protectedValue,
    restore(translated: string) {
      const seen = new Set<number>();
      const restored = translated.replace(/⟦\s*TT\s*(\d+)\s*⟧/giu, (token, rawIndex: string) => {
        const index = Number(rawIndex);
        const value = values[index];
        if (value === undefined || seen.has(index)) return token;
        seen.add(index);
        return value;
      });
      // A missing marker means the service corrupted the structure. Returning
      // the source is safer than silently moving protected values elsewhere.
      return seen.size === values.length ? restored : source;
    }
  };
}
