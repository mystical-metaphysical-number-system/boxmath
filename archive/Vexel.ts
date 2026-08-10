/**
 * Vexel — a box of singletons with natural-number coefficients.
 *
 * v = c0·[0] + c1·[1] + ... + cn·[n]
 *
 * Represented as a Map from singleton index to bigint coefficient.
 * Zero-coefficient entries are canonical absent; the zero vexel is empty.
 */
export class Vexel {
  private readonly coeffs: Map<bigint, bigint>;

  constructor(entries: Iterable<[bigint, bigint]> = []) {
    this.coeffs = new Map();
    for (const [idx, coeff] of entries) {
      if (coeff !== 0n) this.coeffs.set(idx, coeff);
    }
  }

  /** Build from a dense array: index 0..n-1 */
  static fromArray(arr: bigint[]): Vexel {
    return new Vexel(arr.map((c, i) => [BigInt(i), c] as [bigint, bigint]));
  }

  get(idx: bigint): bigint {
    return this.coeffs.get(idx) ?? 0n;
  }

  /** Indices that have non-zero coefficient */
  get support(): bigint[] {
    return [...this.coeffs.keys()].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  }

  add(other: Vexel): Vexel {
    const result = new Map(this.coeffs);
    for (const [idx, coeff] of other.coeffs) {
      result.set(idx, (result.get(idx) ?? 0n) + coeff);
    }
    return new Vexel(result);
  }

  scale(scalar: bigint): Vexel {
    if (scalar === 0n) return new Vexel();
    return new Vexel([...this.coeffs.entries()].map(([i, c]) => [i, scalar * c]));
  }

  /** Inner product (dot product) of two vexels */
  dot(other: Vexel): bigint {
    let sum = 0n;
    for (const [idx, coeff] of this.coeffs) {
      sum += coeff * other.get(idx);
    }
    return sum;
  }

  /** Dense array representation up to index n */
  toArray(n: number): bigint[] {
    return Array.from({ length: n }, (_, i) => this.get(BigInt(i)));
  }

  toString(): string {
    if (this.coeffs.size === 0) return '0';
    return this.support
      .map(i => {
        const c = this.coeffs.get(i)!;
        return c === 1n ? `[${i}]` : `${c}·[${i}]`;
      })
      .join(' + ');
  }
}
