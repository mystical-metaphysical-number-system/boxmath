/**
 * Hierarchical box encoding. Everything is built from the empty array []
 * (the empty box). Value is recoverable from structure alone:
 * readNatural(n) === n.length.
 *
 *   Zero        = []
 *   Natural     = Zero[]         — n is n empty boxes
 *   Polynumber  = Natural[]      — a multiset of naturals, represents Σ αᵉ for each e
 *   Multinumber = Polynumber[]   — a box of polynumbers
 *
 * chi(n, a, b) generates the whole arithmetic hierarchy from one rule:
 *   chi(0) = box union (concatenate b onto a)
 *   chi(n) = pair up every (x from a, y from b), apply chi(n-1) to each pair
 * Nesting depth determines which chi index gives which operation — e.g.
 * chi(1) is × on Naturals, chi(2) is polynomial multiply, and so on.
 */

// _Prev[D] = D-1 for the depth arithmetic in Box<D>.
type _Prev = [never, 0, 1, 2];

/** Depth index for a box level. */
export type Depth = 0 | 1 | 2 | 3;

/**
 * Box<D> — a box at depth D. Each level nests an array around the
 * previous level's type; depth increase wraps, it never concatenates.
 *
 *   Box<0> = []           the empty box (zero)
 *   Box<1> = Box<0>[]     array of zeros          (Natural)
 *   Box<2> = Box<1>[]     array of Naturals       (Polynumber)
 *   Box<3> = Box<2>[]     array of Polynumbers    (Multinumber)
 *
 * Worked examples — each step wraps the previous value in one more
 * layer of array around it, it never appends a sibling bracket pair:
 *
 *   0     = []
 *   1     = [ [] ]                  — one Zero, wrapped        = natural(1)
 *   2     = [ [], [] ]              — two Zeros, wrapped       = natural(2)
 *   α¹    = [ [ [] ] ]              — natural(1), wrapped      = polynumber([1])
 *   2·α¹  = [ [ [] ], [ [] ] ]      — two copies of natural(1) = polynumber([1,1])
 */
export type Box<D extends Depth = Depth> =
  D extends 0 ? [] : Box<_Prev[D]>[];

export type Zero        = Box<0>;
export type Natural     = Box<1>;
export type Polynumber  = Box<2>;
export type Multinumber = Box<3>;

export function zero(): Zero {
  return [];
}

export function natural(n: number): Natural {
  if (n < 0 || !Number.isInteger(n)) throw new RangeError(`natural requires a non-negative integer, got ${n}`);
  return Array.from({ length: n }, (): Zero => []);
}

/** polynumber([3, 5]) encodes the box {3,5} = α³ + α⁵ */
export function polynumber(exponents: number[]): Polynumber {
  return exponents.map(natural);
}

export function multinumber(polys: Polynumber[]): Multinumber {
  return [...polys];
}

/** chi(0)(nat(2), nat(3)) = nat(5) [2+3]; chi(1)(nat(2), nat(3)) = nat(6) [2×3]. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function chi(n: number, a: any[], b: any[]): any[] {
  if (n === 0) return [...a, ...b];
  return a.flatMap((x: any) => b.map((y: any) => chi(n - 1, x, y)));
}

export function readNatural(n: Natural): number {
  return n.length;
}

export function readPolynumber(p: Polynumber): number[] {
  return p.map(readNatural);
}

export function readMultinumber(m: Multinumber): number[][] {
  return m.map(readPolynumber);
}
