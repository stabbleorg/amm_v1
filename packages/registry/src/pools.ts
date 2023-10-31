export interface PoolMeta {
  chainId: number;
  address: string;
  type: "weighted" | "stable" | "slr";
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
    address: "BnYsLJsMY3M5Nw6EsG6WoDiHHZjnY7hC9DKW7BmL8fhm",
    type: "stable",
    name: "USH-USDC",
    tags: ["usd", "ush"],
  },
  {
    chainId: 103,
    address: "EFCjUhXAbtRY5oC2TBoTp15jr8e58d2x2WvnZCAZbzwV",
    type: "stable",
    name: "USDT-USDC",
    tags: ["usd"],
  },
  {
    chainId: 103,
    address: "DuyBdvKBfyzTk43rPiBme8PckHU8RnW1oDPmD6rz93Zp",
    type: "slr",
    name: "USDC",
    tags: ["usd"],
  },
  {
    chainId: 103,
    address: "xjvxKg5Q5d9sqRdsyUxA2QFjMDG1HpneqDnMvomSGFW",
    type: "slr",
    name: "USDT",
    tags: ["usd"],
  },
];
