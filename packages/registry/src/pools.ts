import { Cluster } from "@solana/web3.js";

export interface PoolMeta {
  address: string;
  cluster: Cluster;
  kind: "weighted" | "stable";
  name: string;
  image: string;
  tags?: string[];
}

export const pools: PoolMeta[] = [
  {
    address: "5waHmrTZoNZBysSXfvgzYkXmkGkpbRBtHCQzFiSDnrh7",
    cluster: "devnet",
    kind: "weighted",
    name: "STB70-USDC30",
    image:
      "https://raez4ibvox5vdzauhhqo2baxrrvl7rd542lwmfepwlddlqu5b3va.arweave.net/iAmeIDV1-1HkFDng7QQXjGq_xH3ml2YUj7LGNcKdDuo",
  },
  {
    address: "HqYNu4hXRJuFBmiXD4pm6HuTdukUT3gqNKraD1huCJhS",
    cluster: "devnet",
    kind: "weighted",
    name: "STB80-USDT20",
    image: "",
  },
  {
    address: "E19KQr8pBnZn5C2oefC3JMCqvyn2QqdCHuroxew1R1Zr",
    cluster: "devnet",
    kind: "weighted",
    name: "STB40-PSOL35-USDC25",
    image: "",
  },
  {
    address: "4bJ6m57f6ugoy5ANqtdPz1QPFoVNQTENa4k4BQhQ6K2K",
    cluster: "devnet",
    kind: "stable",
    name: "USDH-USDT-USDC",
    image: "",
    tags: ["usd", "usdh"],
  },
  {
    address: "EFCjUhXAbtRY5oC2TBoTp15jr8e58d2x2WvnZCAZbzwV",
    cluster: "devnet",
    kind: "stable",
    name: "USDT-USDC",
    image: "",
    tags: ["usd"],
  },
];
