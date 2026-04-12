import { test, describe } from 'node:test';
import assert from 'node:assert';
import { Monomial } from './Monomial.ts';
import { MultiPoly } from './MultiPoly.ts';

describe('Monomial', () => {
  test('creates xy term', () => {
    const xy = new Monomial(1n, [1, 1]);
    assert.strictEqual(xy.toString(), 'xy');
    assert.strictEqual(xy.degree, 2);
  });
  
  test('evaluates at point', () => {
    // TODO: Test with properly scaled fixed-point values
    const scale = 10n ** 18n;
    const xy = new Monomial(scale, [1, 1]);
    assert.strictEqual(xy.evaluate([10n * scale, 20n * scale], 18), 200n * scale);
  });
  
  test('multiplies monomials', () => {
    const x = new Monomial(1n, [1]);
    const y = new Monomial(1n, [0, 1]);
    const xy = x.multiply(y);
    assert.deepStrictEqual(xy.exponents, [1, 1]);
  });
});

describe('MultiPoly', () => {
  test('constant product k = xy', () => {
    // TODO: Verify scaling behavior for AMM constant product formula
    const scale = 10n ** 18n;
    const xy = new Monomial(scale, [1, 1]);
    const k = new MultiPoly([xy], 18);
    
    assert.strictEqual(k.toString(), '1000000000000000000xy');
    assert.strictEqual(k.evaluate([100n * scale, 200n * scale]), 20000n * scale);
  });
  
  test('linear function f(x,y,z) = 2x + 3y + 5z', () => {
    // TODO: Validate linear coefficient scaling matches expected behavior
    const scale = 10n ** 18n;
    const f = MultiPoly.linear([2, 3, 5], 18);
    assert.strictEqual(f.evaluate([1n * scale, 2n * scale, 3n * scale]), 23n * scale);
  });
  
  test('multiplication from Wildberger paper', () => {
    const B = new MultiPoly([
      new Monomial(1n, []),
      new Monomial(1n, [0,0,0,1]),
      new Monomial(1n, [0,0,1,0,1])
    ], 18);
    
    const C = new MultiPoly([
      new Monomial(1n, [0,2]),
      new Monomial(1n, [0,0,1,0,1])
    ], 18);
    
    const product = B.multiply(C);
    
    assert.strictEqual(product.terms.length, 6);
  });
});
