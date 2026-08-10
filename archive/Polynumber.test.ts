import { test, describe } from 'node:test';
import assert from 'node:assert';
import { Polynumber } from './Polynumber.ts';

describe('Polynumber', () => {
  test('creates xy term', () => {
    const xy = new Polynumber(1n, [1, 1]);
    assert.strictEqual(xy.toString(), 'xy');
    assert.strictEqual(xy.degree, 2);
  });

  test('degree of xy is 2', () => {
    const xy = new Polynumber(1n, [1, 1]);
    assert.strictEqual(xy.degree, 2);
  });

  test('evaluates at point', () => {
    const xy = new Polynumber(1n, [1, 1]);
    assert.strictEqual(xy.evaluate([10n, 20n]), 200n);
  });

  test('constant term evaluates to coefficient', () => {
    const c = new Polynumber(5n, []);
    assert.strictEqual(c.evaluate([]), 5n);
    assert.strictEqual(c.toString(), '5');
    assert.strictEqual(c.degree, 0);
  });

  test('zero coefficient', () => {
    const z = new Polynumber(0n, [2, 3]);
    assert.strictEqual(z.toString(), '0');
    assert.strictEqual(z.evaluate([5n, 7n]), 0n);
  });

  test('coefficient 1 with no variables renders as 1', () => {
    assert.strictEqual(new Polynumber(1n, []).toString(), '1');
  });

  test('toString with explicit powers and custom names', () => {
    const term = new Polynumber(2n, [2, 0, 1]);
    assert.strictEqual(term.toString(['x', 'y', 'z']), '2x^2z');
  });

  test('toString falls back to βᵢ for unnamed variables', () => {
    const term = new Polynumber(1n, [0, 0, 0, 1]);
    assert.strictEqual(term.toString(), 'β3');
  });

  test('extent is last nonzero exponent index', () => {
    assert.strictEqual(new Polynumber(1n, [0, 0, 0, 1]).extent, 3);
    assert.strictEqual(new Polynumber(1n, [0, 0, 1, 0, 1]).extent, 4);
    assert.strictEqual(new Polynumber(5n, []).extent, 0);
  });

  test('trailing zero exponents do not affect evaluation', () => {
    const e3 = new Polynumber(1n, [0, 0, 0, 1]);
    const e3padded = new Polynumber(1n, [0, 0, 0, 1, 0]);
    const point = [1n, 2n, 3n, 4n];
    assert.strictEqual(e3.evaluate(point), e3padded.evaluate(point));
  });

  test('evaluate treats missing point coordinates as zero', () => {
    const x = new Polynumber(3n, [1]);
    assert.strictEqual(x.evaluate([]), 0n);
  });

  test('multiplies polynumbers: x · y = xy', () => {
    const x = new Polynumber(1n, [1]);
    const y = new Polynumber(1n, [0, 1]);
    const xy = x.multiply(y);
    assert.deepStrictEqual(xy.exponents, [1, 1]);
    assert.strictEqual(xy.coefficient, 1n);
    assert.strictEqual(xy.toString(), 'xy');
  });

  test('multiplies with coefficients: 2x · 3y = 6xy', () => {
    const x = new Polynumber(2n, [1]);
    const y = new Polynumber(3n, [0, 1]);
    const xy = x.multiply(y);
    assert.strictEqual(xy.coefficient, 6n);
    assert.deepStrictEqual(xy.exponents, [1, 1]);
    assert.strictEqual(xy.evaluate([10n, 20n]), 1200n);
  });

  test('ouroboros generators x, y, z are irreducible at their slots', () => {
    const x = new Polynumber(1n, [1]);
    const y = new Polynumber(1n, [0, 1]);
    const z = new Polynumber(1n, [0, 0, 1]);
    assert.strictEqual(x.toString(), 'x');
    assert.strictEqual(y.toString(), 'y');
    assert.strictEqual(z.toString(), 'z');
    assert.strictEqual(x.multiply(y).toString(), 'xy');
  });

  test('constant product xy at reserves (Balancer-style)', () => {
    const xy = new Polynumber(1n, [1, 1]);
    const R1 = 1000n;
    assert.strictEqual(xy.evaluate([9n, R1]), 9n * R1);
    assert.notStrictEqual(xy.evaluate([9n, R1]), 0n);
  });

  test('constructor copies exponents array', () => {
    const exps = [1, 1];
    const p = new Polynumber(1n, exps);
    exps[0] = 99;
    assert.deepStrictEqual(p.exponents, [1, 1]);
  });
});
