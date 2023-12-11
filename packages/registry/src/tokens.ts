export interface TokenMeta {
  chainId: number;
  address: string;
  decimals: number;
  name: string;
  symbol: string;
  image: string;
  // https://api.coingecko.com/api/v3/coins/[coingeckoId]?community_data=false&developer_data=false&localization=false&market_data=true&sparkline=false&tickers=false
  coingeckoId?: string;
  tags?: string[];
}

export const tokens: TokenMeta[] = [
  {
    chainId: 103,
    address: "So11111111111111111111111111111111111111112",
    decimals: 9,
    name: "SOL",
    symbol: "SOL",
    image: "https://assets.coingecko.com/coins/images/21629/large/solana.jpg",
    coingeckoId: "solana",
  },
  {
    chainId: 103,
    address: "AfWWqUHFzJFSxQHYn6PvyaoyswyodHgCTeDiRgovEmHX",
    decimals: 6,
    name: "USD Coin",
    symbol: "USDC",
    image: "https://assets.coingecko.com/coins/images/6319/large/usdc.png",
    coingeckoId: "usd-coin",
    tags: ["stablecoin", "usd"],
  },
  {
    chainId: 103,
    address: "FeCtM4bXUGo8vGrvHUCZjybmesovZLkQqCGqMuhHUHfZ",
    decimals: 6,
    name: "USDT",
    symbol: "USDT",
    image: "https://assets.coingecko.com/coins/images/325/large/Tether.png",
    coingeckoId: "tether",
    tags: ["stablecoin", "usd"],
  },
  {
    chainId: 103,
    address: "94w5e3aQfc2DR3CuvAgr9XZXGpyMghznPqPWo2UFUuDU",
    decimals: 6,
    name: "UXD Stablecoin",
    symbol: "UXD",
    image: "https://assets.coingecko.com/coins/images/22850/standard/UXD-White.png",
    coingeckoId: "uxd-stablecoin",
    tags: ["stablecoin", "usd"],
  },
  // {
  //   chainId: 103,
  //   address: "HhskQmZneTQem7QzaeZQ2q1baz9LCrngBMrWgM5jetPz",
  //   decimals: 6,
  //   name: "USDH",
  //   symbol: "USDH",
  //   image: "https://assets.coingecko.com/coins/images/22941/large/USDH_icon.png",
  //   coingeckoId: "usdh",
  //   tags: ["stablecoin", "usd"],
  // },
  {
    chainId: 103,
    address: "8anyQR9CrzDHap8gm9YRymvEoFUzy71yd5MygQVQ4hVB",
    decimals: 9,
    name: "Hedge USD",
    symbol: "USH",
    image: "https://assets.coingecko.com/coins/images/25481/large/ush.png",
    coingeckoId: "hedge-usd",
    tags: ["stablecoin", "usd"],
  },
  {
    chainId: 103,
    address: "STBuyENwJ1GP4yNZCjwavn92wYLEY3t5S1kVS5kwyS1",
    decimals: 9,
    name: "stabble",
    symbol: "STB",
    image: "https://arweave.net/NDA3n32cVWTVawoqHmh5e4rMyYvTp2YhAznqoemjGMM",
  },
  // {
  //   chainId: 103,
  //   address: "HK3Q8SJYiV1kLo3b6vfwLnL45nhunnt4kSBVQNa3Z28J",
  //   decimals: 7,
  //   name: "Parasol",
  //   symbol: "PSOL",
  //   image: "https://assets.coingecko.com/coins/images/21551/large/icon.png",
  //   coingeckoId: "parasol-finance",
  // },
  {
    chainId: 103,
    address: "C6nokjAzpaEWa3zor751WnM6gqJvrhBngxxBSFWWVqGs",
    decimals: 5,
    name: "Bonk",
    symbol: "Bonk",
    image: "https://assets.coingecko.com/coins/images/28600/standard/bonk.jpg",
    coingeckoId: "bonk",
    tags: ["meme"],
  },
];
