import { PublicKey, Cluster } from "@solana/web3.js";

export interface TokenMeta {
  address: string;
  decimals: number;
  cluster: Cluster;
  name: string;
  symbol: string;
  image: string;
}

export const tokens: TokenMeta[] = [
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
    address: "AfWWqUHFzJFSxQHYn6PvyaoyswyodHgCTeDiRgovEmHX",
    decimals: 6,
    cluster: "devnet",
    name: "USD Coin",
    symbol: "USDC",
    image: "https://assets.coingecko.com/coins/images/6319/large/usdc.png",
  },
  {
    address: "AfWWqUHFzJFSxQHYn6PvyaoyswyodHgCTeDiRgovEmHX",
    decimals: 6,
    cluster: "devnet",
    name: "USDT",
    symbol: "USDT",
    image: "https://assets.coingecko.com/coins/images/325/large/Tether.png",
  },
  {
    address: "HhskQmZneTQem7QzaeZQ2q1baz9LCrngBMrWgM5jetPz",
    decimals: 6,
    cluster: "devnet",
    name: "USDH",
    symbol: "USDH",
    image: "https://assets.coingecko.com/coins/images/22941/large/USDH_icon.png",
  },
];
