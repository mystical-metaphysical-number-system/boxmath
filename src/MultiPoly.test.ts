import { test, describe } from 'node:test';
import assert from 'node:assert';
import { Monomial } from './Monomial.ts';
import { MultiPoly } from './MultiPoly.ts';
import { caretProduct } from './utils.ts';

describe('Monomial', () => {
  test('creates xy term', () => {
    const xy = new Monomial(1n, [1, 1]);
    assert.strictEqual(xy.toString(), 'xy');
    assert.strictEqual(xy.degree, 2);
  });

  test('evaluates at point', () => {
    const xy = new Monomial(1n, [1, 1]);
    assert.strictEqual(xy.evaluate([10n, 20n]), 200n);
  });

  test('multiplies monomials', () => {
    const x = new Monomial(1n, [1]);
    const y = new Monomial(1n, [0, 1]);
    const xy = x.multiply(y);
    assert.deepStrictEqual(xy.exponents, [1, 1]);
    assert.strictEqual(xy.coefficient, 1n);
  });
});

describe('MultiPoly', () => {
  test('constant product k = xy', () => {
    const xy = new Monomial(1n, [1, 1]);
    const k = new MultiPoly([xy]);
    assert.strictEqual(k.toString(), 'xy');
    assert.strictEqual(k.evaluate([100n, 200n]), 20000n);
  });

  test('linear function f(x,y,z) = 2x + 3y + 5z', () => {
    const f = MultiPoly.linear([2, 3, 5]);
    assert.strictEqual(f.evaluate([1n, 2n, 3n]), 23n);
  });

  test('truncate drops terms above degree k', () => {
    // 2 + 3x + x²  — truncate to degree 1 should drop x²
    const p = new MultiPoly([
      new Monomial(2n, []),
      new Monomial(3n, [1]),
      new Monomial(1n, [2]),
    ]);
    const t = p.truncate(1);
    assert.strictEqual(t.terms.length, 2);
    assert.strictEqual(t.evaluate([5n]), 17n);  // 2 + 3·5 = 17
  });

  test('caretProduct — FIA box from BoxMathPrimes exercise 8.1', () => {
    const M = caretProduct([1n, 2n], [1n, 3n], [1n, 5n], [1n, 7n], [1n, 11n]);
    assert.strictEqual(M.length, 32);                    // 2^5 elements
    assert.ok(M.includes(2310n));                        // max element: 2·3·5·7·11
    assert.ok(M.includes(1n));                           // identity always present
    assert.ok(M.every(n => n > 0n));                     // all natural numbers
  });

  test('multiplication from Wildberger paper', () => {
    const B = new MultiPoly([
      new Monomial(1n, []),
      new Monomial(1n, [0,0,0,1]),
      new Monomial(1n, [0,0,1,0,1])
    ]);

    const C = new MultiPoly([
      new Monomial(1n, [0,2]),
      new Monomial(1n, [0,0,1,0,1])
    ]);

    const product = B.multiply(C);
    assert.strictEqual(product.terms.length, 6);
  });
});
