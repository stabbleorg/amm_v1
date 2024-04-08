import fs from "fs";
import { Keypair, PublicKey, VersionedTransaction } from "@solana/web3.js";
import { bs58 } from "@coral-xyz/anchor/dist/cjs/utils/bytes";

export function parseKeypair(path?: string): Keypair {
  let keypair: Keypair;

  if (!path || path === "") {
    keypair = Keypair.generate();
    console.log("Using random keypair...");
    console.log(keypair.publicKey.toBase58());
  } else {
    keypair = Keypair.fromSecretKey(new Uint8Array(JSON.parse(fs.readFileSync(path, { encoding: "utf8" }))));
  }

  return keypair;
}

export function parseKey(key: string): PublicKey {
  return new PublicKey(key);
}

export function parseNumber(value: string): number {
  return Number(value);
}

export function parseDate(value: string): Date {
  return new Date(value);
}

export async function getPriorityFeeEstimate(url: string, tx: VersionedTransaction): Promise<number> {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "divvybet-cli",
        method: "getPriorityFeeEstimate",
        params: [
          {
            transaction: bs58.encode(tx.serialize()),
            options: { priorityLevel: "VeryHigh" },
          },
        ],
      }),
    });
    const data = (await response.json()) as {
      result: { priorityFeeEstimate: number };
    };
    return Math.trunc(data.result.priorityFeeEstimate);
  } catch (err) {
    return 0;
  }
}
