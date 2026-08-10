export function pow(base: bigint, exp: number): bigint {
  if (exp === 0) return 1n;
  if (exp === 1) return base;

  let result = 1n;
  for (let i = 0; i < exp; i++) {
    result = result * base;
  }
  return result;
}

export function caretProduct(...boxes: bigint[][]): bigint[] {
  return boxes.reduce(
    (acc, box) => acc.flatMap(a => box.map(b => a * b)),
    [1n]
  );
}
