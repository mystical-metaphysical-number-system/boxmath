import { test } from 'node:test';
import assert from 'node:assert';
import { add, multiply, caret, evaluate, getRank, getDegree, findType, toRootedTree } from '../src/applied.ts';

const testOne = [1n, 2n, 3n];
const testTwo = [4n, 5n, 6n];
const foo = { bar: '5' };
const testThree = [1n, foo, 3n];

test('add(testOne, testTwo) concatenates the two boxes', () => {
  assert.deepStrictEqual(add(testOne, testTwo), [1n, 2n, 3n, 4n, 5n, 6n]);
});

test('add(testOne, testThree) works with a non-bigint term too', () => {
  assert.deepStrictEqual(add(testOne, testThree), [1n, 2n, 3n, 1n, foo, 3n]);
});

test('multiply(testOne, testTwo) pairs every term with +', () => {
  assert.deepStrictEqual(multiply(testOne, testTwo), [5n, 6n, 7n, 6n, 7n, 8n, 7n, 8n, 9n]);
});

test('caret(testOne, testTwo) pairs every term with *', () => {
  assert.deepStrictEqual(caret(testOne, testTwo), [4n, 5n, 6n, 8n, 10n, 12n, 12n, 15n, 18n]);
});

test('evaluate(testOne) sums a box of plain bigints', () => {
  assert.strictEqual(evaluate(testOne), 6n);
});

test('evaluate(testThree) carries the non-bigint term through untouched', () => {
  assert.deepStrictEqual(evaluate(testThree), [4n, foo]);
});

test('findType names the full hierarchy: Zero, Natural, Polynumber, Multinumber, Metanumber', () => {
  assert.strictEqual(findType(0n), 'Zero');
  assert.strictEqual(findType(5n), 'Natural');
  assert.strictEqual(findType([1n, 2n, 3n]), 'Polynumber');
  assert.strictEqual(findType([[1n, 2n], [3n]]), 'Multinumber');
  assert.strictEqual(findType([[[1n]]]), 'Metanumber');
});

test('getRank matches the same hierarchy: 0, 0, 1, 2, 3', () => {
  assert.strictEqual(getRank(0n), 0);
  assert.strictEqual(getRank(5n), 0);
  assert.strictEqual(getRank([1n, 2n, 3n]), 1);
  assert.strictEqual(getRank([[1n, 2n], [3n]]), 2);
  assert.strictEqual(getRank([[[1n]]]), 3);
});

test('getDegree works on a bare bigint too', () => {
  assert.strictEqual(getDegree(5n), 5n);
  assert.strictEqual(getDegree([1n, 2n, 3n]), 3n);
});

test('getDegree handles negative bigints without Math.max blowing up on the mix', () => {
  assert.strictEqual(getDegree([-5n, 2n, -1n]), 2n);
});

test('toRootedTree(5n) is a leaf', () => {
  assert.deepStrictEqual(toRootedTree(5n), { value: 5n, type: 'Natural', children: [] });
});

test('toRootedTree([1n,2n,3n]) is a Polynumber node with three leaves', () => {
  assert.deepStrictEqual(toRootedTree([1n, 2n, 3n]), {
    value: null,
    type: 'Polynumber',
    children: [
      { value: 1n, type: 'Natural', children: [] },
      { value: 2n, type: 'Natural', children: [] },
      { value: 3n, type: 'Natural', children: [] },
    ],
  });
});

test('toRootedTree nests correctly for a Multinumber', () => {
  const tree = toRootedTree([[1n, 2n], [3n]]);
  assert.strictEqual(tree.type, 'Multinumber');
  assert.strictEqual(tree.children.length, 2);
  assert.strictEqual(tree.children[0].type, 'Polynumber');
  assert.strictEqual(tree.children[0].children.length, 2);
});
