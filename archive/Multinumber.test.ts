import { test, describe } from 'node:test';
import assert from 'node:assert';
import { Polynumber } from './Polynumber.ts';
import { Multinumber } from './Multinumber.ts';
import { caretProduct } from './utils.ts';

describe('Multinumber', () => {
  test('constant product k = xy', () => {
    const xy = new Polynumber(1n, [1, 1]);
    const k = new Multinumber([xy]);
    assert.strictEqual(k.toString(), 'xy');
    assert.strictEqual(k.evaluate([100n, 200n]), 20000n);
  });

  test('linear function f(x,y,z) = 2x + 3y + 5z', () => {
    const f = Multinumber.linear([2, 3, 5]);
    assert.strictEqual(f.evaluate([1n, 2n, 3n]), 23n);
  });

  test('truncate drops terms above degree k', () => {
    // 2 + 3x + x²  — truncate to degree 1 should drop x²
    const p = new Multinumber([
      new Polynumber(2n, []),
      new Polynumber(3n, [1]),
      new Polynumber(1n, [2]),
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
    // B = 1 + x₃ + x₂x₄   (3 terms: constant, single variable, product of two variables)
    const B = new Multinumber([
      new Polynumber(1n, []),          // 1            — constant term, no variables
      new Polynumber(1n, [0,0,0,1]),   // x₃           — exponent 1 at index 3, 0 elsewhere
      new Polynumber(1n, [0,0,1,0,1])  // x₂x₄         — exponent 1 at indices 2 and 4
    ]);

    // C = x₁² + x₂x₄   (2 terms)
    const C = new Multinumber([
      new Polynumber(1n, [0,2]),       // x₁²          — exponent 2 at index 1
      new Polynumber(1n, [0,0,1,0,1])  // x₂x₄         — same monomial as B's third term
    ]);

    // B·C = (1 + x₃ + x₂x₄)(x₁² + x₂x₄)
    //     = x₁² + x₂x₄ + x₁²x₃ + x₂x₃x₄ + x₁²x₂x₄ + x₂²x₄²
    // multiply() is a raw Cauchy/Cartesian product (3 terms × 2 terms) and does not
    // collect like terms, so the result has 3·2 = 6 terms even though none happen
    // to coincide here.
    const product = B.multiply(C);
    assert.strictEqual(product.terms.length, 6);
  });
});
