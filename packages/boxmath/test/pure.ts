import { test } from 'node:test';
import assert from 'node:assert';
import { toBox, fromBox } from '../src/pure.ts';

test('toBox/fromBox round-trip', () => {
  assert.deepStrictEqual(toBox(0), []);
  assert.deepStrictEqual(toBox(3), [[], [], []]);
  assert.strictEqual(fromBox(toBox(1000)), 1000);
});
