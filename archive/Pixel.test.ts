import { test, describe } from 'node:test';
import assert from 'node:assert';
import { Pixel } from './Pixel.ts';
import { Vexel } from './Vexel.ts';

describe('Pixel', () => {
  test('pixelProduct chains indices: [3,4]·[4,11] = [3,11]', () => {
    const a = new Pixel(3n, 4n);
    const b = new Pixel(4n, 11n);
    const result = a.pixelProduct(b);
    assert.ok(result !== null);
    assert.ok(result!.equals(new Pixel(3n, 11n)));
  });

  test('pixelProduct is nothing when inner indices mismatch', () => {
    const a = new Pixel(3n, 4n);
    const b = new Pixel(5n, 11n);
    assert.strictEqual(a.pixelProduct(b), null);
  });

  test('pixelProduct is associative: ([m,n]·[n,p])·[p,q] = [m,n]·([n,p]·[p,q])', () => {
    const a = new Pixel(1n, 2n);
    const b = new Pixel(2n, 3n);
    const c = new Pixel(3n, 4n);

    const lhs = a.pixelProduct(b)!.pixelProduct(c);
    const rhs = a.pixelProduct(b.pixelProduct(c)!);
    assert.ok(lhs !== null && rhs !== null);
    assert.ok(lhs!.equals(rhs!));
  });

  test('transpose: [m,n]^T = [n,m]', () => {
    const p = new Pixel(3n, 7n);
    assert.ok(p.transpose.equals(new Pixel(7n, 3n)));
  });

  test('(ab)^T = b^T · a^T', () => {
    const a = new Pixel(2n, 5n);
    const b = new Pixel(5n, 9n);
    const ab = a.pixelProduct(b)!;
    assert.ok(ab.transpose.equals(b.transpose.pixelProduct(a.transpose)!));
  });

  test('diagonal pixel: [n,n].isDiagonal', () => {
    assert.strictEqual(new Pixel(3n, 3n).isDiagonal, true);
    assert.strictEqual(new Pixel(3n, 4n).isDiagonal, false);
  });

  describe('Pythagorean / Babylonian triples', () => {
    // pixel [m, n] with m > n → (m²-n², 2mn, m²+n²)
    const cases: [bigint, bigint, bigint, bigint, bigint][] = [
      [2n, 1n, 3n, 4n, 5n],    // oldest known triple
      [3n, 2n, 5n, 12n, 13n],
      [4n, 1n, 15n, 8n, 17n],
      [4n, 3n, 7n, 24n, 25n],
      [5n, 2n, 21n, 20n, 29n],
    ];

    for (const [m, n, a, b, c] of cases) {
      test(`pixel [${m},${n}] → (${a}, ${b}, ${c})`, () => {
        const triple = new Pixel(m, n).pythagoreanTriple();
        assert.ok(triple !== null);
        const [ta, tb, tc] = triple!;
        // verify the triple matches expectation
        assert.deepStrictEqual([ta, tb, tc], [a, b, c]);
        // verify it is genuinely Pythagorean
        assert.strictEqual(ta * ta + tb * tb, tc * tc);
      });
    }

    test('returns null when m <= n', () => {
      assert.strictEqual(new Pixel(2n, 2n).pythagoreanTriple(), null);
      assert.strictEqual(new Pixel(1n, 3n).pythagoreanTriple(), null);
    });
  });
});

describe('Vexel', () => {
  test('fromArray round-trips via toArray', () => {
    const v = Vexel.fromArray([2n, 0n, 5n, 1n]);
    assert.deepStrictEqual(v.toArray(4), [2n, 0n, 5n, 1n]);
  });

  test('add merges coefficients', () => {
    const v1 = Vexel.fromArray([1n, 2n, 0n]);
    const v2 = Vexel.fromArray([0n, 3n, 4n]);
    assert.deepStrictEqual(v1.add(v2).toArray(3), [1n, 5n, 4n]);
  });

  test('scale multiplies all coefficients', () => {
    const v = Vexel.fromArray([1n, 2n, 3n]);
    assert.deepStrictEqual(v.scale(3n).toArray(3), [3n, 6n, 9n]);
  });

  test('dot product', () => {
    const v1 = Vexel.fromArray([1n, 2n, 3n]);
    const v2 = Vexel.fromArray([4n, 5n, 6n]);
    // 1*4 + 2*5 + 3*6 = 4 + 10 + 18 = 32
    assert.strictEqual(v1.dot(v2), 32n);
  });

  test('zero scale yields empty vexel', () => {
    const v = Vexel.fromArray([1n, 2n, 3n]);
    assert.strictEqual(v.scale(0n).toString(), '0');
  });
});
