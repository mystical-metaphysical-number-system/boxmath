import { test } from 'node:test';
import assert from 'node:assert';
import { toBox, fromBox, toSignedBox, fromSignedBox, add, multiply, caret } from '../src/pure.ts';

test('toBox/fromBox round-trip', () => {
  assert.deepStrictEqual(toBox(0), []);
  assert.deepStrictEqual(toBox(3), [[], [], []]);
  assert.strictEqual(fromBox(toBox(1000)), 1000);
});

test('toSignedBox/fromSignedBox round-trip, positive and negative', () => {
  assert.deepStrictEqual(toSignedBox(3), [[[], [], []], []]);
  assert.deepStrictEqual(toSignedBox(-2), [[], [[], []]]);
  assert.strictEqual(fromSignedBox(toSignedBox(5)), 5);
  assert.strictEqual(fromSignedBox(toSignedBox(-5)), -5);
  assert.strictEqual(fromSignedBox(toSignedBox(0)), 0);
});

test('add sums signed naturals, uncancelled piles read the same net value', () => {
  assert.strictEqual(fromSignedBox(add(toSignedBox(2), toSignedBox(3))), 5);
  assert.strictEqual(fromSignedBox(add(toSignedBox(2), toSignedBox(-3))), -1);
  assert.strictEqual(fromSignedBox(add(toSignedBox(-4), toSignedBox(-1))), -5);
});

test('multiply follows sign-of-product rules', () => {
  assert.strictEqual(fromSignedBox(multiply(toSignedBox(3), toSignedBox(2))), 6);
  assert.strictEqual(fromSignedBox(multiply(toSignedBox(3), toSignedBox(-2))), -6);
  assert.strictEqual(fromSignedBox(multiply(toSignedBox(-3), toSignedBox(-2))), 6);
  assert.strictEqual(fromSignedBox(multiply(toSignedBox(0), toSignedBox(-2))), 0);
});

test('caret matches multiply at the Natural level', () => {
  assert.strictEqual(caret, multiply);
});
