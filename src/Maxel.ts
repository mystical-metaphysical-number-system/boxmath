import { Pixel } from './Pixel.ts';

/**
 * Maxel — a box of pixels with natural-number coefficients.
 *
 * M = Σ c_ij · [i,j]
 *
 * Represented as a sparse Map from pixel key "m,n" to bigint coefficient.
 * Zero-coefficient entries are absent.
 *
 * The maxel product MN = { mn : m ∈ M, n ∈ N } drops pixel products that
 * are nothing (inner indices mismatch) and sums coefficients of identical
 * result pixels. This is exactly matrix multiplication over natural numbers.
 */
export class Maxel {
  private readonly coeffs: Map<string, bigint>;

  constructor(entries: Iterable<[Pixel, bigint]> = []) {
    this.coeffs = new Map();
    for (const [pixel, coeff] of entries) {
      if (coeff === 0n) continue;
      const key = Maxel.key(pixel);
      this.coeffs.set(key, (this.coeffs.get(key) ?? 0n) + coeff);
    }
  }

  private static key(p: Pixel): string {
    return `${p.m},${p.n}`;
  }

  private static parseKey(k: string): [bigint, bigint] {
    const [m, n] = k.split(',').map(BigInt);
    return [m, n];
  }

  /** Build a maxel from a list of pixels each with coefficient 1 */
  static fromPixels(pixels: Pixel[]): Maxel {
    return new Maxel(pixels.map(p => [p, 1n]));
  }

  get(m: bigint, n: bigint): bigint {
    return this.coeffs.get(`${m},${n}`) ?? 0n;
  }

  /** All pixels with nonzero coefficient */
  get support(): { pixel: Pixel; coeff: bigint }[] {
    return [...this.coeffs.entries()].map(([k, c]) => {
      const [m, n] = Maxel.parseKey(k);
      return { pixel: new Pixel(m, n), coeff: c };
    });
  }

  /** M^T — transpose every pixel in the box */
  get transpose(): Maxel {
    return new Maxel(
      this.support.map(({ pixel, coeff }) => [pixel.transpose, coeff])
    );
  }

  /** Box union with multiplicity — add coefficient maps */
  add(other: Maxel): Maxel {
    return new Maxel([
      ...this.support.map(({ pixel, coeff }) => [pixel, coeff] as [Pixel, bigint]),
      ...other.support.map(({ pixel, coeff }) => [pixel, coeff] as [Pixel, bigint]),
    ]);
  }

  /**
   * Maxel product: MN = { pq : p ∈ M, q ∈ N }
   * Pixel products that are nothing are dropped.
   * Coefficients of identical result pixels are summed.
   */
  maxelProduct(other: Maxel): Maxel {
    const entries: [Pixel, bigint][] = [];
    for (const { pixel: a, coeff: ca } of this.support) {
      for (const { pixel: b, coeff: cb } of other.support) {
        const result = a.pixelProduct(b);
        if (result !== null) {
          entries.push([result, ca * cb]);
        }
      }
    }
    return new Maxel(entries);
  }

  /** Dense 2-D array representation up to rows r, cols c */
  toMatrix(rows: number, cols: number): bigint[][] {
    return Array.from({ length: rows }, (_, i) =>
      Array.from({ length: cols }, (_, j) => this.get(BigInt(i), BigInt(j)))
    );
  }

  toString(): string {
    if (this.coeffs.size === 0) return '0';
    return this.support
      .sort((a, b) => (a.pixel.m < b.pixel.m ? -1 : a.pixel.m > b.pixel.m ? 1 : a.pixel.n < b.pixel.n ? -1 : 1))
      .map(({ pixel, coeff }) => (coeff === 1n ? `[${pixel.m},${pixel.n}]` : `${coeff}·[${pixel.m},${pixel.n}]`))
      .join(' + ');
  }
}
