export function pow(base: bigint, exp: number, scale: bigint): bigint {
  if (exp === 0) return scale;
  if (exp === 1) return base;
  
  let result = scale;
  for (let i = 0; i < exp; i++) {
    result = (result * base) / scale;
  }
  return result;
}

export function scale(value: number | bigint, precision: number): bigint {
  return BigInt(value) * (10n ** BigInt(precision));
}
