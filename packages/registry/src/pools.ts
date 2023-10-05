export interface PoolMeta {
  chainId: number;
  address: string;
  type: "weighted" | "stable";
  name: string;
  tags?: string[];
}

export const pools: PoolMeta[] = [
  {
    chainId: 103,
    address: "5waHmrTZoNZBysSXfvgzYkXmkGkpbRBtHCQzFiSDnrh7",
    type: "weighted",
    name: "STB70-USDC30",
  },
  {
    chainId: 103,
    address: "HqYNu4hXRJuFBmiXD4pm6HuTdukUT3gqNKraD1huCJhS",
    type: "weighted",
    name: "STB80-USDT20",
  },
  {
    chainId: 103,
    address: "E19KQr8pBnZn5C2oefC3JMCqvyn2QqdCHuroxew1R1Zr",
    type: "weighted",
    name: "STB40-PSOL35-USDC25",
  },
  {
    chainId: 103,
    address: "4bJ6m57f6ugoy5ANqtdPz1QPFoVNQTENa4k4BQhQ6K2K",
    type: "stable",
    name: "USDH-USDT-USDC",
    tags: ["usd", "usdh"],
  },
  {
    chainId: 103,
    address: "EFCjUhXAbtRY5oC2TBoTp15jr8e58d2x2WvnZCAZbzwV",
    type: "stable",
    name: "USDT-USDC",
    tags: ["usd"],
  },
];
