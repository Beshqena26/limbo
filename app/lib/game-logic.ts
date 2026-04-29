import { HOUSE_EDGE } from './constants';

/**
 * Generate a provably fair random multiplier.
 * Uses crypto API to generate a random float, then maps it to a crash point.
 */
export async function generateMultiplier(): Promise<number> {
  const arr = new Uint32Array(1);
  crypto.getRandomValues(arr);
  const float = arr[0] / 4294967295; // 0..1

  // House edge applied: e = HOUSE_EDGE
  // multiplier = (1 - e) / (1 - float)  when float < (1 - e)
  // otherwise bust at 1.00
  if (float >= (1 - HOUSE_EDGE)) {
    return 1.00;
  }
  const mult = (1 - HOUSE_EDGE) / (1 - float);
  return Math.max(1.00, Math.floor(mult * 100) / 100);
}

export function fmt(n: number): string {
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Win chance for a given target multiplier
 */
export function winChance(target: number): number {
  if (target <= 1) return 100;
  return Math.min(100, ((1 - HOUSE_EDGE) / target) * 100);
}
