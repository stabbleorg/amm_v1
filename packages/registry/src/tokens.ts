import { Cluster } from "@solana/web3.js";

export interface TokenMeta {
  address: string;
  decimals: number;
  cluster: Cluster;
  name: string;
  symbol: string;
  image: string;
  // https://api.coingecko.com/api/v3/coins/[coingeckoId]?community_data=false&developer_data=false&localization=false&market_data=true&sparkline=false&tickers=false
  coingeckoId?: string;
}

export const tokens: TokenMeta[] = [
  {
    address: "So11111111111111111111111111111111111111112",
    decimals: 9,
    cluster: "devnet",
    name: "SOL",
    symbol: "SOL",
    image: "https://assets.coingecko.com/coins/images/21629/large/solana.jpg?1639626543",
    coingeckoId: "solana",
  },
  {
    address: "AfWWqUHFzJFSxQHYn6PvyaoyswyodHgCTeDiRgovEmHX",
    decimals: 6,
    cluster: "devnet",
    name: "USD Coin",
    symbol: "USDC",
    image: "https://assets.coingecko.com/coins/images/6319/large/usdc.png",
    coingeckoId: "usd-coin",
  },
  {
    address: "FeCtM4bXUGo8vGrvHUCZjybmesovZLkQqCGqMuhHUHfZ",
    decimals: 6,
    cluster: "devnet",
    name: "USDT",
    symbol: "USDT",
    image: "https://assets.coingecko.com/coins/images/325/large/Tether.png",
    coingeckoId: "tether",
  },
  {
    address: "HhskQmZneTQem7QzaeZQ2q1baz9LCrngBMrWgM5jetPz",
    decimals: 6,
    cluster: "devnet",
    name: "USDH",
    symbol: "USDH",
    image: "https://assets.coingecko.com/coins/images/22941/large/USDH_icon.png",
    coingeckoId: "usdh",
  },
  {
    address: "STBuyENwJ1GP4yNZCjwavn92wYLEY3t5S1kVS5kwyS1",
    decimals: 9,
    cluster: "devnet",
    name: "stabble",
    symbol: "STB",
    image:
      "https://raez4ibvox5vdzauhhqo2baxrrvl7rd542lwmfepwlddlqu5b3va.arweave.net/iAmeIDV1-1HkFDng7QQXjGq_xH3ml2YUj7LGNcKdDuo",
  },
  {
    address: "HK3Q8SJYiV1kLo3b6vfwLnL45nhunnt4kSBVQNa3Z28J",
    decimals: 7,
    cluster: "devnet",
    name: "Parasol",
    symbol: "PSOL",
    image: "https://assets.coingecko.com/coins/images/21551/large/icon.png?1642584584",
    coingeckoId: "parasol-finance",
  },
];
