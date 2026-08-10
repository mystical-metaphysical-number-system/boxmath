import { test, describe } from 'node:test';
import assert from 'node:assert';
import { Pixel } from './Pixel.ts';
import { Maxel } from './Maxel.ts';

describe('Maxel', () => {
  // Paper Example 18: M = 2[0,0] + [1,0] + 3[0,2]
  const M18 = new Maxel([
    [new Pixel(0n, 0n), 2n],
    [new Pixel(1n, 0n), 1n],
    [new Pixel(0n, 2n), 3n],
  ]);

  test('get retrieves coefficients', () => {
    assert.strictEqual(M18.get(0n, 0n), 2n);
    assert.strictEqual(M18.get(1n, 0n), 1n);
    assert.strictEqual(M18.get(0n, 2n), 3n);
    assert.strictEqual(M18.get(9n, 9n), 0n);
  });

  // Paper Example 20: M^T = 2[0,0] + [0,1] + 3[2,0]
  test('transpose: M^T transposes every pixel', () => {
    const MT = M18.transpose;
    assert.strictEqual(MT.get(0n, 0n), 2n);  // [0,0]^T = [0,0]
    assert.strictEqual(MT.get(0n, 1n), 1n);  // [1,0]^T = [0,1]
    assert.strictEqual(MT.get(2n, 0n), 3n);  // [0,2]^T = [2,0]
    assert.strictEqual(MT.get(1n, 0n), 0n);  // gone
  });

  test('double transpose returns original', () => {
    const MT = M18.transpose;
    assert.strictEqual(MT.transpose.get(0n, 0n), 2n);
    assert.strictEqual(MT.transpose.get(1n, 0n), 1n);
    assert.strictEqual(MT.transpose.get(0n, 2n), 3n);
  });

  test('add merges coefficients', () => {
    const A = new Maxel([[new Pixel(0n, 0n), 1n]]);
    const B = new Maxel([[new Pixel(0n, 0n), 3n], [new Pixel(1n, 1n), 2n]]);
    const sum = A.add(B);
    assert.strictEqual(sum.get(0n, 0n), 4n);
    assert.strictEqual(sum.get(1n, 1n), 2n);
  });

  // Paper Example 22:
  //   M = [0,0] + [1,0]
  //   N = [1,0] + [0,2] + [2,3]
  //   MN = [0,2] + [1,2]
  describe('maxelProduct — Example 22', () => {
    const M22 = Maxel.fromPixels([new Pixel(0n, 0n), new Pixel(1n, 0n)]);
    const N22 = Maxel.fromPixels([
      new Pixel(1n, 0n),
      new Pixel(0n, 2n),
      new Pixel(2n, 3n),
    ]);

    test('MN = [0,2] + [1,2]', () => {
      const MN = M22.maxelProduct(N22);
      assert.strictEqual(MN.get(0n, 2n), 1n);
      assert.strictEqual(MN.get(1n, 2n), 1n);
      // all other entries zero
      assert.strictEqual(MN.get(0n, 0n), 0n);
      assert.strictEqual(MN.get(1n, 0n), 0n);
    });
  });

  // Paper Example 23:
  //   M = 2[0,0] + [1,0] + 3[0,2]
  //   N = [1,0] + 4[0,1] + 7[2,1] + 5[3,2]
  //   MN = 29[0,1] + 4[1,1]
  describe('maxelProduct — Example 23', () => {
    const N23 = new Maxel([
      [new Pixel(1n, 0n), 1n],
      [new Pixel(0n, 1n), 4n],
      [new Pixel(2n, 1n), 7n],
      [new Pixel(3n, 2n), 5n],
    ]);

    test('MN = 29[0,1] + 4[1,1]', () => {
      const MN = M18.maxelProduct(N23);
      assert.strictEqual(MN.get(0n, 1n), 29n);
      assert.strictEqual(MN.get(1n, 1n), 4n);
      // nothing else
      assert.strictEqual(MN.get(0n, 0n), 0n);
      assert.strictEqual(MN.get(0n, 2n), 0n);
    });
  });

  test('toMatrix dense representation', () => {
    const M = new Maxel([
      [new Pixel(0n, 0n), 2n],
      [new Pixel(0n, 2n), 3n],
      [new Pixel(1n, 0n), 1n],
    ]);
    assert.deepStrictEqual(M.toMatrix(2, 3), [
      [2n, 0n, 3n],
      [1n, 0n, 0n],
    ]);
  });
});
