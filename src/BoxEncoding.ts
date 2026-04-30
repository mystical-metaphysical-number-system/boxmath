/**
 * Hierarchical box encoding — the proper box arithmetic representation.
 *
 * Everything is built from the empty array [] (the empty box).
 * Value is always recoverable from structure alone: readNatural(n) === n.length.
 *
 *   Zero        = []
 *   Natural     = Zero[]         — n is n empty boxes
 *   Polynumber  = Natural[]      — a multiset of naturals, represents Σ αᵉ for each e in the box
 *   Multinumber = Polynumber[]   — a box of polynumbers
 *
 * The chi operator — a single recursive operation that generates the full arithmetic hierarchy.
 *
 *   chi(0, a, b) = box union: concatenate b onto a.
 *   chi(n, a, b) = form all pairs (x from a, y from b), apply chi(n-1) to each pair.
 *
 * Each depth level of nesting costs one extra chi to "reach through":
 *
 *   Level       chi(0)            chi(1)                chi(2)                chi(3)
 *   Natural     m + n             m × n                 m × n (bottoms out)
 *   Poly        poly add          poly multiply         caret ∧ (paper §6)
 *   Multi       box add           polys concatenated    αₘ ∧ αₙ = αₘ₊ₙ       αₘₙ
 *
 * Example at Multi depth:
 *   chi(0)([[3]],[[5]]) = [[3],[5]]   box union
 *   chi(1)([[3]],[[5]]) = [[3,5]]     poly concatenation inside
 *   chi(2)([[3]],[[5]]) = [[8]]       paper's αₘ ∧ αₙ = αₘ₊ₙ
 *   chi(3)([[3]],[[5]]) = [[15]]      αₘ × αₙ = αₘₙ
 */

// Box is the common supertype — all levels are arrays of boxes.
// Uses unknown[] rather than a circular type alias to keep TypeScript happy.
export type Box = unknown[];
export type Zero = [];
export type Natural = Zero[];
export type Polynumber = Natural[];
export type Multinumber = Polynumber[];

/** The empty box — the foundation */
export function zero(): Zero {
  return [];
}

/** natural(7) = [ [], [], [], [], [], [], [] ] */
export function natural(n: number): Natural {
  if (n < 0 || !Number.isInteger(n)) throw new RangeError(`natural requires a non-negative integer, got ${n}`);
  return Array.from({ length: n }, (): Zero => []);
}

/**
 * polynumber([3, 5]) = [ natural(3), natural(5) ]
 * encodes the box {3,5} = α³ + α⁵
 */
export function polynumber(exponents: number[]): Polynumber {
  return exponents.map(natural);
}

/** multinumber([[3,5], [0,1]]) = a box containing two polynumbers */
export function multinumber(polys: Polynumber[]): Multinumber {
  return [...polys];
}

/**
 * chi(n, a, b) — the generalised box operation.
 *
 *   chi(0) = box union: just append b onto a.
 *   chi(n) = distribute: form every pair (x from a, y from b), apply chi(n-1) to each pair,
 *            collect the results into a new box.
 *
 * Examples:
 *   chi(0)(nat(2), nat(3))             = nat(5)             [2 + 3]
 *   chi(1)(nat(2), nat(3))             = nat(6)             [2 × 3]
 *   chi(0)(poly([1,2,3]), poly([2,4])) = poly([1,2,3,2,4])  [poly add]
 *   chi(1)(poly([1,2,3]), poly([2,4])) = poly([3,5,4,6,5,7])[poly multiply (Cauchy)]
 *   chi(2)(poly([1,2,3]), poly([2,4])) = poly([2,4,4,8,6,12])[caret ∧ from paper §6]
 *   chi(2)([[m]], [[n]])               = [[m+n]]            [αₘ ∧ αₙ = αₘ₊ₙ]
 */
export function chi(n: number, a: Box, b: Box): Box {
  if (n === 0) return [...a, ...b];
  const result: Box = [];
  for (const x of a) {
    for (const y of b) {
      result.push(chi(n - 1, x as Box, y as Box));
    }
  }
  return result;
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
