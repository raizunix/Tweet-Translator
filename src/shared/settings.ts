export interface Settings {
  enabled: boolean;
  platforms: { axiom: boolean; gmgn: boolean; padre: boolean };
  interfaceLanguage: "auto" | "ru" | "en";
  targetLanguage: string;
  providers: ProviderSettings;
  proxyUrl: string;
  cryptoTerms: string[];
  cryptoDictionaryVersion: number;
}

export interface ProviderSettings {
  google: boolean;
  myMemory: boolean;
  libreTranslate: boolean;
  lingva: boolean;
  apertium: boolean;
  proxy: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  enabled: true,
  platforms: { axiom: true, gmgn: true, padre: true },
  interfaceLanguage: "auto",
  targetLanguage: "ru",
  providers: {
    google: true,
    myMemory: true,
    libreTranslate: true,
    lingva: true,
    apertium: true,
    proxy: false
  },
  proxyUrl: import.meta.env.VITE_TRANSLATION_PROXY_URL ?? "",
  cryptoTerms: [],
  cryptoDictionaryVersion: 2
};

export async function getSettings(): Promise<Settings> {
  if (typeof chrome === "undefined" || !chrome.storage) return DEFAULT_SETTINGS;
  const stored = await chrome.storage.sync.get("settings");
  const raw = stored.settings ?? {};
  const settings: Settings = {
    ...DEFAULT_SETTINGS,
    ...raw,
    platforms: { ...DEFAULT_SETTINGS.platforms, ...(raw.platforms ?? {}) },
    providers: migrateProviders(raw),
    cryptoTerms:
      raw.cryptoDictionaryVersion === DEFAULT_SETTINGS.cryptoDictionaryVersion &&
      Array.isArray(raw.cryptoTerms)
        ? raw.cryptoTerms
        : [
            ...new Set([
              ...DEFAULT_SETTINGS.cryptoTerms,
              ...(Array.isArray(raw.cryptoTerms) ? raw.cryptoTerms : [])
            ])
          ],
    cryptoDictionaryVersion: DEFAULT_SETTINGS.cryptoDictionaryVersion
  };
  return settings;
}

function migrateProviders(raw: Record<string, unknown>): ProviderSettings {
  const saved = raw.providers as Partial<ProviderSettings> | undefined;
  if (saved) return { ...DEFAULT_SETTINGS.providers, ...saved };
  const legacy = raw.fallbacks as { myMemory?: boolean; proxy?: boolean } | undefined;
  return {
    ...DEFAULT_SETTINGS.providers,
    myMemory: legacy?.myMemory ?? true,
    proxy: legacy?.proxy === true || raw.provider === "proxy"
  };
}

export async function saveSettings(settings: Settings): Promise<void> {
  await chrome.storage.sync.set({ settings });
}
const DEFAULT_CRYPTO_TERMS =
  "HODL|FUD|FOMO|DYOR|NFA|WAGMI|NGMI|LFG|IYKYK|GM|GN|ATH|ATL|DCA|ROI|APY|APR|TVL|MCAP|FDV|DeFi|DEX|CEX|AMM|DAO|dApp|NFT|PFP|LP|OTC|PnL|RPC|EVM|TPS|MEV|ICO|IDO|IEO|KYC|AML|CA|BTD|BTFD|CT|KOL|OG|L1|L2|L3|ZK|TA|FA|RSI|MACD|Web3|Bitcoin|Ethereum|Solana|Raydium|Jupiter|Jito|Marinade|Orca|Drift|Pyth|Tensor|Phantom|Solflare|Metaplex|Meteora|MarginFi|Solend|Bonfida|PumpSwap|pump.fun|Magic Eden|Alpenglow|degen|degens|ape|aped|whale|whales|rekt|rugged|rugger|shill|shilled|shilling|bullish|bearish|moonshot|bagholder|bagholders|copium|hopium|gigabrain|gigachad|normie|pleb|maxi|fren|frens|ser|anon|anons|jeet|jeets|chad|alpha|wen|perps|slippage|arbitrage|staking|restaking|unstaking|swap|bridge|vault|lending|collateral|governance|protocol|tokenomics|vesting|airdrop|airdrops|whitelist|presale|mint|altcoin|altcoins|shitcoin|shitcoins|memecoin|memecoins|stablecoin|stablecoins|satoshi|sats|gwei|wei|sniper|frontrun|backrun|sandwich|honeypot|bundle|blockchain|mainnet|testnet|devnet|validator|oracle|multisig|rollup|sidechain|hashrate|halving|token|wallet|hodling|gg|degening|aping|rekted|shiller|mooning|moonboy|bagholding|coping|jeeted|jeeting|npc|intern|cope|pump|pumped|pumping|pumps|dump|dumped|dumping|dumps|nuke|nuked|moon|dip|dips|rally|breakout|breakdown|fade|faded|fading|accumulation|capitulation|liquidation|liquidated|leverage|leveraged|perpetuals|futures|scalp|scalping|arb|bags|entry|exits|gas|staked|swapped|swaps|bridged|bridging|vaults|borrowing|protocols|airdropped|whitelisted|flippening|flipped|rugging|minted|minting|mints|snipe|sniped|sniping|frontrunning|frontrunner|backrunning|sandwiched|honeypots|bundled|validators|oracles|rollups|tokens|wallets|lambo|4chan|Reddit|Discord|Telegram|rug pull|rug pulled|buy the dip|diamond hands|paper hands|weak hands|strong hands|smart money|dumb money|exit liquidity|dead cat bounce|blow off top|stop loss|take profit|limit order|market order|order book|swing trade|day trade|copy trade|copy trading|margin call|short squeeze|bear trap|bull trap|bull run|bear market|bull market|price action|green candle|red candle|flash crash|panic sell|panic buy|yield farming|liquidity pool|liquidity provider|impermanent loss|flash loan|smart contract|token burn|total supply|max supply|circulating supply|market cap|liquid staking|floor price|sweep the floor|free mint|dutch auction|open edition|priority fee|compute units|proof of history|bonding curve|SPL token|sniper bot|trading bot|sandwich attack|Jito bundle|flash bot|stealth launch|fair launch|dev wallet|private sale|send it|wen pump|let him cook|full send|ape in|ape into|aped in|aped into|wen moon|wen lambo|to the moon|number go up|up only|not gonna make it|gonna make it|probably nothing|this is the way|few understand|generational wealth|printing money|free money|on-chain|off-chain|cross-chain|seed phrase|private key|public key|cold wallet|hot wallet|hardware wallet|gas fee|gas fees".split(
    "|"
  );
DEFAULT_SETTINGS.cryptoTerms = DEFAULT_CRYPTO_TERMS;
