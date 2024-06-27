export function calcBalanceRatio(weightA: number, priceA: number, weightB: number, priceB: number): number {
  return (priceB * weightA) / (priceA * weightB);
}
