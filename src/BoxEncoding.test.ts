import { test, describe } from 'node:test';
import assert from 'node:assert';
import {
  zero, natural, polynumber, multinumber, chi,
  readNatural, readPolynumber, readMultinumber,
  type Box,
} from './BoxEncoding.ts';

describe('hierarchy construction', () => {
  test('zero is an empty array', () => {
    assert.deepStrictEqual(zero(), []);
  });

  test('natural(n) contains n empty boxes', () => {
    assert.strictEqual(natural(0).length, 0);
    assert.strictEqual(natural(5).length, 5);
    assert.ok(natural(5).every(e => Array.isArray(e) && e.length === 0));
  });

  test('readNatural round-trips', () => {
    for (const n of [0, 1, 7, 42]) {
      assert.strictEqual(readNatural(natural(n)), n);
    }
  });

  test('polynumber encodes a multiset of exponents', () => {
    // [3, 5] = α³ + α⁵
    assert.deepStrictEqual(readPolynumber(polynumber([3, 5])), [3, 5]);
    // [1, 1] = 2α (two copies of exponent 1)
    assert.deepStrictEqual(readPolynumber(polynumber([1, 1])), [1, 1]);
  });

  test('readMultinumber round-trips', () => {
    const m = multinumber([polynumber([3, 5]), polynumber([0, 1])]);
    assert.deepStrictEqual(readMultinumber(m), [[3, 5], [0, 1]]);
  });
});

describe('chi at Natural depth', () => {
  test('chi(0) = addition', () => {
    assert.strictEqual(chi(0, natural(2), natural(3)).length, 5);
    assert.strictEqual(chi(0, natural(0), natural(7)).length, 7);
  });

  test('chi(1) = multiplication', () => {
    assert.strictEqual(chi(1, natural(2), natural(3)).length, 6);
    assert.strictEqual(chi(1, natural(4), natural(5)).length, 20);
    assert.strictEqual(chi(1, natural(0), natural(7)).length, 0);  // 0 × 7 = 0
  });

  test('chi(n>=2) also gives multiplication (naturals bottom out)', () => {
    assert.strictEqual(chi(2, natural(3), natural(4)).length, 12);
  });
});

describe('chi at Polynumber depth', () => {
  const p = polynumber([1, 2, 3]);  // α + α² + α³
  const q = polynumber([2, 4]);     // α² + α⁴

  test('chi(0) = polynomial addition (multiset union)', () => {
    const result = readPolynumber(chi(0, p, q) as Box[]);
    // [1,2,3] ++ [2,4] = [1,2,3,2,4] — order preserved, repetition kept
    assert.deepStrictEqual(result, [1, 2, 3, 2, 4]);
  });

  test('chi(1) = polynomial multiplication (pairwise additive / Cauchy)', () => {
    // all pairs (a,b): a+b — same as (α+α²+α³)(α²+α⁴) Cauchy convolution
    const result = readPolynumber(chi(1, p, q) as Box[]).sort((a, b) => a - b);
    assert.deepStrictEqual(result, [3, 4, 5, 5, 6, 7]);
  });

  test('chi(2) = caret ∧  (pairwise multiplicative, paper §6)', () => {
    // (α+α²+α³) ∧ (α²+α⁴) = α² + 2α⁴ + α⁶ + α⁸ + α¹²
    const result = readPolynumber(chi(2, p, q) as Box[]).sort((a, b) => a - b);
    assert.deepStrictEqual(result, [2, 4, 4, 6, 8, 12]);
  });

  test('chi(2) identity: α₀ = [1] is the caret identity (α ∧ A = A)', () => {
    // α₀ = polynumber([1]) = [[1]] = α¹ — the caret identity element
    // Concrete test: chi(2)(poly([1]), poly([2,4])) should equal poly([2,4])
    const identity = polynumber([1]);
    const a = polynumber([2, 4]);
    const result = readPolynumber(chi(2, identity, a) as Box[]).sort((a, b) => a - b);
    assert.deepStrictEqual(result, [2, 4]);
  });
});

describe('chi at Multinumber depth', () => {
  // [[m]] = the multinumber containing the singleton polynumber {m} = αₘ
  const am = multinumber([polynumber([3])]);  // [[3]] = α₃
  const an = multinumber([polynumber([5])]);  // [[5]] = α₅

  test('chi(0) = box union (two separate polynumbers in result)', () => {
    const result = readMultinumber(chi(0, am, an) as Box[][]);
    assert.deepStrictEqual(result, [[3], [5]]);
  });

  test('chi(2) = paper caret: αₘ ∧ αₙ = αₘ₊ₙ', () => {
    // [[3]] ∧ [[5]] = [[8]]
    const result = readMultinumber(chi(2, am, an) as Box[][]);
    assert.deepStrictEqual(result, [[8]]);
  });

  test('chi(3) = αₘₙ (one level above caret)', () => {
    // [[3]] ∧' [[5]] = [[15]]
    const result = readMultinumber(chi(3, am, an) as Box[][]);
    assert.deepStrictEqual(result, [[15]]);
  });

  test('chi depth offset: caret at depth d requires chi(d)', () => {
    // At Nat (depth 1):   chi(1) = ×
    // At Poly (depth 2):  chi(2) = ∧
    // At Multi (depth 3): chi(3) = αₘₙ (one above ∧)
    // i.e. each depth level shifts the chi index by +1
    const nat_result   = chi(1, natural(3),  natural(5)).length;          // 3 × 5
    const poly_result  = readPolynumber(chi(2, polynumber([3]), polynumber([5])) as Box[]);  // {3×5}
    const multi_result = readMultinumber(chi(3, am, an) as Box[][]); // [[3×5]]

    assert.strictEqual(nat_result, 15);
    assert.deepStrictEqual(poly_result, [15]);
    assert.deepStrictEqual(multi_result, [[15]]);
  });
});
