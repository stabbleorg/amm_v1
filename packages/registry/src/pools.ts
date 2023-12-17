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
    address: "5CVwLg7FoDSpYqdRdTNc98YTpdz8godWv5f6FGCryarL",
    type: "weighted",
    name: "STB70-USDC30",
  },
  {
    chainId: 103,
    address: "BULJBb32S2ai5Yps2q3kgx4RGzpDQsskxQ2s9jEz18NS",
    type: "weighted",
    name: "STB80-USDT20",
  },
  {
    chainId: 103,
    address: "CHqnje9EfjzhBupPerzJYuNsRvNTy8GG17WKtThCy4wS",
    type: "weighted",
    name: "Bonk50-STB20-USDC30",
  },
  {
    chainId: 103,
    address: "4WjGfjA9UiMoz9euDudZ4KbqwuMsVNCDtCaEh5esW72K",
    type: "weighted",
    name: "Bonk70-USDT30",
  },
  {
    chainId: 103,
    address: "2W5WBB84Sj9sChysqBpQ6psb1uFsnn1keWcfK9UDBoNB",
    type: "stable",
    name: "USDT-USDC",
    tags: ["usd"],
  },
  {
    chainId: 103,
    address: "Ap5Dsn8ey15v9kP7A6S1dsvk1AdRJHhRFziR6hvLnYUM",
    type: "stable",
    name: "UXD-USDC",
    tags: ["usd", "uxd"],
  },
  {
    chainId: 103,
    address: "AVS9Wv2vSL8rt9bFzuRGiNPxZwGR6xx1ZLozL5p9beDR",
    type: "stable",
    name: "UXD-USDT",
    tags: ["usd", "uxd"],
  },
  {
    chainId: 103,
    address: "3wvwQVrFf5jakBSsSDna8CzPveoHhHSuQJaa5yWJirUY",
    type: "stable",
    name: "USH-USDC",
    tags: ["usd", "ush"],
  },
  {
    chainId: 103,
    address: "9s6v5Pme9wfvcqLDcAWDSiKAUR5sqg5GTC3mKB1zaybY",
    type: "stable",
    name: "USH-USDT",
    tags: ["usd", "ush"],
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
